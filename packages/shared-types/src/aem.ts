import { z } from "zod";

/** Alcance geográfico del Análisis y Estudio de Mercado (AEM). */
export const aemMarketScopeSchema = z.enum(["global", "mexico", "latam"]);

/** Body para POST /projects/:id/generate-aem */
export const generateAemBodySchema = z.object({
  marketScope: aemMarketScopeSchema.default("mexico"),
});

export type AemMarketScope = z.infer<typeof aemMarketScopeSchema>;
export type GenerateAemBody = z.infer<typeof generateAemBodySchema>;

export const AEM_MARKET_SCOPE_LABELS: Record<AemMarketScope, string> = {
  global: "Global",
  mexico: "México",
  latam: "LATAM",
};
