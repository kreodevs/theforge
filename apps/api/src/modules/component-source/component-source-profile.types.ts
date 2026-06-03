import type { Prisma } from "@theforge/database";

export type ComponentSourceProfileRow = {
  id: string;
  userId: string;
  name: string;
  pluginId: string;
  url: string;
  tokenCipher: string | null;
  tokenKeyVersion: number | null;
  toolMapping: Prisma.JsonValue | null;
  capabilities: Prisma.JsonValue | null;
  toolsListHash: string | null;
  mappedAt: Date | null;
  mappingConfirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ComponentSourceProfilePublic = Omit<
  ComponentSourceProfileRow,
  "tokenCipher" | "tokenKeyVersion" | "userId"
> & {
  hasToken: boolean;
};

export interface CreateComponentSourceProfileDto {
  name: string;
  pluginId?: string;
  url: string;
  token?: string;
  toolMapping?: Prisma.InputJsonValue;
  capabilities?: Prisma.InputJsonValue;
  toolsListHash?: string | null;
  mappedAt?: string | null;
  mappingConfirmedAt?: string | null;
}

export interface UpdateComponentSourceProfileDto {
  name?: string;
  pluginId?: string;
  url?: string;
  token?: string;
  toolMapping?: Prisma.InputJsonValue | null;
  capabilities?: Prisma.InputJsonValue | null;
  toolsListHash?: string | null;
  mappedAt?: string | null;
  mappingConfirmedAt?: string | null;
}

export interface SetProjectComponentSourceProfileDto {
  profileId: string | null;
}

export interface TestComponentSourceProfileDto {
  url?: string;
  token?: string;
  useSaved?: boolean;
  hints?: string;
}

export interface ConfirmComponentSourceProfileMappingDto {
  toolMapping: Record<string, unknown>;
  toolsListHash?: string;
}

export type ComponentSourceProfileTestResult =
  | {
      mode: "health";
      ok: true;
      service?: string;
    }
  | {
      mode: "health";
      ok: false;
      error: string;
    }
  | {
      mode: "mapping";
      ok: true;
      proposedMapping: Record<string, unknown>;
      capabilities: Record<string, unknown>;
      toolsListHash: string;
      service?: string;
    };
