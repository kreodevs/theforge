import {
  Controller,
  Post,
  Get,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AudioService } from "./audio.service.js";
import { getRequestUserId } from "../../common/request-user.store.js";

/** Minimal file shape from multer. */
interface UploadedAudioFile {
  buffer: Buffer;
  mimetype: string;
}

@Controller("audio")
export class AudioController {
  constructor(private readonly audio: AudioService) {}

  /**
   * Config STT del usuario autenticado (sttModel en BYOK del proveedor activo).
   * Sin sesión devuelve sttModel null.
   */
  @Get("config")
  async getConfig(): Promise<{ sttModel: string | null }> {
    try {
      const userId = getRequestUserId();
      return await this.audio.getSttConfigForUser(userId);
    } catch {
      return { sttModel: null };
    }
  }

  /** Transcribe an audio file using the user's configured STT model. */
  @Post("transcribe")
  @UseInterceptors(FileInterceptor("audio"))
  async transcribe(
    @UploadedFile() file: UploadedAudioFile,
  ): Promise<{ text: string }> {
    if (!file) {
      throw new BadRequestException("No se proporcionó archivo de audio");
    }
    const text = await this.audio.transcribe(file.buffer, file.mimetype);
    return { text };
  }
}
