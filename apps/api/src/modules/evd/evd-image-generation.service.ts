import { Injectable, Logger } from "@nestjs/common";
import type { UserLLMRuntime } from "../ai/providers/llm-runtime.types.js";

export interface ImageGenerationRequest {
  prompt: string;
  size?: "1024x1024" | "1792x1024" | "1024x1792";
  quality?: "standard" | "hd";
  style?: "vivid" | "natural";
}

export interface ImageGenerationResult {
  b64Json: string;
  revisedPrompt?: string;
  provider: string;
  model: string;
}

export interface ImageGenerationConfig {
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiImageModel: string;
  openrouterApiKey?: string;
  openrouterBaseUrl?: string;
  openrouterImageModel?: string;
}

@Injectable()
export class EvdImageGenerationService {
  private readonly logger = new Logger(EvdImageGenerationService.name);

  /**
   * Generate an image using the OpenAI /v1/images/generations endpoint.
   * Falls back from primary (OpenAI) to secondary (OpenRouter) if configured.
   */
  async generate(
    request: ImageGenerationRequest,
    config: ImageGenerationConfig,
  ): Promise<ImageGenerationResult> {
    const errors: string[] = [];

    // Try primary: OpenAI (only if key is actually present)
    if (config.openaiApiKey) {
      try {
        const result = await this.callImageApi({
          baseUrl: config.openaiBaseUrl,
          apiKey: config.openaiApiKey,
          model: config.openaiImageModel,
          ...request,
        });
        return { ...result, provider: "openai", model: config.openaiImageModel };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`OpenAI image generation failed: ${msg}`);
        errors.push(`openai: ${msg}`);
      }
    }

    // Try fallback: OpenRouter
    if (config.openrouterApiKey && config.openrouterImageModel) {
      try {
        // OpenRouter/Gemini don't support 'quality' ("standard"/"hd") or 'style' ("vivid"/"natural")
        // Gemini accepts quality: "auto"|"low"|"medium"|"high", but safest is omitting it.
        const { quality: _q, style: _s, ...routerRequest } = request;
        const result = await this.callImageApi({
          baseUrl: config.openrouterBaseUrl ?? "https://openrouter.ai/api/v1",
          apiKey: config.openrouterApiKey,
          model: config.openrouterImageModel,
          ...routerRequest,
        });
        return {
          ...result,
          provider: "openrouter",
          model: config.openrouterImageModel,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`OpenRouter image generation failed: ${msg}`);
        errors.push(`openrouter: ${msg}`);
      }
    }

    throw new Error(
      `Image generation failed on all providers: ${errors.join("; ")}`,
    );
  }

  /**
   * Build an ImageGenerationConfig from a resolved image runtime.
   * The runtime contains apiKey + baseURL + imageModel from the primary provider.
   * We also scan for any openrouter instance to use as fallback.
   */
  buildConfig(
    imageRuntime: UserLLMRuntime & { imageModel: string },
    fallbackRuntime?: (UserLLMRuntime & { imageModel: string }) | null,
  ): ImageGenerationConfig {
    const isOpenAI =
      imageRuntime.providerId === "openai" ||
      imageRuntime.providerId === "cloudflare" ||
      imageRuntime.providerId === "groq";

    return {
      openaiApiKey: isOpenAI ? imageRuntime.apiKey : "",
      openaiBaseUrl: isOpenAI
        ? imageRuntime.baseURL
        : "https://api.openai.com/v1",
      openaiImageModel: isOpenAI
        ? imageRuntime.imageModel
        : "",
      openrouterApiKey:
        imageRuntime.providerId === "openrouter"
          ? imageRuntime.apiKey
          : fallbackRuntime?.providerId === "openrouter"
            ? fallbackRuntime.apiKey
            : "",
      openrouterBaseUrl:
        imageRuntime.providerId === "openrouter"
          ? imageRuntime.baseURL
          : "https://openrouter.ai/api/v1",
      openrouterImageModel:
        imageRuntime.providerId === "openrouter"
          ? imageRuntime.imageModel
          : fallbackRuntime?.providerId === "openrouter"
            ? fallbackRuntime.imageModel
            : "",
    };
  }

  private async callImageApi(params: {
    baseUrl: string;
    apiKey: string;
    model: string;
    prompt: string;
    size?: string;
    quality?: string;
    style?: string;
  }): Promise<{ b64Json: string; revisedPrompt?: string }> {
    const url = `${params.baseUrl.replace(/\/$/, "")}/images/generations`;

    const body: Record<string, unknown> = {
      model: params.model,
      prompt: params.prompt,
      n: 1,
      response_format: "b64_json",
    };
    if (params.size) body.size = params.size;
    if (params.quality) body.quality = params.quality;
    if (params.style) body.style = params.style;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown");
      throw new Error(
        `Image API ${response.status}: ${errorText.slice(0, 300)}`,
      );
    }

    const data = (await response.json()) as {
      data?: Array<{ b64_json?: string; revised_prompt?: string }>;
    };

    const first = data.data?.[0];
    if (!first?.b64_json) {
      throw new Error("Image API returned no b64_json data");
    }

    return {
      b64Json: first.b64_json,
      revisedPrompt: first.revised_prompt,
    };
  }
}
