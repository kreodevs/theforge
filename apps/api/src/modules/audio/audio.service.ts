import { BadRequestException, Injectable } from "@nestjs/common";
import OpenAI from "openai";
import { AIFactory } from "../ai/ai.factory.js";
import { getRequestUserId } from "../../common/request-user.store.js";

/**
 * STT vía API compatible OpenAI del proveedor activo del usuario (sttModel en BYOK).
 */
@Injectable()
export class AudioService {
  constructor(private readonly aiFactory: AIFactory) {}

  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
    const runtime = await this.aiFactory.resolveSttRuntime(getRequestUserId());

    const client = new OpenAI({ apiKey: runtime.apiKey, baseURL: runtime.baseURL });

    const extension = mimeType.includes("ogg") ? "ogg" : "webm";
    const fileName = `audio.${extension}`;

    const transcription = await client.audio.transcriptions.create({
      model: runtime.sttModel,
      file: await OpenAI.toFile(audioBuffer, fileName),
      language: "es",
    });

    return transcription.text ?? "";
  }

  /** Indica si el usuario autenticado puede usar STT con su configuración actual. */
  async getSttConfigForUser(userId: string): Promise<{ sttModel: string | null }> {
    try {
      const runtime = await this.aiFactory.resolveSttRuntime(userId);
      return { sttModel: runtime.sttModel };
    } catch (err) {
      if (err instanceof BadRequestException) {
        return { sttModel: null };
      }
      throw err;
    }
  }
}
