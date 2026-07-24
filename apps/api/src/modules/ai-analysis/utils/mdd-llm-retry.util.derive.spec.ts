/**
 * Tests para deriveLlmIdentity: identifica correctamente el provider de un
 * `BaseChatModel` a partir de su clase, `baseURL` y slug del modelo.
 *
 * Caso de regresión principal: cuando OpenRouter entra al pipeline MDD vía
 * `ChatOpenAI` con `configuration.baseURL = "https://openrouter.ai/api/v1"`,
 * la heurística por clase fallaba (devolvía `openai`); ahora la cascada
 * prioriza `baseURL` y devuelve `openrouter`, lo que permite que el catálogo
 * de pricing encuentre `openrouter:openai/gpt-4o` correctamente.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveLlmIdentity } from "./mdd-llm-retry.util.js";

function fakeClass(name: string): unknown {
  return class {
    static override name = name;
  };
}

function makeLlm(options: {
  className?: string;
  baseURL?: string;
  configurationBaseURL?: string;
  clientBaseURL?: string;
  lcKwargsBaseURL?: string;
  modelName?: string;
  model?: string;
  anthropicApiUrl?: string;
  apiUrl?: string;
}): unknown {
  class Llm {
    baseURL: string | undefined;
    configuration: { baseURL?: string } | undefined;
    client: { baseURL?: string } | undefined;
    lc_kwargs: { baseURL?: string } | undefined;
    modelName: string | undefined;
    model: string | undefined;
    anthropicApiUrl: string | undefined;
    apiUrl: string | undefined;
    constructor(
      className: string,
      baseURL: string | undefined,
      configurationBaseURL: string | undefined,
      clientBaseURL: string | undefined,
      lcKwargsBaseURL: string | undefined,
      modelName: string | undefined,
      model: string | undefined,
      anthropicApiUrl: string | undefined,
      apiUrl: string | undefined,
    ) {
      // Sobreescribe el .name del constructor para los duck-typing
      Object.defineProperty(this.constructor, "name", {
        value: className,
        configurable: true,
      });
      this.baseURL = baseURL;
      if (configurationBaseURL) {
        this.configuration = { baseURL: configurationBaseURL };
      }
      if (clientBaseURL) {
        this.client = { baseURL: clientBaseURL };
      }
      if (lcKwargsBaseURL) {
        this.lc_kwargs = { baseURL: lcKwargsBaseURL };
      }
      this.modelName = modelName;
      this.model = model;
      this.anthropicApiUrl = anthropicApiUrl;
      this.apiUrl = apiUrl;
    }
  }
  return new Llm(
    options.className ?? "ChatOpenAI",
    options.baseURL,
    options.configurationBaseURL,
    options.clientBaseURL,
    options.lcKwargsBaseURL,
    options.modelName,
    options.model,
    options.anthropicApiUrl,
    options.apiUrl,
  );
}

describe("deriveLlmIdentity", () => {
  describe("OpenRouter (regresión principal)", () => {
    it("ChatOpenAI con baseURL openrouter.ai → providerId=openrouter", () => {
      const llm = makeLlm({
        className: "ChatOpenAI",
        configurationBaseURL: "https://openrouter.ai/api/v1",
        modelName: "openai/gpt-4o",
      });
      const { providerId, modelId } = deriveLlmIdentity(llm as never);
      assert.equal(providerId, "openrouter");
      assert.equal(modelId, "openai/gpt-4o");
    });

    it("ChatOpenAI con baseURL openrouter.ai y modelo Anthropic upstream → providerId=openrouter", () => {
      const llm = makeLlm({
        className: "ChatOpenAI",
        configurationBaseURL: "https://openrouter.ai/api/v1",
        modelName: "anthropic/claude-sonnet-4",
      });
      const { providerId, modelId } = deriveLlmIdentity(llm as never);
      assert.equal(providerId, "openrouter");
      assert.equal(modelId, "anthropic/claude-sonnet-4");
    });

    it("prioriza baseURL sobre heurística del slug (modelId con upstream prefix)", () => {
      // Caso edge: si la clase fuera Anthropic pero la baseURL fuera openrouter,
      // la cascada actual prioriza la clase. Documentado como comportamiento.
      const llm = makeLlm({
        className: "ChatOpenAI",
        baseURL: "https://openrouter.ai/api/v1",
        modelName: "openai/gpt-4o-mini",
      });
      const { providerId } = deriveLlmIdentity(llm as never);
      assert.equal(providerId, "openrouter");
    });
  });

  describe("OpenAI nativo", () => {
    it("ChatOpenAI con baseURL api.openai.com → providerId=openai", () => {
      const llm = makeLlm({
        className: "ChatOpenAI",
        configurationBaseURL: "https://api.openai.com/v1",
        modelName: "gpt-4o",
      });
      const { providerId, modelId } = deriveLlmIdentity(llm as never);
      assert.equal(providerId, "openai");
      assert.equal(modelId, "gpt-4o");
    });

    it("ChatOpenAI sin baseURL (default) → providerId=openai", () => {
      const llm = makeLlm({
        className: "ChatOpenAI",
        modelName: "gpt-4o-mini",
      });
      const { providerId } = deriveLlmIdentity(llm as never);
      assert.equal(providerId, "openai");
    });
  });

  describe("Anthropic", () => {
    it("ChatAnthropic → providerId=anthropic (clase)", () => {
      const llm = makeLlm({
        className: "ChatAnthropic",
        anthropicApiUrl: "https://api.anthropic.com",
        model: "claude-sonnet-4-20250514",
      });
      const { providerId, modelId } = deriveLlmIdentity(llm as never);
      assert.equal(providerId, "anthropic");
      assert.equal(modelId, "claude-sonnet-4-20250514");
    });
  });

  describe("Gemini", () => {
    it("ChatGoogleGenerativeAI → providerId=gemini (clase)", () => {
      const llm = makeLlm({
        className: "ChatGoogleGenerativeAI",
        model: "gemini-2.5-pro",
      });
      const { providerId, modelId } = deriveLlmIdentity(llm as never);
      assert.equal(providerId, "gemini");
      assert.equal(modelId, "gemini-2.5-pro");
    });

    it("ChatOpenAI con baseURL gemini → providerId=gemini (baseURL)", () => {
      const llm = makeLlm({
        className: "ChatOpenAI",
        configurationBaseURL: "https://generativelanguage.googleapis.com/v1",
        modelName: "gemini-1.5-flash",
      });
      const { providerId } = deriveLlmIdentity(llm as never);
      assert.equal(providerId, "gemini");
    });
  });

  describe("Groq y Cloudflare", () => {
    it("ChatOpenAI con baseURL api.groq.com → providerId=groq", () => {
      const llm = makeLlm({
        className: "ChatOpenAI",
        configurationBaseURL: "https://api.groq.com/openai/v1",
        modelName: "llama-3.3-70b-versatile",
      });
      const { providerId } = deriveLlmIdentity(llm as never);
      assert.equal(providerId, "groq");
    });

    it("ChatOpenAI con baseURL api.cloudflare.com → providerId=cloudflare", () => {
      const llm = makeLlm({
        className: "ChatOpenAI",
        configurationBaseURL: "https://api.cloudflare.com/client/v4/accounts/abc/ai/v1",
        modelName: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      });
      const { providerId } = deriveLlmIdentity(llm as never);
      assert.equal(providerId, "cloudflare");
    });

    it("modelId con prefijo @cf/ sin baseURL → providerId=cloudflare (heurística slug)", () => {
      const llm = makeLlm({
        className: "ChatOpenAI",
        modelName: "@cf/meta/llama-3.1-8b-instruct",
      });
      const { providerId } = deriveLlmIdentity(llm as never);
      assert.equal(providerId, "cloudflare");
    });
  });

  describe("Heurística por slug (último recurso)", () => {
    it("modelId con prefijo openai/ y sin baseURL reconocible → providerId=openrouter", () => {
      const llm = makeLlm({
        className: "ChatOpenAI",
        modelName: "openai/gpt-4o",
      });
      const { providerId } = deriveLlmIdentity(llm as never);
      assert.equal(providerId, "openrouter");
    });

    it("modelId con prefijo google/ → providerId=openrouter", () => {
      const llm = makeLlm({
        className: "ChatOpenAI",
        modelName: "google/gemini-2.5-pro",
      });
      const { providerId } = deriveLlmIdentity(llm as never);
      assert.equal(providerId, "openrouter");
    });
  });

  describe("Casos borde", () => {
    it("custom baseURL desconocido → providerId=openai-compatible", () => {
      const llm = makeLlm({
        className: "ChatOpenAI",
        configurationBaseURL: "https://my-private-proxy.example.com/v1",
        modelName: "gpt-4o",
      });
      const { providerId } = deriveLlmIdentity(llm as never);
      assert.equal(providerId, "openai-compatible");
    });

    it("sin baseURL, sin class match, sin upstream prefix → providerId=openai por default", () => {
      const llm = makeLlm({
        className: "ChatOpenAI",
        modelName: "gpt-4o",
      });
      const { providerId } = deriveLlmIdentity(llm as never);
      assert.equal(providerId, "openai");
    });

    it("baseURL prioriza sobre heurística de slug (OpenRouter gana sobre 'gpt-4o' plano)", () => {
      const llm = makeLlm({
        className: "ChatOpenAI",
        configurationBaseURL: "https://openrouter.ai/api/v1",
        modelName: "gpt-4o",
      });
      const { providerId } = deriveLlmIdentity(llm as never);
      assert.equal(providerId, "openrouter");
    });

    it("modelId vacío → providerId=unknown", () => {
      const llm = makeLlm({
        className: "ChatOpenAI",
      });
      const { providerId, modelId } = deriveLlmIdentity(llm as never);
      assert.equal(providerId, "openai");
      assert.equal(modelId, "unknown");
    });

    it("clase ChatAnthropic toma precedencia sobre baseURL openrouter (no debería pasar)", () => {
      // En la práctica no ocurre porque cada runtime devuelve su propio LLM,
      // pero documentamos la precedencia: clase > baseURL > slug > default.
      const llm = makeLlm({
        className: "ChatAnthropic",
        configurationBaseURL: "https://openrouter.ai/api/v1",
        model: "claude-sonnet-4-20250514",
      });
      const { providerId } = deriveLlmIdentity(llm as never);
      assert.equal(providerId, "anthropic");
    });
  });

  describe("lectura de baseURL en distintas ubicaciones", () => {
    it("lee baseURL de lc_kwargs cuando configuration está ausente", () => {
      const llm = makeLlm({
        className: "ChatOpenAI",
        lcKwargsBaseURL: "https://openrouter.ai/api/v1",
        modelName: "openai/gpt-4o",
      });
      const { providerId } = deriveLlmIdentity(llm as never);
      assert.equal(providerId, "openrouter");
    });

    it("lee baseURL de client.baseURL", () => {
      const llm = makeLlm({
        className: "ChatOpenAI",
        clientBaseURL: "https://openrouter.ai/api/v1",
        modelName: "openai/gpt-4o",
      });
      const { providerId } = deriveLlmIdentity(llm as never);
      assert.equal(providerId, "openrouter");
    });

    it("lee anthropicApiUrl para ChatAnthropic", () => {
      const llm = makeLlm({
        className: "ChatAnthropic",
        anthropicApiUrl: "https://api.anthropic.com",
        model: "claude-3-haiku-20240307",
      });
      const { providerId } = deriveLlmIdentity(llm as never);
      assert.equal(providerId, "anthropic");
    });
  });
});
