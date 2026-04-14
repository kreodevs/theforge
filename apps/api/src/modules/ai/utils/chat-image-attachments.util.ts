import { BadRequestException } from "@nestjs/common";
import type { ChatImagePart } from "@theforge/shared-types";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_IMAGES = 6;
const MAX_BYTES_PER_IMAGE = 5 * 1024 * 1024;

function normalizeMime(raw: string): string | null {
  const m = raw.trim().toLowerCase();
  if (m === "image/jpg") return "image/jpeg";
  if (ALLOWED_MIME.has(m)) return m;
  return null;
}

function stripDataUrlBase64(input: string): { mime?: string; base64: string } {
  const t = input.trim();
  const m = t.match(/^data:([^;]+);base64,(.+)$/is);
  if (m?.[1] && m[2]) {
    return { mime: m[1].trim().toLowerCase(), base64: m[2].replace(/\s/g, "") };
  }
  return { base64: t.replace(/\s/g, "") };
}

/**
 * Parsea y valida el arreglo `images` del body (chat / Manager).
 * Lanza BadRequestException si el formato, MIME o tamaño no son aceptables.
 */
export function parseChatImageAttachments(raw: unknown): ChatImagePart[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new BadRequestException("images must be an array when present");
  }
  if (raw.length > MAX_IMAGES) {
    throw new BadRequestException(`Maximum ${MAX_IMAGES} images per message`);
  }
  const out: ChatImagePart[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object") {
      throw new BadRequestException("Each image must be an object with mimeType and base64");
    }
    const o = item as { mimeType?: unknown; base64?: unknown };
    const declaredMime = typeof o.mimeType === "string" ? o.mimeType : "";
    const rawB64 = typeof o.base64 === "string" ? o.base64 : "";
    const stripped = stripDataUrlBase64(rawB64);
    const mimeType = normalizeMime(stripped.mime ?? declaredMime);
    const b64 = stripped.base64;
    if (!mimeType || !b64) {
      throw new BadRequestException("Each image needs a valid mimeType and base64 payload");
    }
    let buf: Buffer;
    try {
      buf = Buffer.from(b64, "base64");
    } catch {
      throw new BadRequestException("Invalid base64 in image attachment");
    }
    if (buf.length === 0 || buf.length > MAX_BYTES_PER_IMAGE) {
      throw new BadRequestException(
        `Each image must be non-empty and at most ${MAX_BYTES_PER_IMAGE} bytes decoded`,
      );
    }
    out.push({ mimeType, base64: b64 });
  }
  return out;
}
