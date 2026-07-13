import { Injectable, Logger } from "@nestjs/common";
import { AIFactory } from "../ai/ai.factory.js";
import {
  EvdImageGenerationService,
  type ImageGenerationConfig,
} from "./evd-image-generation.service.js";
import type { UserLLMRuntime } from "../ai/providers/llm-runtime.types.js";

export interface VisualStyleDecision {
  backgroundPrompt: string;
  illustrationPrompt: string | null;
  style: "geometric" | "organic" | "minimal" | "data-driven";
}

export interface SlideImageResult {
  backgroundB64?: string;
  illustrationB64?: string;
  revisedBackgroundPrompt?: string;
  revisedIllustrationPrompt?: string;
  visualStyle?: "geometric" | "organic" | "minimal" | "data-driven";
}

/** Slide types that receive an illustration in addition to the background. */
const ILLUSTRATION_TYPES = new Set([
  "title",
  "problem_statement",
  "solution_vision",
  "cta",
]);

@Injectable()
export class EvdVisualStylistService {
  private readonly logger = new Logger(EvdVisualStylistService.name);

  constructor(
    private readonly imageGen: EvdImageGenerationService,
    private readonly aiFactory: AIFactory,
  ) {}

  /**
   * Generate a design decision for a single slide using the LLM.
   */
  async decideStyle(
    slideIndex: number,
    slideType: string,
    title: string,
    body: string,
    brandingColors: { primary: string; secondary: string; accent: string },
    runtime: UserLLMRuntime,
  ): Promise<VisualStyleDecision> {
    const hasIllustration = ILLUSTRATION_TYPES.has(slideType);

    const prompt = `You are a visual design consultant for a business presentation.
Generate a SHORT image generation prompt (max 100 words) for a slide.

Slide type: ${slideType}
Slide title: ${title}
Slide content summary: ${body.slice(0, 300)}
Brand colors: primary=${brandingColors.primary}, secondary=${brandingColors.secondary}, accent=${brandingColors.accent}
Style: corporate, modern, clean, non-photorealistic

Return JSON with exactly these fields:
{
  "backgroundPrompt": "description for a full-slide background image...",
  "illustrationPrompt": ${hasIllustration ? '"description for a small illustration..." or null if not needed' : "null"},
  "style": "geometric" | "organic" | "minimal" | "data-driven"
}

IMPORTANT: Keep prompts concise. Focus on shapes, colors, composition. No text in images.`;

    try {
      const provider = this.aiFactory.create(runtime);
      const raw = await provider.generateResponse(prompt, [], {
        maxTokensOverride: 400,
        welcomeBrief: true,
      });

      // Extract JSON from response (may be wrapped in markdown code fences)
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in LLM response");
      const parsed = JSON.parse(jsonMatch[0]) as {
        backgroundPrompt?: string;
        illustrationPrompt?: string | null;
        style?: string;
      };

      return {
        backgroundPrompt: parsed.backgroundPrompt || this.fallbackBackgroundPrompt(slideType, title, brandingColors),
        illustrationPrompt: hasIllustration
          ? parsed.illustrationPrompt || null
          : null,
        style: (["geometric", "organic", "minimal", "data-driven"] as const).includes(
          parsed.style as any,
        )
          ? (parsed.style as VisualStyleDecision["style"])
          : "minimal",
      };
    } catch (err) {
      this.logger.warn(`Style decision failed for slide ${slideIndex}: ${err}`);
      return {
        backgroundPrompt: this.fallbackBackgroundPrompt(slideType, title, brandingColors),
        illustrationPrompt: hasIllustration
          ? this.fallbackIllustrationPrompt(slideType, title, brandingColors)
          : null,
        style: "minimal",
      };
    }
  }

  /**
   * Generate all images for all slides in parallel (batched to avoid rate limits).
   */
  async generateAllImages(
    slides: Array<{ type: string; title: string; body?: string }>,
    brandingColors: { primary: string; secondary: string; accent: string },
    userId: string,
  ): Promise<Map<number, SlideImageResult>> {
    const imageRuntime = await this.aiFactory.resolveImageRuntime(userId);
    if (!imageRuntime) {
      this.logger.log("No image model configured — skipping image generation");
      return new Map();
    }

    const runtime = await this.aiFactory.resolveRuntime(userId);
    const config = this.buildImageConfig(imageRuntime, runtime);
    if (!config) {
      this.logger.warn("Cannot build image generation config — skipping");
      return new Map();
    }

    const results = new Map<number, SlideImageResult>();

    // Generate style decisions for all slides first (one LLM call each)
    const decisions = await Promise.all(
      slides.map((slide, idx) =>
        this.decideStyle(
          idx,
          slide.type,
          slide.title,
          slide.body ?? "",
          brandingColors,
          runtime,
        ),
      ),
    );

    // Build image generation tasks
    const tasks: Array<{
      index: number;
      kind: "background" | "illustration";
      prompt: string;
    }> = [];

    for (let i = 0; i < slides.length; i++) {
      const decision = decisions[i];
      tasks.push({ index: i, kind: "background", prompt: decision.backgroundPrompt });
      if (decision.illustrationPrompt) {
        tasks.push({
          index: i,
          kind: "illustration",
          prompt: decision.illustrationPrompt,
        });
      }
    }

    this.logger.log(
      `Generating ${tasks.length} images for ${slides.length} slides (primary=${config.openaiImageModel || config.openrouterImageModel})...`,
    );

    // Execute in batches of 3 to avoid overwhelming the API
    const BATCH_SIZE = 3;
    for (let b = 0; b < tasks.length; b += BATCH_SIZE) {
      const batch = tasks.slice(b, b + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (task) => {
          const result = await this.imageGen.generate(
            {
              prompt: task.prompt,
              size: task.kind === "background" ? "1792x1024" : "1024x1024",
              quality: "standard",
              style: "vivid",
            },
            config,
          );
          return { task, result };
        }),
      );

      for (const settled of batchResults) {
        if (settled.status === "fulfilled") {
          const { task, result } = settled.value;
          const existing = results.get(task.index) ?? {};
          if (task.kind === "background") {
            existing.backgroundB64 = result.b64Json;
            existing.revisedBackgroundPrompt = result.revisedPrompt;
          } else {
            existing.illustrationB64 = result.b64Json;
            existing.revisedIllustrationPrompt = result.revisedPrompt;
          }
          // Persist visual style from the original decision
          const decision = decisions[task.index];
          if (decision) existing.visualStyle = decision.style;
          results.set(task.index, existing);
        } else {
          this.logger.warn(`Image generation failed: ${settled.reason}`);
          // Still save the visual style even if image gen failed
          const task = (settled as PromiseRejectedResult).reason?.task as typeof tasks[0] | undefined;
          if (task) {
            const existing = results.get(task.index) ?? {};
            const decision = decisions[task.index];
            if (decision) existing.visualStyle = decision.style;
            results.set(task.index, existing);
          }
        }
      }
    }

    this.logger.log(
      `Image generation complete: ${results.size} slides with images`,
    );
    return results;
  }

  private buildImageConfig(
    imageRuntime: UserLLMRuntime & { imageModel: string },
    chatRuntime: UserLLMRuntime,
  ): ImageGenerationConfig | null {
    const isOpenAI =
      imageRuntime.providerId === "openai" ||
      imageRuntime.providerId === "cloudflare" ||
      imageRuntime.providerId === "groq";

    if (isOpenAI) {
      return {
        openaiApiKey: imageRuntime.apiKey,
        openaiBaseUrl: imageRuntime.baseURL,
        openaiImageModel: imageRuntime.imageModel,
      };
    }

    if (imageRuntime.providerId === "openrouter") {
      return {
        openaiApiKey: "",
        openaiBaseUrl: "https://api.openai.com/v1",
        openaiImageModel: "",
        openrouterApiKey: imageRuntime.apiKey,
        openrouterBaseUrl: imageRuntime.baseURL,
        openrouterImageModel: imageRuntime.imageModel,
      };
    }

    // Other providers — try OpenRouter fallback using chat runtime
    if (chatRuntime.providerId === "openrouter") {
      return {
        openaiApiKey: "",
        openaiBaseUrl: "https://api.openai.com/v1",
        openaiImageModel: "",
        openrouterApiKey: chatRuntime.apiKey,
        openrouterBaseUrl: chatRuntime.baseURL,
        openrouterImageModel: imageRuntime.imageModel,
      };
    }

    return null;
  }

  private fallbackBackgroundPrompt(
    _slideType: string,
    title: string,
    colors: { primary: string; secondary: string; accent: string },
  ): string {
    return `Minimal corporate presentation background, soft gradient from ${colors.primary} to ${colors.secondary}, subtle geometric shapes, clean modern design, no text, slide about "${title.slice(0, 50)}"`;
  }

  private fallbackIllustrationPrompt(
    _slideType: string,
    _title: string,
    colors: { primary: string; secondary: string; accent: string },
  ): string {
    return `Simple flat illustration for a business presentation slide, using colors ${colors.primary} and ${colors.accent}, minimal style, no text`;
  }
}
