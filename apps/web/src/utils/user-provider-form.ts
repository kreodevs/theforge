import type {
  ProviderCatalogEntry,
  ProviderInstanceSummary,
  UserProviderConfigSummary,
} from "@/types/user-providers";

export interface UserProviderFormState {
  apiKey: string;
  chatModel: string;
  chatModelFallbacks: string;
  /** Tier B (medio): grafo MDD, Quality Gate, entregables. */
  graphChatModel: string;
  /** Tier A (potente): software_architect §2–§5. */
  architectChatModel: string;
  embeddingModel: string;
  sttModel: string;
  visionModel: string;
  visionModelFallback: string;
  baseUrl: string;
  extras: Record<string, string>;
}

function visionFallbackFromExtras(raw?: Record<string, unknown> | null): string {
  const v = raw?.visionModelFallback;
  return typeof v === "string" ? v : "";
}

export function extrasFromRecord(
  catalog: ProviderCatalogEntry,
  raw?: Record<string, unknown> | null,
): Record<string, string> {
  const extrasRaw = raw ?? {};
  return Object.fromEntries(
    (catalog.extraFields ?? []).map((f) => {
      const v = extrasRaw[f.key];
      if (typeof v === "string") return [f.key, v];
      if (v != null && f.key === "headers") return [f.key, JSON.stringify(v)];
      return [f.key, ""];
    }),
  );
}

export function configFormFromInstance(
  inst: ProviderInstanceSummary,
  catalog: ProviderCatalogEntry,
): UserProviderFormState {
  return {
    apiKey: "",
    chatModel: inst.chatModel,
    chatModelFallbacks: inst.chatModelFallbacks?.join(", ") ?? "",
    graphChatModel: inst.graphChatModel ?? inst.auditorChatModel ?? "",
    architectChatModel: inst.architectChatModel ?? "",
    embeddingModel: inst.embeddingModel ?? "",
    sttModel: inst.sttModel ?? "",
    visionModel: inst.visionModel ?? "",
    visionModelFallback: visionFallbackFromExtras(inst.extras),
    baseUrl: inst.baseUrl ?? "",
    extras: extrasFromRecord(catalog, inst.extras),
  };
}

export function configFormFromUserConfig(
  catalog: ProviderCatalogEntry,
  cfg: UserProviderConfigSummary,
): UserProviderFormState {
  return {
    apiKey: "",
    chatModel: cfg.chatModel || catalog.defaultChatModel,
    chatModelFallbacks: cfg.chatModelFallbacks?.join(", ") ?? "",
    graphChatModel: "",
    architectChatModel: "",
    embeddingModel: cfg.embeddingModel ?? catalog.defaultEmbeddingModel ?? "",
    sttModel: cfg.sttModel ?? catalog.defaultSttModel ?? "",
    visionModel: cfg.visionModel ?? catalog.defaultVisionModel ?? "",
    visionModelFallback: visionFallbackFromExtras(cfg.extras),
    baseUrl: cfg.baseUrl ?? catalog.defaultBaseUrl,
    extras: extrasFromRecord(catalog, cfg.extras),
  };
}

/** Formulario vacío para «agregar proveedor» (sin modelos precargados del catálogo). */
export function createEmptyUserProviderForm(
  catalog: ProviderCatalogEntry,
): UserProviderFormState {
  return {
    apiKey: "",
    chatModel: catalog.defaultChatModel,
    chatModelFallbacks: "",
    graphChatModel: "",
    architectChatModel: "",
    embeddingModel: catalog.defaultEmbeddingModel ?? "",
    sttModel: catalog.defaultSttModel ?? "",
    visionModel: catalog.defaultVisionModel ?? "",
    visionModelFallback: "",
    baseUrl: "",
    extras: Object.fromEntries(
      (catalog.extraFields ?? []).map((f) => [f.key, ""]),
    ),
  };
}

export type UserProviderFormFields =
  | "apiKey"
  | "chatModel"
  | "chatModelFallbacks"
  | "graphChatModel"
  | "architectChatModel"
  | "embeddingModel"
  | "sttModel"
  | "visionModel"
  | "visionModelFallback"
  | "baseUrl"
  | `extra:${string}`;

export type UserProviderFormErrors = Partial<Record<UserProviderFormFields, string>>;

export function parseFallbacks(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildExtrasPayload(
  catalog: ProviderCatalogEntry,
  extras: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of catalog.extraFields ?? []) {
    const raw = extras[field.key]?.trim() ?? "";
    if (!raw) continue;
    if (field.key === "headers") {
      try {
        out.headers = JSON.parse(raw) as unknown;
      } catch {
        out.headers = raw;
      }
    } else {
      out[field.key] = raw;
    }
  }
  return out;
}

/** Fusiona extras del catálogo con campos de visión (respaldo en JSON extras). */
export function buildProviderExtrasPayload(
  catalog: ProviderCatalogEntry,
  form: Pick<UserProviderFormState, "extras" | "visionModelFallback">,
): Record<string, unknown> {
  const out = buildExtrasPayload(catalog, form.extras);
  const vf = form.visionModelFallback.trim();
  if (vf) out.visionModelFallback = vf;
  return out;
}

export function validateUserProviderForm(args: {
  catalog: ProviderCatalogEntry;
  form: UserProviderFormState;
  isEditing: boolean;
  /** Valida tiers B/A (instancias de equipo); omitir en BYOK personal. */
  instanceModelTiers?: boolean;
}): UserProviderFormErrors {
  const { catalog, form } = args;
  const errors: UserProviderFormErrors = {};

  if (!args.isEditing && !form.apiKey.trim()) {
    errors.apiKey = "La clave API es obligatoria";
  }

  const chat = form.chatModel.trim();

  if (!chat) {
    errors.chatModel = "El modelo de chat es obligatorio";
  } else if (chat.length < 2) {
    errors.chatModel = "Indica un modelo de chat válido";
  }

  const fallbacks = parseFallbacks(form.chatModelFallbacks);
  if (form.chatModelFallbacks.trim() && fallbacks.length === 0) {
    errors.chatModelFallbacks =
      "Los modelos de respaldo deben ser nombres separados por coma";
  }
  for (const fb of fallbacks) {
    if (fb === chat) {
      errors.chatModelFallbacks = "El modelo de respaldo no puede ser igual al principal";
      break;
    }
  }

  if (args.instanceModelTiers) {
    const graph = form.graphChatModel.trim();
    const architect = form.architectChatModel.trim();

    if (graph && graph.length < 2) {
      errors.graphChatModel = "Indica un modelo de grafo válido";
    } else if (graph && graph === chat) {
      errors.graphChatModel =
        "Si es el mismo que el de chat, déjalo vacío (se usará el modelo de chat)";
    }

    if (architect && architect.length < 2) {
      errors.architectChatModel = "Indica un modelo arquitecto válido";
    } else if (architect && architect === graph) {
      errors.architectChatModel =
        "Si es el mismo que el de grafo, déjalo vacío (se usará el modelo de grafo)";
    } else if (architect && architect === chat) {
      errors.architectChatModel =
        "Si es el mismo que el de chat, déjalo vacío (se usará el modelo de chat)";
    }

    if (chat && graph && architect && chat === graph && graph === architect) {
      errors.architectChatModel =
        "Los tres modelos son iguales; considera usar solo el de chat o diferenciar tiers";
    }
  }

  if (catalog.supportsEmbeddings && form.embeddingModel.trim()) {
    if (form.embeddingModel.trim().length < 2) {
      errors.embeddingModel = "Indica un modelo de embeddings válido";
    }
  }

  if (catalog.supportsStt && form.sttModel.trim() && form.sttModel.trim().length < 2) {
    errors.sttModel = "Indica un modelo de transcripción válido";
  }

  if (catalog.supportsVision && form.visionModel.trim() && form.visionModel.trim().length < 2) {
    errors.visionModel = "Indica un modelo de visión válido";
  }

  if (catalog.supportsVision && form.visionModelFallback.trim() && form.visionModelFallback.trim().length < 2) {
    errors.visionModelFallback = "Indica un modelo de respaldo de visión válido";
  }

  if (catalog.baseUrlEditable && form.baseUrl.trim()) {
    try {
      const u = new URL(form.baseUrl.trim());
      if (!/^https?:$/i.test(u.protocol)) {
        errors.baseUrl = "La URL base debe usar http o https";
      }
    } catch {
      errors.baseUrl = "URL base no válida";
    }
  }

  for (const field of catalog.extraFields ?? []) {
    const key = `extra:${field.key}` as UserProviderFormFields;
    const raw = form.extras[field.key]?.trim() ?? "";
    if (field.required && !raw) {
      errors[key] = `${field.label} es obligatorio`;
      continue;
    }
    if (field.key === "headers" && raw) {
      try {
        JSON.parse(raw);
      } catch {
        errors[key] = "Headers debe ser JSON válido";
      }
    }
  }

  return errors;
}
