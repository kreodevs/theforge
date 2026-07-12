# Modularización y Licenciamiento de The Forge

> **Estado**: Análisis estratégico — pendiente de decisión
> **Fecha**: 2026-07-11
> **Contexto**: Documento complementario a `PLAN_EVD.md`
> **Objetivo**: Determinar cómo extraer features como módulos monetizables separados

---

## 1. Pregunta central

¿Cómo convertir features del Forge (EVD, Legacy Flow, UI MCP, etc.) en módulos instalables que se monetizan aparte, sin romper la experiencia del usuario ni crear deuda técnica inmanejable?

---

## 2. Estado actual de la arquitectura

### 2.1 Lo que ya funciona a favor

| Activo | Ubicación | Cómo ayuda |
|---|---|---|
| Módulos NestJS limpios | `apps/api/src/modules/*` | Cada feature es un `@Module` con imports/exports explícitos |
| Paquetes compartidos | `packages/shared-types/`, `packages/business-rules/` | Contratos tipados externalizados |
| Env variable namespacing | `.env.example` (388 líneas) | Patrón `LEGACY_*`, `THEFORGE_*`, `TECH_DOCS_*` ya existe |
| Port/adapter pattern | `projects-service.port.ts` | Abstracción de contratos para testing y extensión |
| Role-based access | `common/roles.ts`, `common/guards/role.helpers.ts` | `requireAdmin()`, `requireSuperAdmin()` — extensible a feature-level |
| Turborepo | `turbo.json` | Build pipeline que soporta paquetes independientes |

### 2.2 Lo que bloquea la extracción

| Bloqueo | Detalle | Esfuerzo para resolver |
|---|---|---|
| **Registro estático de módulos** | `AppModule` hardcodea los 18 módulos. Sin `DynamicModule`, sin carga condicional. | Medio |
| **Sin feature flags** | No existe infraestructura de feature flags. Ni en API, ni en frontend, ni en DB. | Medio |
| **Frontend sin estructura por features** | 81 componentes flat, sin carpetas de feature, sin lazy loading por feature, sin barrel exports. | Alto |
| **Schema de DB compartido** | Un solo schema Prisma para todo. Las tablas de un módulo viven junto a las de otro. | Bajo (columnas adicionales son triviales) |
| **Sin sistema de licencias** | No hay validación de keys, no hay tiers, no hay gating por plan. | Medio |
| **Acoplamiento cross-module pesado** | `ProjectsModule` importa 10 módulos. `AiAnalysisModule` importa 8. `forwardRef()` en 3 lugares. | Alto (refactor) |

### 2.3 Mapa de dependencias entre módulos

```
                    ┌─────────────┐
                    │   Prisma    │ (@Global)
                    │   Module    │
                    └──────┬──────┘
                           │ (implicit)
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐      ┌─────▼─────┐     ┌─────▼─────┐
   │  Auth   │      │ Projects  │     │  Crypto   │ (@Global)
   │ Module  │      │  Module   │     │  Module   │
   └─────────┘      └─────┬─────┘     └───────────┘
                          │
            ┌─────────────┼─────────────────┐
            │             │                 │
       ┌────▼────┐  ┌────▼─────┐   ┌──────▼──────┐
       │   AI    │  │ Sessions │   │ Legacy Flow │
       │ Module  │  │  Module  │   │   Module    │
       └────┬────┘  └──────────┘   └─────────────┘
            │
     ┌──────┼──────────┐
     │      │          │
┌────▼───┐ ┌▼────────┐ ┌▼──────────┐
│  UiMCP │ │ Analysis│ │  Engine   │
│ Module │ │ Module  │ │  Module   │
└────────┘ └─────────┘ └───────────┘
```

**Observación crítica**: Los módulos más "extraíbles" son los que están en las hojas del árbol de dependencias: `UiMcpModule`, `LegacyFlowModule`, `AudioModule`, `DesignRefModule`. Los módulos en el centro (`ProjectsModule`, `AiModule`) son el core y NO deben extraerse.

---

## 3. Estrategias de monetización

### Estrategia A: Feature Gate por License Key (Recomendada para EVD)

**Concepto**: El código del módulo vive en un paquete npm privado. Se activa con una license key que valida features incluidas.

```
┌─────────────────────────────────────────────────────────────┐
│                     THE FORGE CORE                           │
│  (open source o freemium)                                    │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  infrastructure/                                      │  │
│  │  ├── License Service (validación HMAC-SHA256)        │  │
│  │  ├── Feature Flags Service (env vars + DB)           │  │
│  │  └── Module Registry (DynamicModule loading)         │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  Core: projects, ai, auth, sessions, engine, etc.           │
│                                                              │
│  if (featureFlags.isEnabled('evd')) {                       │
│    imports.push(EvdModule)  ← DynamicModule                  │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
         │
         ├── npm: @theforge/evd (privado, licenciado)
         ├── npm: @theforge/legacy (futuro, privado)
         └── npm: @theforge/uimcp (futuro, privado)
```

**Pros**:
- Control total del código fuente
- Validación offline (sin dependencia de server de licencias)
- Flexible: per-project, per-org, per-tier
- El módulo es un paquete npm versionado

**Contras**:
- Requiere infraestructura de licenciamiento
- Validación offline = más fácil de pirater
- Distribución npm privada (requiere registry o tarball)

**Ideal para**: EVD, features de alto valor que competen con herramientas externas

### Estrategia B: SaaS Tier (The Forge Cloud)

**Concepto**: The Forge tiene un componente cloud. Los tiers determinan qué features están habilitadas.

```
The Forge Free:    Core deliverables (MDD, Spec, Blueprint, Tasks)
The Forge Pro:     + EVD + Legacy Flow + UI MCP + Audio
The Forge Enterprise: + Custom branding + API + SLA + On-prem
```

**Pros**:
- Revenue recurrente predecible
- Control total del deployment
- Más fácil de actualizar y parchear

**Contras**:
- Requiere infraestructura cloud (multi-tenant)
- No aplica a self-hosted (que es el modelo actual)
- Más complejo operativamente

**Ideal para**: Si The Forge pivotea a SaaS o tiene un componente cloud

### Estrategia C: Separación Total (monorepo con paquetes privados)

**Concepto**: Cada módulo es un paquete npm independiente con su propio repo o dentro del monorepo.

```
theforge/                    (monorepo)
├── apps/
│   ├── api/                 (core, open source)
│   └── web/                 (core, open source)
├── packages/
│   ├── shared-types/        (público)
│   ├── business-rules/      (público)
│   ├── database/            (público)
│   ├── evd/                 (privado, npm)
│   ├── legacy-flow/         (privado, npm)
│   └── uimcp/               (privado, npm)
```

**Pros**:
- Versionado independiente por módulo
- Billing granular (pay per module)
- Clean separation of concerns

**Contras**:
- Complejidad de build (turborepo con packages privados)
- Distribución (npm registry privado, GitHub Packages, o tarballs)
- Más difícil de mantener consistencia entre versiones

**Ideal para**: Ecosistema de módulos con múltiples compradores y roadmap independiente

### Estrategia D: Hybrid (Recomendada)

Combinación de A + C: monorepo con paquetes privados, license key para activación.

```
theforge/ (monorepo público)
│
├── packages/
│   ├── @theforge/core/          ← abierto
│   ├── @theforge/shared-types/  ← abierto
│   └── @theforge/license/       ← abierto (infraestructura)
│
├── modules/                     ← paquetes privados
│   ├── @theforge/evd/           ← privado + license key
│   ├── @theforge/legacy/        ← (futuro)
│   └── @theforge/uimcp/         ← (futuro)
│
└── apps/
    ├── api/                     ← core, carga módulos dinámicamente
    └── web/                     ← core, features lazy-loaded
```

---

## 4. Sistema de Licenciamiento — Diseño Detallado

### 4.1 Formato del License Key

```
TFE-EVD-PRO-<orgId>-<features>-<expiry>-<signature>

Ejemplo:
TFE-EVD-PRO-a1b2c3d4-EVDxLEGxUIM-20271231-<hmac>
```

| Segmento | Descripción |
|---|---|
| `TFE` | Prefijo del producto (The Forge) |
| `EVD` | Módulo |
| `PRO` | Tier (FREE / PRO / ENTERPRISE) |
| `a1b2c3d4` | Organization ID (8 chars) |
| `EVDxLEGxUIM` | Features habilitadas (códigos compactos) |
| `20271231` | Fecha de expiración (YYYYMMDD) |
| `<hmac>` | Firma HMAC-SHA256 (32 chars) |

### 4.2 Paquete `@theforge/license`

```typescript
// packages/license/src/license.service.ts

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface LicensePayload {
  productId: string;      // "TFE"
  module: string;         // "EVD"
  tier: 'free' | 'pro' | 'enterprise';
  orgId: string;
  features: string[];     // ['evd', 'legacy', 'uimcp']
  expiresAt: string | null; // null = perpetual
  maxProjects: number | null; // null = unlimited
  instanceId: string | null;  // null = non-locked
}

export class LicenseService {
  private secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  /**
   * Validación OFFLINE (sin network call).
   * Verifica firma HMAC + expiración + features.
   */
  validate(key: string): { valid: boolean; license?: LicensePayload; reason?: string } {
    const payload = this.decodeKey(key);
    if (!payload) return { valid: false, reason: 'invalid_format' };

    // Verificar firma
    const expectedSig = this.signPayload(payload);
    if (!timingSafeEqual(Buffer.from(payload.signature), Buffer.from(expectedSig))) {
      return { valid: false, reason: 'invalid_signature' };
    }

    // Verificar expiración
    if (payload.expiresAt) {
      const expiry = new Date(payload.expiresAt);
      if (expiry < new Date()) {
        return { valid: false, reason: 'expired', license: payload };
      }
    }

    return { valid: true, license: payload };
  }

  /**
   * Verificar que una feature específica está habilitada.
   */
  isFeatureEnabled(key: string, feature: string): boolean {
    const result = this.validate(key);
    return result.valid && result.license!.features.includes(feature);
  }

  /**
   * Validación ONLINE (periódica, una vez al día).
   * Verifica contra el server de licencias para:
   * - Revocaciones
   * - Cambios de tier
   * - Detección de pirateo (múltiples instancias)
   */
  async onlineValidate(key: string, instanceId: string): Promise<{
    valid: boolean;
    message?: string;
  }> {
    const response = await fetch('https://license.theforge.dev/api/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-License-Key': key,
        'X-Instance-Id': instanceId,
      },
    });

    if (!response.ok) {
      return { valid: false, message: 'License server unreachable' };
    }

    return response.json();
  }

  // --- Private helpers ---

  private decodeKey(key: string): (LicensePayload & { signature: string }) | null {
    // Decode from base64url segments
    // ...
  }

  private signPayload(payload: Omit<LicensePayload, 'signature'>): string {
    const data = JSON.stringify(payload);
    return createHmac('sha256', this.secret).update(data).digest('hex').slice(0, 32);
  }
}
```

### 4.3 Server de Licencias (tu servicio)

```
https://license.theforge.dev

POST /api/validate
  Headers: X-License-Key, X-Instance-Id
  Response: { valid: boolean, tier: string, features: string[], message?: string }

POST /api/activate
  Body: { key, instanceId, orgName, email }
  Response: { activated: boolean, license: LicensePayload }

GET /api/health
  Response: { status: "ok", version: string }
```

**Base de datos del server de licencias:**

```sql
CREATE TABLE licenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           VARCHAR(64) UNIQUE NOT NULL,
  org_id        VARCHAR(32) NOT NULL,
  org_name      VARCHAR(255),
  email         VARCHAR(255),
  tier          VARCHAR(20) NOT NULL DEFAULT 'pro',
  features      JSONB NOT NULL DEFAULT '[]',
  expires_at    TIMESTAMPTZ,
  max_projects  INTEGER,
  instance_id   VARCHAR(64),  -- vinculación a instancia
  activated_at  TIMESTAMPTZ,
  last_check    TIMESTAMPTZ,
  revoked       BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE license_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id    UUID REFERENCES licenses(id),
  action        VARCHAR(50) NOT NULL,  -- validate, activate, revoke, check
  instance_id   VARCHAR(64),
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

### 4.4 Flujo de activación (usuario)

```bash
# 1. Usuario instala The Forge core
git clone https://github.com/theforge/theforge.git
cd theforge && pnpm install

# 2. Usuario compra licencia EVD
#    → Recibe por email: TFE-EVD-PRO-a1b2c3d4-EVDx-20271231-<sig>

# 3. Instala el módulo EVD
pnpm add @theforge/evd

# 4. Activa con CLI
pnpm theforge license activate TFE-EVD-PRO-a1b2c3d4-EVDx-20271231-<sig>
#    → Valida offline
#    → Valida online (1ra vez)
#    → Guarda en .env: EVD_LICENSE_KEY=...
#    → Guarda en DB: feature_flags.evd = true

# 5. Reinicia
pnpm dev  # o docker compose up -d

# 6. Tab "Executive Deck" aparece en Workshop
```

### 4.5 Flujo de validación (en runtime)

```
Startup:
  1. Cargar EVD_LICENSE_KEY desde .env
  2. Validar offline (firma + expiración)
  3. Si válido → FeatureFlags.evd = true → EvdModule se registra
  4. Si inválido → FeatureFlags.evd = false → módulo no se carga
  5. Programar validación online cada 24h (setTimeout/setInterval)

Cada request a /api/evd/*:
  1. Feature guard: if (!featureFlags.isEnabled('evd')) throw 403
  2. Rate limiting por licencia
  3. Audit log (opcional)

Validación online (cada 24h):
  1. POST /api/validate con key + instanceId
  2. Si revocado → FeatureFlags.evd = false → módulo se descarga
  3. Si expirado → FeatureFlags.evd = false → notificar usuario
  4. Si server unreachable → mantener estado actual (fail-open)
```

---

## 5. Dynamic Module Loading en NestJS

### 5.1 Patrón base

```typescript
// apps/api/src/common/dynamic-modules.ts

import { DynamicModule, Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class ConditionalModuleLoader {
  /**
   * Registra módulos condicionalmente basándose en feature flags.
   */
  static fromFeatureFlags(
    config: ConfigService,
    mapping: Record<string, Type | DynamicModule>,
  ): (Type | DynamicModule)[] {
    const modules: (Type | DynamicModule)[] = [];

    for (const [feature, module] of Object.entries(mapping)) {
      const envKey = `FEATURE_${feature.toUpperCase()}`;
      if (config.get(envKey, 'false') === 'true') {
        modules.push(module);
      }
    }

    return modules;
  }
}
```

### 5.2 Uso en AppModule

```typescript
// apps/api/src/app.module.ts

@Module({
  imports: [
    // Core (siempre cargados)
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CryptoModule,
    AuthModule,
    ProjectsModule,
    SessionsModule,
    AiModule,
    EngineModule,
    // ... más core modules

    // Módulos condicionales (feature-gated)
    ...ConditionalModuleLoader.fromFeatureFlags(config, {
      evd: EvdModule,
      legacy_flow: LegacyFlowModule,
      ui_mcp: UiMcpModule,
      audio: AudioModule,
      design_ref: DesignRefModule,
    }),
  ],
})
export class AppModule {}
```

### 5.3 El módulo EVD como DynamicModule

```typescript
// modules/evd/src/evd.module.ts

import { DynamicModule, Module } from '@nestjs/common';
import { EvdController } from './evd.controller';
import { EvdExportService } from './evd-export.service';
import { EvdRendererService } from './evd-renderer.service';
// ...

@Module({})
export class EvdModule {
  static register(): DynamicModule {
    return {
      module: EvdModule,
      controllers: [EvdController],
      providers: [
        EvdExportService,
        EvdRendererService,
        EvdChartService,
        EvdDiagramService,
        EvdWireframeService,
        EvdPptxService,
        EvdPdfService,
        EvdStorageService,
        EvdDesignSystemService,
      ],
      exports: [
        EvdExportService,
        EvdStorageService,
      ],
    };
  }
}
```

---

## 6. Feature Flags en la Base de Datos

### 6.1 Schema Prisma

```prisma
// Añadir a schema.prisma

model Organization {
  id            String   @id @default(uuid())
  name          String
  // ... existing fields ...
  featureFlags  Json?    // { "evd": true, "legacy": false, "uimcp": true }
  licenseKey    String?  // @db.Text
  licenseTier   String?  // "free" | "pro" | "enterprise"
  licenseExpiry DateTime?
}
```

### 6.2 Feature Flags Service (multi-tenant)

```typescript
// apps/api/src/modules/license/feature-flags.service.ts

@Injectable()
export class FeatureFlagsService {
  private globalFlags: FeatureFlags = {
    evd: false,
    legacy_flow: false,
    ui_mcp: true,
    design_ref: true,
    audio_transcription: false,
  };

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private license: LicenseService,
  ) {
    // Carga desde env vars al startup
    this.globalFlags.evd = config.get('FEATURE_EVD', 'false') === 'true';
    this.globalFlags.legacy_flow = config.get('FEATURE_LEGACY_FLOW', 'false') === 'true';
  }

  /**
   * Flags globales (env vars, para self-hosted single-org).
   */
  isEnabledGlobal(flag: FeatureFlag): boolean {
    return this.globalFlags[flag];
  }

  /**
   * Flags por organización (multi-tenant / cloud).
   */
  async isEnabledForOrg(orgId: string, flag: FeatureFlag): Promise<boolean> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { featureFlags: true, licenseKey: true, licenseTier: true },
    });

    if (!org) return false;

    // 1. Verificar si la feature está en los flags de la org
    const orgFlags = (org.featureFlags as Record<string, boolean>) ?? {};
    if (orgFlags[flag] === true) return true;

    // 2. Verificar si la licencia la incluye
    if (org.licenseKey) {
      return this.license.isFeatureEnabled(org.licenseKey, flag);
    }

    return false;
  }

  /**
   * Activar una feature para una org (post-licencia).
   */
  async activateFeature(orgId: string, flag: FeatureFlag, licenseKey: string): Promise<void> {
    const validation = this.license.validate(licenseKey);
    if (!validation.valid) throw new Error('Invalid license');

    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        featureFlags: { ...await this.getOrgFlags(orgId), [flag]: true },
        licenseKey,
        licenseTier: validation.license!.tier,
        licenseExpiry: validation.license!.expiresAt
          ? new Date(validation.license!.expiresAt)
          : null,
      },
    });
  }

  private async getOrgFlags(orgId: string): Promise<Record<string, boolean>> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { featureFlags: true },
    });
    return (org?.featureFlags as Record<string, boolean>) ?? {};
  }
}
```

### 6.3 Frontend Feature Flag Hook

```typescript
// apps/web/src/hooks/useFeatureFlag.ts

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export function useFeatureFlag(flag: FeatureFlag): boolean {
  const { data } = useQuery({
    queryKey: ['feature-flags', flag],
    queryFn: async () => {
      const res = await apiFetch('/feature-flags');
      const flags = await res.json();
      return flags[flag] ?? false;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  return data ?? false;
}

// apps/web/src/components/evd/EvdPanel.tsx
export function EvdPanel() {
  const evdEnabled = useFeatureFlag('evd');

  if (!evdEnabled) {
    return (
      <FeatureLockedCard
        feature="Executive Vision Deck"
        description="Crea presentaciones ejecutivas profesionales con charts, diagramas y wireframes."
        upgradeUrl="/settings/billing?feature=evd"
      />
    );
  }

  return <EvdSlideEditor />;
}
```

---

## 7. Protección Anti-Piratería

### 7.1 Capas de protección

| Capa | Mecanismo | Dificultad de bypass |
|---|---|---|
| **L1: Formato del key** | Base64url + HMAC-SHA256 signature | Media — requiere conocer el secret |
| **L2: Instance binding** | Key vinculada a hash(hostname + Docker ID) | Media — requiere modificar el key |
| **L3: Online heartbeat** | Validación cada 24h contra license server | Alta — requiere spoofing del server |
| **L4: Code splitting** | Código del módulo en paquete npm privado | Alta — requiere acceso al registry |
| **L5: Audit logging** | Cada uso registrado con timestamp + IP | Baja — solo disuasivo |
| **L6: Watermarking** | PDFs/PPTXs incluyen metadata con license key | Baja — solo identificación |

### 7.2 Watermarking en exports

```typescript
// En evd-pptx.service.ts
const pptx = new PptxGenJS();

// Metadata oculta (no visible en la presentación)
pptx.author = `The Forge EVD (License: ${licenseKey.slice(-8)})`;
pptx.subject = `Generated by The Forge — ${orgName}`;

// En evd-pdf.service.ts
// El HTML template incluye un comment invisible con el license key
<!-- LICENSE: ${licenseKey} | ORG: ${orgId} | DATE: ${new Date().toISOString()} -->
```

### 7.3 Fail-open vs Fail-closed

| Estrategia | Comportamiento | Riesgo |
|---|---|---|
| **Fail-open** | Si la validación online falla, el módulo sigue funcionando | Pierdes revenue por usuarios que desconectan internet |
| **Fail-closed** | Si la validación online falla, el módulo se desactiva | Pierdes usuarios legítimos con problemas de red |
| **Hybrid (recomendado)** | Fail-open hasta 7 días sin validación online. Luego fail-closed. | Balance entre UX y protección |

```typescript
// En el heartbeat loop
async heartbeat() {
  try {
    const result = await this.licenseService.onlineValidate(key, instanceId);
    if (!result.valid) {
      this.logger.warn(`License invalidated: ${result.message}`);
      this.featureFlags.disable('evd');
    }
    this.lastSuccessfulCheck = new Date();
  } catch (error) {
    const daysSinceCheck = differenceInDays(new Date(), this.lastSuccessfulCheck);
    if (daysSinceCheck > 7) {
      this.logger.error(`License check failed for ${daysSinceCheck} days — disabling EVD`);
      this.featureFlags.disable('evd');
    } else {
      this.logger.warn(`License check failed, retrying in 24h (${daysSinceCheck}/7 days)`);
    }
  }

  // Re-schedule
  setTimeout(() => this.heartbeat(), 24 * 60 * 60 * 1000);
}
```

---

## 8. Paquete npm `@theforge/evd`

### 8.1 Estructura del paquete

```
packages/evd/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # barrel export
│   ├── evd.module.ts               # DynamicModule
│   ├── evd.controller.ts           # REST endpoints
│   ├── evd-schema.ts               # Zod schema (compartido con frontend)
│   ├── services/
│   │   ├── evd-storage.service.ts
│   │   ├── evd-renderer.service.ts
│   │   ├── evd-chart.service.ts
│   │   ├── evd-diagram.service.ts
│   │   ├── evd-wireframe.service.ts
│   │   ├── evd-pptx.service.ts
│   │   ├── evd-pdf.service.ts
│   │   ├── evd-html.template.ts
│   │   └── evd-export.service.ts
│   ├── design/
│   │   ├── evd-design-system.ts
│   │   ├── evd-color.utils.ts
│   │   ├── evd-chart-theme.ts
│   │   ├── evd-mermaid-theme.ts
│   │   └── evd-typography.ts
│   └── prompts/
│       ├── evd-prompt.md
│       └── evd-prompt.ts
├── dist/                           # build output
└── README.md
```

### 8.2 package.json del módulo

```json
{
  "name": "@theforge/evd",
  "version": "1.0.0",
  "private": true,
  "license": "SEE LICENSE IN LICENSE.md",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./schema": {
      "import": "./dist/evd-schema.js",
      "types": "./dist/evd-schema.d.ts"
    }
  },
  "dependencies": {
    "@theforge/shared-types": "workspace:*",
    "@theforge/database": "workspace:*",
    "pptxgenjs": "^4.0.1",
    "echarts": "^5.6.0",
    "@mermaid-js/mermaid-cli": "^11.16.0",
    "puppeteer": "^25.0.0",
    "multer": "^1.4.5-lts.1",
    "zod": "^3.23.8"
  },
  "peerDependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@prisma/client": "^5.0.0"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "eslint src/"
  }
}
```

### 8.3 Registro en el host (The Forge core)

```typescript
// apps/api/src/app.module.ts

// Si el paquete está instalado, se carga. Si no, se ignora.
let evdModule: any[] = [];
try {
  const { EvdModule } = await import('@theforge/evd');
  if (config.get('FEATURE_EVD', 'false') === 'true') {
    evdModule = [EvdModule.register()];
  }
} catch {
  // @theforge/evd no instalado — módulo no disponible
}

@Module({
  imports: [
    // ... core modules ...
    ...evdModule,
  ],
})
export class AppModule {}
```

---

## 9. Modelo de Precios

### 9.1 Tiers propuestos

| Tier | Precio | Features incluidas | Target |
|---|---|---|---|
| **Free** | $0 | The Forge core: MDD, Spec, Blueprint, Tasks, Architecture, etc. | Individual developers, evaluación |
| **EVD Pro** | $29/mes o $290/año | EVD: generación + export PPTX/PDF + branding custom + 50 decks/mes | Freelancers, equipos pequeños |
| **EVD Enterprise** | $99/mes o $990/año | Todo Pro + white-label (sin marca The Forge) + API access + custom themes + unlimited decks | Agencias, consultoras, enterprises |
| **EVD Per-Project** | $49 one-time | EVD para 1 proyecto específico, 30 días de acceso | Evaluación sin compromiso |
| **Full Suite** | $149/mes o $1490/año | Todo EVD Enterprise + Legacy Flow + UI MCP + Audio + futuros módulos | The Forge completo |

### 9.2 Unit economics estimados

| Métrica | Estimación |
|---|---|
| Costo de desarrollo EVD | ~91h × $50/h = $4,550 (one-time) |
| Costo de infra licencias | ~$20/mes (server pequeño) |
| Break-even (EVD Pro) | ~160 suscriptores × $29/mes |
| Target year 1 | 500 suscriptores × $29 = $14,500/mes = $174K/año |
| Margen bruto | >95% (software digital) |

### 9.3 Estrategia de pricing

| Decisión | Opción recomendada | Razón |
|---|---|---|
| Free trial | 14 días o 5 decks, sin tarjeta | Reducir fricción de adopción |
| Descuento anual | 2 meses gratis (290 vs 348) | Incentivar commitment anual |
| Startup program | 50% off para <10 empleados | Captar early adopters |
| Referral | 1 mes gratis por referral | Growth orgánico |
| grandfather clause | Usuarios actuales mantienen precio al subir | Retención |

---

## 10. Features futuras como módulos

El sistema de modularización no es solo para EVD. Es la base para todo el roadmap:

| Módulo | Descripción | Pricing sugerido | Prioridad |
|---|---|---|---|
| **@theforge/evd** | Executive Vision Deck | $29-99/mes | Ya planificado |
| **@theforge/legacy** | Legacy flow completo (codebase analysis, brownfield) | $49-149/mes | Alto |
| **@theforge/uimcp** | UI MCP server (graphic prototypes, Storybook) | $29-79/mes | Medio |
| **@theforge/audio** | Audio transcription para brainstorming | $9-19/mes | Bajo |
| **@theforge/design-ref** | Design reference extractor | Incluido en core | — |
| **@theforge/collab** | Multi-user real-time collaboration | $39-99/mes | Futuro |
| **@theforge/analytics** | Project analytics dashboard | $19-49/mes | Futuro |
| **@theforge/ci** | CI/CD integration (GitHub Actions, GitLab CI) | $29-79/mes | Futuro |

---

## 11. Decisiones pendientes

| # | Pregunta | Opciones | Recomendación |
|---|---|---|---|
| 1 | ¿Licencia online o offline-first? | A: Online-first / B: Offline-first con heartbeat | **B**: Offline-first, validación online cada 24h. Fail-open 7 días |
| 2 | ¿Server de licencias propio o servicio externo? | A: Propio (simple API) / B: LemonSqueezy, Paddle, etc. | **A propio** para control total; migrar a servicio externo cuando escale |
| 3 | ¿npm registry privado o tarball directo? | A: GitHub Packages / B: npm private / C: Tarball + .env | **C**: Tarball para early stage. Migrar a GitHub Packages después |
| 4 | ¿Vincular a instancia o a org? | A: Instance (Docker ID) / B: Org (múltiples instancias) | **B: Org** — una licencia, múltiples devs en la misma org |
| 5 | ¿Open source core? | A: Core open + modules privados / B: Todo privado | **A**: Core open genera trust y comunidad. Módulos de valor = monetización |
| 6 | ¿Cuándo implementar licenciamiento? | A: Antes de EVD / B: Después de EVD funcional | **B**: Primero prototipo funcional, luego licenciar. No bloquear desarrollo |
| 7 | ¿Cobrar por EVD standalone o solo en suite? | A: Solo suite / B: Standalone + suite / C: Solo standalone | **B**: Standalone captura quien solo necesita EVD. Suite ofrece descuento |

---

## 12. Roadmap de implementación

```
Fase 1: Prototipo EVD (sin licenciamiento)
├── PLAN_EVD.md: fases 1-14 (~91h)
├── Resultado: EVD funcional en The Forge
└── Timeline: 3-4 semanas

Fase 2: Infraestructura de licenciamiento (post-prototipo)
├── @theforge/license package (~8h)
├── Feature flags service (~6h)
├── Dynamic module loading (~6h)
├── Server de licencias básico (~12h)
├── Frontend gating (~4h)
└── Timeline: 1-2 semanas

Fase 3: Monetización (post-licenciamiento)
├── Stripe/Paddle integration (~8h)
├── Landing page con pricing (~8h)
├── Email de onboarding (~4h)
├── Analytics de uso (~4h)
└── Timeline: 1-2 semanas

Total hasta monetización: ~6-8 semanas
```

---

## 13. Referencias

### Arquitectura
- [NestJS Dynamic Modules](https://docs.nestjs.com/fundamentals/dynamic-modules)
- [Feature Flags patterns](https://martinfowler.com/articles/feature-toggles.html)
- [Monorepo con pnpm workspaces](https://pnpm.io/workspaces)

### Licenciamiento
- [Software licensing patterns](https://en.wikipedia.org.software_license)
- [LemonSqueezy (merchant of record)](https://www.lemonsqueezy.com/)
- [Paddle (merchant of record)](https://www.paddle.com/)
- [Keygen (license API)](https://keygen.sh/)

### Pricing
- [SaaS pricing strategies](https://www.openviewpartners.com/blog/saas-pricing-models/)
- [Value-based pricing for developer tools](https://www.levels.io/blog/pricing-developer-tools)
