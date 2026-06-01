import { Injectable } from "@nestjs/common";
import {
  ComponentSourceError,
  type ComponentSourceCredentialResolver,
  type ComponentSourceUrlTokenCredentials,
} from "@theforge/component-source";
import { PrismaService } from "../../prisma/prisma.service.js";
import { TokenCryptoService } from "../crypto/token-crypto.service.js";

@Injectable()
export class ComponentSourceCredentialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenCrypto: TokenCryptoService,
  ) {}

  /** Prisma + TokenCrypto wired as ComponentSourceCredentialResolver for plugin factories. */
  createUrlTokenResolver(): ComponentSourceCredentialResolver {
    return async (userId: string): Promise<ComponentSourceUrlTokenCredentials> => {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          componentSourceUrl: true,
          componentSourceTokenCipher: true,
          componentSourceTokenKeyVersion: true,
        },
      });
      if (!user?.componentSourceUrl) {
        throw new ComponentSourceError("Component Source no configurado para este usuario");
      }
      return {
        url: user.componentSourceUrl,
        token: this.decryptUserToken(user),
      };
    };
  }

  /** Saved or draft credentials for connection tests (admin UI). */
  async resolveForTest(opts: {
    userId: string;
    url?: string;
    token?: string;
    useSaved?: boolean;
  }): Promise<ComponentSourceUrlTokenCredentials> {
    const draftUrl = opts.url?.trim();
    if (!opts.useSaved && draftUrl) {
      let token = opts.token?.trim() ?? "";
      if (!token) {
        token = await this.resolveSavedToken(opts.userId);
      }
      return { url: draftUrl, token };
    }
    return (await this.createUrlTokenResolver()(opts.userId))!;
  }

  private async resolveSavedToken(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        componentSourceTokenCipher: true,
        componentSourceTokenKeyVersion: true,
      },
    });
    return user ? this.decryptUserToken(user) : "";
  }

  private decryptUserToken(user: {
    componentSourceTokenCipher: string | null;
    componentSourceTokenKeyVersion: number | null;
  }): string {
    if (user.componentSourceTokenCipher && user.componentSourceTokenKeyVersion != null) {
      return this.tokenCrypto.decrypt(
        user.componentSourceTokenCipher,
        user.componentSourceTokenKeyVersion,
      );
    }
    return "";
  }
}
