/**
 * Inference Engine: genera tareas automáticamente desde operations.json + types.json.
 * Implementa los patrones de inferencia definidos en lean-sdd-inference-patterns.md.
 */

import { MddTypesJson, MddEntity } from "../mdd-extractors/types-extractor.js";
import {
  MddOperationsJson,
  EntityOperation,
  ApiRoute,
  InferenceSettings,
} from "../mdd-extractors/operations-extractor.js";
import { ParsedTaskV2 } from "./tasks-parser-v2.js";

export interface InferredTask {
  task: ParsedTaskV2;
  rule: string; // qué patrón de inferencia generó esta tarea
  reason: string; // explicación de por qué se infirió
  confidence: number; // 0-1
}

export interface InferenceResult {
  inferredTasks: InferredTask[];
  warnings: string[];
  coverage: {
    entities: number;
    tasksExplicit: number;
    tasksInferred: number;
    coveragePercent: number;
  };
}

export interface InferenceContext {
  typesJson: MddTypesJson;
  operationsJson: MddOperationsJson;
  existingTasks: ParsedTaskV2[];
  stage: string;
}

// ---- Motor principal ----

export function inferTasks(context: InferenceContext): InferenceResult {
  const inferred: InferredTask[] = [];
  const warnings: string[] = [];
  const settings = context.operationsJson.inferenceSettings;

  for (const op of context.operationsJson.operations) {
    const tasksForEntity = inferTasksForEntity(op, context, settings);
    inferred.push(...tasksForEntity);
  }

  // Verificar cobertura
  const explicitIds = new Set(context.existingTasks.map((t) => t.id));
  const inferredOnly = inferred.filter((i) => !explicitIds.has(i.task.id));

  return {
    inferredTasks: inferredOnly,
    warnings: dedupeWarnings(warnings),
    coverage: {
      entities: context.operationsJson.operations.length,
      tasksExplicit: context.existingTasks.length,
      tasksInferred: inferredOnly.length,
      coveragePercent: Math.round(
        ((context.existingTasks.length + inferredOnly.length) /
          (context.operationsJson.operations.length * 12)) * 100,
      ),
    },
  };
}

// ---- Inferencia por entidad ----

function inferTasksForEntity(
  op: EntityOperation,
  context: InferenceContext,
  settings: InferenceSettings,
): InferredTask[] {
  const tasks: InferredTask[] = [];
  const entity = context.typesJson.entities.find((e) => e.name === op.entity);
  const plural = toPlural(op.entity);
  const hasSoftDelete = op.overrides?.softDelete ?? false;
  const isReadOnly = op.type === "read-only";

  // No inferir si está desactivado
  if (op.overrides?.crudAuto === false) {
    return tasks;
  }

  if (isReadOnly) {
    // Solo inferir lectura
    tasks.push(makeTask(op, entity, "INF-002A", `read-only-${plural}`, 0.95, {
      id: `${op.entity}-R00`,
      title: `Crear modelo Prisma para ${op.entity}`,
      changeType: "create",
      targetFiles: [`packages/database/schema.prisma`],
      language: "prisma",
      entity: op.entity,
      operations: ["read"],
      codeExpected: generatePrismaModel(entity, hasSoftDelete),
      inferenceRules: ["crud-auto", hasSoftDelete ? "soft-delete" : ""].filter(Boolean),
    }));

    tasks.push(makeTask(op, entity, "INF-002B", `read-only-${plural}`, 0.95, {
      id: `${op.entity}-R01`,
      title: `Crear endpoint GET /${plural}`,
      changeType: "create",
      targetFiles: [`src/${plural}/${plural}.controller.ts`],
      language: "typescript",
      entity: op.entity,
      operations: ["list"],
      inferenceRules: ["crud-auto", "pagination-default"],
    }));

    return tasks;
  }

  // INF-001: CRUD completo (backend)
  // -------------------------------------------------

  // T-00: Modelo Prisma
  tasks.push(makeTask(op, entity, "INF-001", `crud-${plural}`, 0.99, {
    id: `${op.entity}-B00`,
    title: `Crear modelo Prisma ${op.entity}`,
    changeType: "create",
    targetFiles: [`packages/database/schema.prisma`],
    language: "prisma",
    dependency: [],
    entity: op.entity,
    operations: ["create"],
    codeExpected: generatePrismaModel(entity, hasSoftDelete),
    inferenceRules: ["crud-auto", hasSoftDelete ? "soft-delete" : ""].filter(Boolean),
  }));

  // T-01: DTO Create
  tasks.push(makeTask(op, entity, "INF-001", `crud-${plural}`, 0.98, {
    id: `${op.entity}-B01`,
    title: `Crear DTO Create${op.entity}Dto (Zod)`,
    changeType: "create",
    targetFiles: [`src/${plural}/dto/create-${plural}.dto.ts`],
    language: "typescript",
    dependencies: [`${op.entity}-B00`],
    entity: op.entity,
    operations: ["create"],
    codeExpected: generateZodDto(entity, "create"),
    inferenceRules: ["crud-auto", "zod-auto"],
  }));

  // T-02: DTO Update
  tasks.push(makeTask(op, entity, "INF-001", `crud-${plural}`, 0.98, {
    id: `${op.entity}-B02`,
    title: `Crear DTO Update${op.entity}Dto (Zod)`,
    changeType: "create",
    targetFiles: [`src/${plural}/dto/update-${plural}.dto.ts`],
    language: "typescript",
    dependencies: [`${op.entity}-B01`],
    entity: op.entity,
    operations: ["update"],
    codeExpected: generateZodDto(entity, "update"),
    inferenceRules: ["crud-auto", "zod-auto"],
  }));

  // T-03: DTO Response
  tasks.push(makeTask(op, entity, "INF-001", `crud-${plural}`, 0.98, {
    id: `${op.entity}-B03`,
    title: `Crear DTO ${op.entity}Response`,
    changeType: "create",
    targetFiles: [`src/${plural}/dto/${plural}-response.dto.ts`],
    language: "typescript",
    dependencies: [`${op.entity}-B00`],
    entity: op.entity,
    operations: ["read"],
    codeExpected: generateResponseDto(entity),
    inferenceRules: ["crud-auto"],
  }));

  // T-04: Interface TypeScript
  tasks.push(makeTask(op, entity, "INF-001", `crud-${plural}`, 0.95, {
    id: `${op.entity}-B04`,
    title: `Crear interface TypeScript ${op.entity}`,
    changeType: "create",
    targetFiles: [`packages/shared-types/src/models/${plural}.model.ts`],
    language: "typescript",
    dependencies: [`${op.entity}-B00`],
    entity: op.entity,
    operations: ["create", "read", "update", "delete", "list"],
    codeExpected: generateInterface(entity, hasSoftDelete),
    inferenceRules: ["crud-auto"],
  }));

  // T-05: Service
  tasks.push(makeTask(op, entity, "INF-001", `crud-${plural}`, 0.97, {
    id: `${op.entity}-B05`,
    title: `Crear ${op.entity}Service (CRUD)`,
    changeType: "create",
    targetFiles: [`src/${plural}/${plural}.service.ts`],
    language: "typescript",
    dependencies: [`${op.entity}-B01`, `${op.entity}-B02`, `${op.entity}-B04`],
    parallel: true,
    entity: op.entity,
    operations: ["create", "read", "update", "delete", "list"],
    codeExpected: generateService(entity, hasSoftDelete, settings),
    inferenceRules: ["crud-auto", hasSoftDelete ? "soft-delete" : "", "pagination-default"].filter(Boolean),
  }));

  // T-06: Controller
  tasks.push(makeTask(op, entity, "INF-001", `crud-${plural}`, 0.97, {
    id: `${op.entity}-B06`,
    title: `Crear ${op.entity}Controller (REST)`,
    changeType: "create",
    targetFiles: [`src/${plural}/${plural}.controller.ts`],
    language: "typescript",
    dependencies: [`${op.entity}-B05`, `${op.entity}-B03`],
    entity: op.entity,
    operations: ["create", "read", "update", "delete", "list"],
    codeExpected: generateController(entity, op.routes, hasSoftDelete),
    inferenceRules: ["crud-auto", hasSoftDelete ? "soft-delete" : "", "rbac-auto"].filter(Boolean),
  }));

  // T-07: Module
  tasks.push(makeTask(op, entity, "INF-001", `crud-${plural}`, 0.95, {
    id: `${op.entity}-B07`,
    title: `Crear módulo NestJS ${op.entity}Module`,
    changeType: "create",
    targetFiles: [`src/${plural}/${plural}.module.ts`],
    language: "typescript",
    dependencies: [`${op.entity}-B06`],
    entity: op.entity,
    operations: ["create", "read", "update", "delete", "list"],
    codeExpected: generateModule(entity),
    inferenceRules: ["crud-auto"],
  }));

  // T-08: Unit tests Service
  tasks.push(makeTask(op, entity, "INF-010", `test-${plural}`, 0.93, {
    id: `${op.entity}-B08`,
    title: `Tests unitarios para ${op.entity}Service`,
    changeType: "create",
    targetFiles: [`src/${plural}/${plural}.service.spec.ts`],
    language: "typescript",
    dependencies: [`${op.entity}-B05`],
    entity: op.entity,
    operations: ["create", "read", "update", "delete"],
    codeExpected: generateUnitTests(entity),
    inferenceRules: ["crud-auto", "jest-auto"],
  }));

  // T-09: E2E tests Controller
  tasks.push(makeTask(op, entity, "INF-010", `test-${plural}`, 0.93, {
    id: `${op.entity}-B09`,
    title: `Tests e2e para ${op.entity}Controller`,
    changeType: "create",
    targetFiles: [`test/${plural}.e2e-spec.ts`],
    language: "typescript",
    dependencies: [`${op.entity}-B06`],
    entity: op.entity,
    operations: ["create", "read", "update", "delete", "list"],
    codeExpected: generateE2ETests(entity, op.routes),
    inferenceRules: ["crud-auto", "jest-auto"],
  }));

  // INF-008: Frontend automático
  // -------------------------------------------------
  if (op.frontend?.admin || op.frontend?.public) {
    // T-10: Hook useX
    tasks.push(makeTask(op, entity, "INF-008", `frontend-${plural}`, 0.95, {
      id: `${op.entity}-F00`,
      title: `Crear hook use${op.entity} (TanStack Query)`,
      changeType: "create",
      targetFiles: [`apps/web/src/hooks/use${op.entity}.ts`],
      language: "typescript",
      dependencies: [`${op.entity}-B06`],
      parallel: true,
      entity: op.entity,
      operations: ["create", "read", "update", "delete", "list"],
      codeExpected: generateReactQueryHooks(entity, op.routes, settings),
      inferenceRules: ["crud-auto", "frontend-auto", "react-query"],
    }));

    // T-11: Página Lista
    const listPage = op.frontend.pages.find((p) => p.dataTable);
    if (listPage) {
      tasks.push(makeTask(op, entity, "INF-008", `frontend-${plural}`, 0.94, {
        id: `${op.entity}-F01`,
        title: `Crear ${op.entity}ListPage (DataTable)`,
        changeType: "create",
        targetFiles: [listPage.route.replace(":", "").replace("/", "") + ".tsx"],
        language: "typescript",
        dependencies: [`${op.entity}-F00`],
        parallel: true,
        entity: op.entity,
        operations: ["list"],
        codeExpected: generateListPage(entity, settings),
        inferenceRules: ["crud-auto", "frontend-auto", "pagination-default"],
      }));
    }

    // T-12: Página Form (Create/Edit)
    const formPage = op.frontend.pages.find((p) => p.form);
    if (formPage) {
      tasks.push(makeTask(op, entity, "INF-008", `frontend-${plural}`, 0.94, {
        id: `${op.entity}-F02`,
        title: `Crear ${op.entity}FormPage`,
        changeType: "create",
        targetFiles: [formPage.route.replace(":", "").replace("/", "") + ".tsx"],
        language: "typescript",
        dependencies: [`${op.entity}-F00`, `${op.entity}-B01`],
        parallel: true,
        entity: op.entity,
        operations: ["create", "update"],
        codeExpected: generateFormPage(entity, settings),
        inferenceRules: ["crud-auto", "frontend-auto", "react-hook-form"],
      }));
    }
  }

  return tasks;
}

// ---- Generadores de código (plantillas) ----

function generatePrismaModel(entity: MddEntity | undefined, hasSoftDelete: boolean): string {
  if (!entity) return "";
  const fields = entity.fields
    .map((f) => {
      const prismaType = mapToPrismaType(f.type, f.nullable);
      const attrs: string[] = [];
      if (f.name === "id" && f.type === "UUID") attrs.push("@id @default(uuid())");
      if (f.nullable) attrs.push("?");
      if (f.default && !f.nullable) attrs.push(`@default(${f.default})`);
      if (f.name === "createdAt") attrs.push("@default(now())");
      if (f.name === "updatedAt") attrs.push("@updatedAt");
      return `  ${f.name} ${prismaType}${attrs.join(" ")}`;
    })
    .join("\n");

  return `model ${entity.name} {\n${fields}\n\n  @@map("${entity.table}")\n}`;
}

function generateZodDto(entity: MddEntity | undefined, mode: "create" | "update"): string {
  if (!entity) return "";
  const fields = entity.fields
    .filter((f) => !f.name.endsWith("At") && f.name !== "id" && f.name !== "createdBy" && f.name !== "updatedBy")
    .map((f) => {
      let schema = f.zodSchema ?? "z.string()";
      if (mode === "update" && !f.nullable) schema = `.optional()`;
      return `  ${f.name}: ${schema},`;
    })
    .join("\n");

  const suffix = mode === "create" ? "Create" : "Update";
  return `export const ${suffix}${entity.name}Schema = z.object({\n  id: z.string().uuid().optional(),\n${fields}\n});`;
}

function generateResponseDto(entity: MddEntity | undefined): string {
  if (!entity) return "";
  const fields = entity.fields
    .filter((f) => f.name !== "password")
    .map((f) => `  ${f.name}: ${f.tsType ?? "string"},`)
    .join("\n");
  return `export interface ${entity.name}Response {\n${fields}\n}`;
}

function generateInterface(entity: MddEntity | undefined, hasSoftDelete: boolean): string {
  if (!entity) return "";
  const fields = entity.fields.map((f) => {
    const ts = f.tsType ?? "string";
    return `  ${f.name}: ${f.nullable ? `${ts} | null` : ts};`;
  });

  if (hasSoftDelete) fields.push(`  deletedAt?: Date | null;`);

  return `export interface ${entity.name} {\n${fields.join("\n")}\n}`;
}

function generateService(
  entity: MddEntity | undefined,
  hasSoftDelete: boolean,
  settings: InferenceSettings,
): string {
  if (!entity) return "";
  const name = entity.name;
  const lower = name.toLowerCase();
  const pagination = settings.defaults.pagination;

  return `
@Injectable()
export class ${name}Service {
  constructor(private prisma: PrismaService) {}

  async create(dto: Create${name}Dto) {
    return this.prisma.${lower}.create({ data: dto });
  }

  async findAll(cursor?: string, limit = ${settings.defaults.pageSize}) {
    return this.prisma.${lower}.findMany({
      ${hasSoftDelete ? 'where: { deletedAt: null },' : ""}
      take: limit + 1,
      ${pagination === "cursor" ? "cursor: cursor ? { id: cursor } : undefined," : "skip: cursor ? parseInt(cursor) : 0,"}
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.${lower}.findFirst({
      where: { id${hasSoftDelete ? ", deletedAt: null" : ""} },
    });
    if (!item) throw new NotFoundException('${name} not found');
    return item;
  }

  async update(id: string, dto: Update${name}Dto) {
    await this.findOne(id);
    return this.prisma.${lower}.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    ${hasSoftDelete
      ? `return this.prisma.${lower}.update({ where: { id }, data: { deletedAt: new Date() } });`
      : `return this.prisma.${lower}.delete({ where: { id } });`}
  }
}
`.trim();
}

function generateController(
  entity: MddEntity | undefined,
  routes: ApiRoute[],
  hasSoftDelete: boolean,
): string {
  if (!entity) return "";
  const name = entity.name;
  const lower = name.toLowerCase();
  const plural = toPlural(name);

  return `
@Controller('${plural}')
export class ${name}Controller {
  constructor(private readonly service: ${name}Service) {}

${routes
  .map((r) => {
    const decorators: string[] = [`@${r.method}('${r.path.replace(`/${plural}`, "").replace(/:(\w+)/g, ":$1")}')`];
    if (r.auth && r.auth.length > 0) decorators.push(`@Roles(${r.auth.map((a) => `'${a}'`).join(", ")})`);
    if (r.auth?.includes("self")) decorators.push(`@SelfOrAdmin()`);

    const methodName = r.action + name;
    const params = r.params ? r.params.map((p) => `@Param('${p}') ${p}: string`).join(", ") : "";
    const bodyParam = r.body ? `, @Body() dto: ${r.body}` : "";
    return `  ${decorators.join("\n  ")}\n  ${methodName}(${params}${bodyParam}) {\n    // implementation\n  }`;
  })
  .join("\n\n")}
}
`.trim();
}

function generateModule(entity: MddEntity | undefined): string {
  if (!entity) return "";
  return `
@Module({
  controllers: [${entity.name}Controller],
  providers: [${entity.name}Service],
})
export class ${entity.name}Module {}
`.trim();
}

function generateUnitTests(entity: MddEntity | undefined): string {
  if (!entity) return "";
  return `
describe('${entity.name}Service', () => {
  it('should create', () => { /* TODO */ });
  it('should find all', () => { /* TODO */ });
  it('should find one', () => { /* TODO */ });
  it('should update', () => { /* TODO */ });
  it('should remove', () => { /* TODO */ });
});
`.trim();
}

function generateE2ETests(entity: MddEntity | undefined, routes: ApiRoute[]): string {
  if (!entity) return "";
  return routes
    .map((r) => `describe('${r.method} ${r.path}', () => { it('should work', () => { /* TODO */ }); });`)
    .join("\n");
}

function generateReactQueryHooks(
  entity: MddEntity | undefined,
  routes: ApiRoute[],
  settings: InferenceSettings,
): string {
  if (!entity) return "";
  return `
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Create${entity.name}Dto, Update${entity.name}Dto } from '../types/${entity.name.toLowerCase()}';

export function use${entity.name}List(cursor?: string, search?: string) {
  return useQuery({ queryKey: ['${entity.name.toLowerCase()}', cursor, search], queryFn: () => api.get('${toPlural(entity.name)}', { params: { cursor, q: search } }).then(r => r.data) });
}

export function use${entity.name}ById(id: string) {
  return useQuery({ queryKey: ['${entity.name.toLowerCase()}', id], queryFn: () => api.get('${toPlural(entity.name)}/${id}').then(r => r.data) });
}

export function useCreate${entity.name}() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (dto: Create${entity.name}Dto) => api.post('${toPlural(entity.name)}', dto), onSuccess: () => qc.invalidateQueries({ queryKey: ['${entity.name.toLowerCase()}'] }) });
}

export function useUpdate${entity.name}() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, dto }: { id: string; dto: Update${entity.name}Dto }) => api.patch('${toPlural(entity.name)}/${id}', dto), onSuccess: () => qc.invalidateQueries({ queryKey: ['${entity.name.toLowerCase()}'] }) });
}

export function useDelete${entity.name}() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete('${toPlural(entity.name)}/${id}'), onSuccess: () => qc.invalidateQueries({ queryKey: ['${entity.name.toLowerCase()}'] }) });
}
`.trim();
}

function generateListPage(entity: MddEntity | undefined, settings: InferenceSettings): string {
  if (!entity) return "";
  return `// ${entity.name}ListPage with DataTable + pagination + search`;
}

function generateFormPage(entity: MddEntity | undefined, settings: InferenceSettings): string {
  if (!entity) return "";
  return `// ${entity.name}FormPage with react-hook-form + zod`;
}

// ---- Utilidades ----

function makeTask(
  _op: EntityOperation,
  _entity: MddEntity | undefined,
  rule: string,
  reason: string,
  confidence: number,
  overrides: Partial<ParsedTaskV2> & { id: string; title: string; changeType: ParsedTaskV2["changeType"]; targetFiles: string[] },
): InferredTask {
  return {
    task: {
      id: overrides.id,
      title: overrides.title,
      description: overrides.title,
      changeType: overrides.changeType,
      targetFiles: overrides.targetFiles,
      language: overrides.language ?? "typescript",
      dependencies: overrides.dependencies ?? [],
      parallel: overrides.parallel ?? false,
      estimatedMinutes: overrides.estimatedMinutes ?? 15,
      entity: overrides.entity,
      operations: overrides.operations ?? [],
      codeExpected: overrides.codeExpected ?? undefined,
      inferenceRules: overrides.inferenceRules ?? [],
      typeContext: overrides.typeContext,
      verification: overrides.verification ?? {},
      section: overrides.section ?? "Backend",
      checkpoint: overrides.checkpoint ?? "CRUD",
      rawMarkdown: JSON.stringify(overrides),
    },
    rule,
    reason,
    confidence,
  };
}

function mapToPrismaType(mddType: string, nullable?: boolean): string {
  const map: Record<string, string> = {
    UUID: "String",
    EMAIL: "String",
    STRING: "String",
    TEXT: "String",
    INT: "Int",
    BIGINT: "BigInt",
    FLOAT: "Float",
    DECIMAL: "Decimal",
    BOOLEAN: "Boolean",
    TIMESTAMP: "DateTime",
    TIMESTAMP_NULLABLE: "DateTime",
    JSON: "Json",
    URL: "String",
    PASSWORD: "String",
    SLUG: "String",
    ENUM: "String",
  };
  return (map[mddType] ?? "String") + (nullable ? "?" : "");
}

function toPlural(singular: string): string {
  if (singular.endsWith("y") && !singular.endsWith("ay")) return singular.slice(0, -1) + "ies";
  if (/[sxz]$/.test(singular) || singular.endsWith("ch") || singular.endsWith("sh")) return singular + "es";
  return singular + "s";
}

function dedupeWarnings(arr: string[]): string[] {
  return [...new Set(arr)];
}

// Patrones disponibles (exportados para referencia)
export const INFERENCE_RULES = [
  { id: "INF-001", name: "crud-auto", description: "Genera CRUD completo por entidad" },
  { id: "INF-002", name: "soft-delete", description: "DELETE lógico via deletedAt" },
  { id: "INF-003", name: "pagination-default", description: "Cursor pagination en LIST" },
  { id: "INF-004", name: "search-auto", description: "Fulltext search en campos marcados" },
  { id: "INF-005", name: "rbac-auto", description: "Verificación de roles en endpoints mutantes" },
  { id: "INF-006", name: "zod-auto", description: "Validación con Zod schemas" },
  { id: "INF-007", name: "types-auto", description: "Interfaces TypeScript automáticas" },
  { id: "INF-008", name: "frontend-auto", description: "Páginas admin por entidad" },
  { id: "INF-009", name: "audit-auto", description: "Campos createdAt/updatedAt automáticos" },
  { id: "INF-010", name: "jest-auto", description: "Tests automáticos por función pública" },
];

export default {
  inferTasks,
  inferTasksForEntity,
  INFERENCE_RULES,
};
