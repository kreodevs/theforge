import { Injectable } from "@nestjs/common";
import {
  ComponentSourceError,
  type ComponentSourceCredentialResolver,
  type ComponentSourceUrlTokenCredentials,
} from "@theforge/component-source";
import { PrismaService } from "../../prisma/prisma.service.js";
import { TokenCryptoService } from "../crypto/token-crypto.service.js";

type EncryptedTokenFields = {
  tokenCipher: string | null;
  tokenKeyVersion: number | null;
};

@Injectable()
export class ComponentSourceCredentialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenCrypto: TokenCryptoService,
  ) {}

  /** Resolver bound to a saved ComponentSourceProfile row. */
  createProfileResolver(profileId: string): ComponentSourceCredentialResolver {
    return async () => this.resolveFromProfile(profileId);
  }

  async resolveFromProfile(profileId: string): Promise<ComponentSourceUrlTokenCredentials> {
    const profile = await this.prisma.componentSourceProfile.findUnique({
      where: { id: profileId },
      select: {
        url: true,
        tokenCipher: true,
        tokenKeyVersion: true,
      },
    });
    if (!profile?.url?.trim()) {
      throw new ComponentSourceError("Perfil de fuente de componentes sin URL configurada");
    }
    return {
      url: profile.url,
      token: this.decryptToken(profile),
    };
  }

  /** Saved or draft credentials for connection tests (profile UI / admin). */
  async resolveForTest(opts: {
    userId: string;
    profileId?: string;
    url?: string;
    token?: string;
    useSaved?: boolean;
  }): Promise<ComponentSourceUrlTokenCredentials> {
    const profileId = opts.profileId?.trim();
    if (profileId && opts.useSaved !== false && !opts.url?.trim()) {
      return this.resolveFromProfile(profileId);
    }

    const draftUrl = opts.url?.trim();
    if (draftUrl) {
      let token = opts.token?.trim() ?? "";
      if (!token && profileId) {
        token = await this.resolveSavedProfileToken(profileId);
      }
      if (!token) {
        throw new ComponentSourceError("Token requerido para probar la conexión MCP");
      }
      return { url: draftUrl, token };
    }

    if (profileId) {
      return this.resolveFromProfile(profileId);
    }

    throw new ComponentSourceError(
      "Indica profileId o url para probar la fuente de componentes",
    );
  }

  private async resolveSavedProfileToken(profileId: string): Promise<string> {
    const profile = await this.prisma.componentSourceProfile.findUnique({
      where: { id: profileId },
      select: {
        tokenCipher: true,
        tokenKeyVersion: true,
      },
    });
    return profile ? this.decryptToken(profile) : "";
  }

  private decryptToken(user: EncryptedTokenFields): string {
    if (user.tokenCipher && user.tokenKeyVersion != null) {
      return this.tokenCrypto.decrypt(user.tokenCipher, user.tokenKeyVersion);
    }
    return "";
  }
}
