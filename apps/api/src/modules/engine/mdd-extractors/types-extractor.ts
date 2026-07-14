/**
 * Extractor de types.json desde MDD §3 (Modelo de Datos).
 * Toma el markdown de la sección 3 del MDD y produce un types.json
 * estructurado con entidades, campos, validaciones y relaciones.
 */

export interface MddField {
  name: string;
  type: string;
  dbType?: string;
  tsType?: string;
  zodSchema?: string;
  nullable?: boolean;
  default?: string;
  description?: string;
  validators?: string[];
  enumValues?: string[];
  searchable?: boolean;
  sortable?: boolean;
  flags?: string[];
}

export interface MddEntity {
  name: string;
  table?: string;
  description?: string;
  fields: MddField[];
  indexes?: Array<{ fields: string[]; type?: string; unique?: boolean; order?: string }>;
  relations?: Array<{
    type: "hasMany" | "belongsTo" | "hasOne" | "manyToMany";
    target: string;
    field: string;
    inverse?: string;
  }>;
  flags?: string[]; // e.g., "auditable", "soft_deletable", "searchable"
}

export interface MddEnum {
  name: string;
  values: string[];
}

export interface MddTypesJson {
  version: string;
  source: string;
  entities: MddEntity[];
  enums: MddEnum[];
  generatedAt: string;
}

/**
 * Diccionario de mapeo tipo MDD → TypeScript + Zod.
 * Extiende este mapa según stacks soportados.
 */
const TYPE_MAP: Record<string, { ts: string; zod: string; db: string }> = {
  UUID: { ts: "string", zod: "z.string().uuid()", db: "uuid" },
  EMAIL: { ts: "string", zod: "z.string().email()", db: "varchar(255)" },
  STRING: { ts: "string", zod: "z.string().min(1).max(255)", db: "varchar(255)" },
  TEXT: { ts: "string", zod: "z.string().min(1)", db: "text" },
  INT: { ts: "number", zod: "z.number().int()", db: "int" },
  BIGINT: { ts: "bigint", zod: "z.bigint()", db: "bigint" },
  FLOAT: { ts: "number", zod: "z.number()", db: "double precision" },
  DECIMAL: { ts: "number", zod: "z.number()", db: "decimal" },
  BOOLEAN: { ts: "boolean", zod: "z.boolean()", db: "boolean" },
  TIMESTAMP: { ts: "Date", zod: "z.date()", db: "timestamptz" },
  TIMESTAMP_NULLABLE: { ts: "Date | null", zod: "z.date().nullable()", db: "timestamptz" },
  JSON: { ts: "Record<string, unknown>", zod: "z.record(z.unknown())", db: "jsonb" },
  URL: { ts: "string", zod: "z.string().url()", db: "varchar(2048)" },
  PASSWORD: { ts: "string", zod: "z.string().min(8)", db: "varchar(255)" },
  SLUG: { ts: "string", zod: "z.string().regex(/^[a-z0-9-]+$/)", db: "varchar(100)" },
  ENUM: { ts: "string", zod: "z.enum([VALUES])", db: "varchar(50)" },
};

function inferTsType(mddType: string, nullable?: boolean, enumValues?: string[]): string {
  const mapped = TYPE_MAP[mddType];
  const base = mapped?.ts ?? "unknown";
  if (nullable) {
    return base.includes("null") ? base : `${base} | null`;
  }
  if (mddType === "ENUM" && enumValues?.length) {
    return enumValues.map((v) => `"${v}"`).join(" | ");
  }
  return base;
}

function inferZodSchema(mddType: string, field: Partial<MddField>): string {
  const mapped = TYPE_MAP[mddType];
  let base = mapped?.zod ?? "z.unknown()";

  if (mddType === "ENUM" && field.enumValues?.length) {
    base = `z.enum([${field.enumValues.map((v) => `"${v}"`).join(", ")}])`;
  }

  if (field.nullable) {
    if (!base.endsWith(".nullable()")) base += ".nullable()";
  }

  // Añadir default si existe
  if (field.default && base !== "z.unknown()") {
    if (mddType === "INT" || mddType === "FLOAT" || mddType === "DECIMAL") {
      base += `.default(${field.default})`;
    } else if (mddType !== "TIMESTAMP" && mddType !== "TIMESTAMP_NULLABLE") {
      base += `.default("${field.default}")`;
    }
  }

  return base;
}

function inferDbType(mddType: string): string {
  return TYPE_MAP[mddType]?.db ?? "text";
}

/**
 * Extrae entidades desde el markdown de MDD §3.
 * Parsea tablas markdown y bloques de descripción.
 */
export function extractTypesFromMddSection3(section3Markdown: string): MddTypesJson {
  const entities: MddEntity[] = [];
  const enums: MddEnum[] = [];

  // Heurística: buscar bloques que empiezan con ### NombreEntidad
  const entityBlocks = splitIntoEntityBlocks(section3Markdown);

  for (const block of entityBlocks) {
    const entity = parseEntityBlock(block);
    if (entity) {
      entities.push(entity);
      // Registrar enums implícitos
      for (const field of entity.fields) {
        if (field.enumValues && field.enumValues.length > 0) {
          const enumName = `${entity.name}${capitalize(field.name)}`;
          if (!enums.find((e) => e.name === enumName)) {
            enums.push({ name: enumName, values: field.enumValues });
          }
        }
      }
    }
  }

  return {
    version: "1.0",
    source: "mdd-section-3-extracted",
    entities,
    enums,
    generatedAt: new Date().toISOString(),
  };
}

function splitIntoEntityBlocks(md: string): string[] {
  const blocks: string[] = [];
  const lines = md.split("\n");
  let currentBlock: string[] = [];
  let inBlock = false;

  for (const line of lines) {
    // Detectar inicio de entidad: ### Nombre o **Nombre** seguido de tabla
    if (/^#{2,3}\s+\*?\*?([A-Za-z][A-Za-z0-9_]*)\*?\*?\s*$/.test(line) || /^\*\*([A-Za-z][A-Za-z0-9_]*)\*\*\s*$/.test(line)) {
      if (inBlock && currentBlock.length) {
        blocks.push(currentBlock.join("\n"));
      }
      currentBlock = [line];
      inBlock = true;
    } else if (inBlock) {
      currentBlock.push(line);
    }
  }

  if (inBlock && currentBlock.length) {
    blocks.push(currentBlock.join("\n"));
  }

  return blocks;
}

function parseEntityBlock(block: string): MddEntity | null {
  // Extraer nombre de entidad
  const nameMatch = block.match(/^#{2,3}\s+\*?\*?([A-Za-z][A-Za-z0-9_]*)\*?\*?/m) || block.match(/^\*\*([A-Za-z][A-Za-z0-9_]*)\*\*\s*$/m);
  if (!nameMatch) return null;

  const name = nameMatch[1];
  const description = block.split("\n").slice(1).find((l) => l.trim() && !l.startsWith("|") && !l.startsWith("-"))?.trim();

  // Extraer tabla markdown de campos
  const fields = extractFieldsFromTable(block);

  // Detectar flags de entidad
  const flags: string[] = [];
  if (fields.some((f) => f.name === "deletedAt" && f.nullable)) flags.push("soft_deletable");
  if (fields.some((f) => f.name === "createdAt")) flags.push("auditable");
  if (block.toLowerCase().includes("searchable") || fields.some((f) => f.searchable)) flags.push("searchable");

  // Extraer relaciones (heurística básica)
  const relations = extractRelationsFromBlock(block, name);

  return {
    name,
    table: toSnakeCase(name) + "s", // heurística pluralización
    description,
    fields: fields.map((f) => ({
      ...f,
      tsType: f.tsType ?? inferTsType(f.type, f.nullable, f.enumValues),
      zodSchema: f.zodSchema ?? inferZodSchema(f.type, f),
      dbType: f.dbType ?? inferDbType(f.type),
    })),
    relations,
    flags,
  };
}

interface RawField {
  name: string;
  type: string;
  nullable?: boolean;
  default?: string;
  description?: string;
  enumValues?: string[];
  searchable?: boolean;
  sortable?: boolean;
  flags?: string[];
  tsType?: string;
  zodSchema?: string;
  dbType?: string;
}

function extractFieldsFromTable(block: string): RawField[] {
  const fields: RawField[] = [];
  const lines = block.split("\n").map((l) => l.trimEnd());

  // Buscar header de tabla markdown
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith("|") && l.endsWith("|") && /campo|field|nombre|name|columna/.test(l.toLowerCase())) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0 || headerIdx + 1 >= lines.length) return fields;

  // Validar separador markdown
  const sep = lines[headerIdx + 1].trim();
  if (!sep.startsWith("|") || !sep.endsWith("|") || !sep.includes("-")) return fields;

  // Extraer celdas del header (sin pipes externos)
  const headerCells = lines[headerIdx].trim().slice(1, -1).split("|").map((h) => h.trim().toLowerCase());

  // Iterar filas de body
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("|") || !line.endsWith("|")) break;
    const cells = line.slice(1, -1).split("|").map((c) => c.trim());
    if (cells.length < 2) continue;

    // Mapeo por nombre de columna (flexible)
    const getCell = (possibleNames: string[]) => {
      for (const name of possibleNames) {
        const idx = headerCells.indexOf(name);
        if (idx >= 0 && idx < cells.length) return cells[idx];
      }
      return "";
    };

    const fieldName = getCell(["campo", "field", "nombre", "name", "columna"]).replace(/\*\*/g, "").trim();
    const typeName = getCell(["tipo", "type", "db type", "data type", "sql type"]).trim();
    const constraints = getCell(["constraints", "restricciones", "mods", "modifiers", "constraint"]).toLowerCase();
    const desc = getCell(["descripción", "description", "desc", "comentario", "notes"]);

    if (!fieldName) continue;

    // Detectar tipo MDD desde el tipo SQL o nombre
    const detectedType = detectMddType(typeName, fieldName, constraints);

    // Detectar nullable
    const nullable = constraints.includes("null") && !constraints.includes("not null");

    // Detectar default
    const defaultMatch = constraints.match(/default\s+(.+)/i);
    const defaultValue = defaultMatch?.[1]?.trim();

  // Detectar enum (explícito o implícito desde descripción)
    const enumMatch = typeName.match(/enum\(([^)]+)\)/i) || constraints.match(/enum\(([^)]+)\)/i);
    let enumValues: string[] | undefined = enumMatch
      ? enumMatch[1].split(",").map((v) => v.trim().replace(/["'] /g, ""))
      : undefined;

    // Inferir enum implícito desde descripción cuando el tipo es corto y la descripción lista valores
    if (!enumValues && desc && (typeName.toLowerCase().startsWith("varchar") || typeName.toLowerCase().startsWith("text"))) {
      const parts = desc
        .split(/,\s*/)
        .map((v) => v.trim())
        .filter((v) => v.length > 0 && v.length < 30 && !v.includes(" "));
      if (parts.length >= 2) {
        enumValues = parts;
      }
    }

    // Detectar searchable/sortable desde flags
    const isSearchable = desc.toLowerCase().includes("searchable") || fieldName === "email" || fieldName === "name";
    const isSortable = desc.toLowerCase().includes("sortable") || fieldName === "createdAt" || fieldName === "updatedAt";

    fields.push({
      name: fieldName,
      type: detectedType,
      nullable,
      default: defaultValue,
      description: desc || undefined,
      enumValues,
      searchable: isSearchable,
      sortable: isSortable,
    });
  }

  return fields;
}

function detectMddType(sqlType: string, fieldName: string, constraints: string): string {
  const t = sqlType.toLowerCase().trim();
  const c = constraints.toLowerCase();

  // Mapeos directos
  if (t.includes("uuid") || fieldName === "id") return "UUID";
  if (t.includes("email") || (fieldName === "email" && t.includes("varchar"))) return "EMAIL";
  if (t.includes("varchar") && t.includes("255")) return "STRING";
  if (t.includes("varchar") && t.includes("100")) return "STRING";
  if (t.includes("text")) return "TEXT";
  if (t.includes("int") && !t.includes("bigint")) return "INT";
  if (t.includes("bigint")) return "BIGINT";
  if (t.includes("float") || t.includes("double")) return "FLOAT";
  if (t.includes("decimal") || t.includes("numeric")) return "DECIMAL";
  if (t.includes("bool")) return "BOOLEAN";
  if (t.includes("timestamp") && c.includes("null")) return "TIMESTAMP_NULLABLE";
  if (t.includes("timestamp")) return "TIMESTAMP";
  if (t.includes("json")) return "JSON";
  if (t.includes("url")) return "URL";
  if (t.includes("password") || fieldName === "password") return "PASSWORD";
  if (t.includes("slug") || fieldName === "slug") return "SLUG";

  // Fallbacks por nombre de campo
  if (fieldName === "deletedAt") return "TIMESTAMP_NULLABLE";
  if (fieldName === "createdAt" || fieldName === "updatedAt") return "TIMESTAMP";

  return "STRING";
}

function extractRelationsFromBlock(block: string, _entityName: string): MddEntity["relations"] {
  const relations: MddEntity["relations"] = [];

  // Heurística: buscar patrones como hasMany(Project), belongsTo(User), etc.
  const relationMatches = block.matchAll(/(hasMany|belongsTo|hasOne|manyToMany)\s*\(\s*([A-Za-z][A-Za-z0-9_]*)\s*\)/gi);
  for (const match of relationMatches) {
    const relationType = match[1].toLowerCase() as MddEntity["relations"][number]["type"];
    const target = match[2];
    let field: string;
    if (relationType === "hasMany" || relationType === "manyToMany") {
      field = target.toLowerCase() + "s";
    } else {
      field = target.charAt(0).toLowerCase() + target.slice(1) + "Id";
    }
    if (!relations.find((r) => r.target === target)) {
      relations.push({ type: relationType, target, field });
    }
  }

  // Heurística: campos que terminan en "Id" sugieren belongsTo
  const idFields = extractFieldsFromTable(block).filter((f) => f.name.endsWith("Id") && f.name !== "id");
  for (const f of idFields) {
    const targetName = capitalize(f.name.replace("Id", ""));
    if (!relations.find((r) => r.target === targetName)) {
      relations.push({
        type: "belongsTo",
        target: targetName,
        field: f.name,
      });
    }
  }

  return relations;
}

// Utilidades
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toSnakeCase(s: string): string {
  return s.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^\_/, "");
}

export default {
  extractTypesFromMddSection3,
};
