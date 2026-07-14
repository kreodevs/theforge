# Lean SDD: Registro de Cambios a Base de Datos (Rollback Seguro)

> **Rama:** `lean-sdd`  
> **Fecha:** 2026-07-14  > **Estrategia:** 100% aditiva — solo añadir, NUNCA eliminar ni modificar existente

---

## 1. Principio de Seguridad

**Regla #1:** Todos los cambios a BD en esta rama son **ADITIVOS**. No eliminamos campos, no marcamos como deprecated todavía, no modificamos tipos. Solo añadimos modelos/campos nuevos.

**Regla #2:** Si en algún momento necesitamos hacer rollback, simplemente: eliminar las migraciones nuevas + eliminar modelos nuevos del schema.

**Regla #3:** El código existente NUNCA referencia modelos/campos nuevos (hasta que estemos 100% seguros).

---

## 2. Registro de Cambios

### 2.1 Cambio #1: Nuevo modelo `StageDerivedSpec`

**Archivo:** `packages/database/schema.prisma`  
**Tipo:** ADD (modelo nuevo)  
**Impacto:** CERO en código existente (ningún servicio lo usa todavía)

**Descripción:** Tabla para almacenar los nuevos entregables estructurados: `types.json`, `operations.json`, `tasks.json`.

**Rollback:**
```bash
# Si necesitas revertir ESTE cambio:
npx prisma migrate resolve --rolled-back "[nombre_migracion]"
# Luego editar schema.prisma y eliminar el modelo StageDerivedSpec
# Finalmente: npx prisma migrate dev (para regenerar limpio)
```

**Modelo añadido:**
```prisma
model StageDerivedSpec {
  id              String   @id @default(uuid())
  stageId         String   @unique
  stage           Stage    @relation(fields: [stageId], references: [id], onDelete: Cascade)
  typesJson       Json     // types.json estructurado (§3)
  operationsJson  Json     // operations.json (§1+§3+§4)
  tasksJson       Json     // tasks.json parseado ejecutable
  inferenceRules  Json?    // reglas de inferencia aplicadas
  derivedAt       DateTime @default(now())
  mddHash         String   // hash del MDD usado para derivar
  
  @@index([stageId])
  @@index([derivedAt])
}
```

**Nota:** Este modelo NO tiene relación inversa en `Stage` todavía (para no tocar el modelo Stage). Se agregará más adelante cuando estemos seguros.

---

### 2.2 Cambio #2: Campos nuevos en `Project` (FUTURO — aún no implementar)

**Estado:** PENDIENTE  
**Descripción:** Añadir `derivedSpecId` a `Project` para cache.  
**Risk:** Bajo. Solo añade campo nullable.

**Rollback:**
```bash
# Eliminar campo del schema y regenerar
npx prisma migrate dev --name remove_derived_spec_id
```

---

### 2.3 Cambio #3: Eliminar `useCasesContent` (FUTURO — fase final)

**Estado:** PENDIENTE  
**ADVERTENCIA:** ESTE ES EL ÚNICO CAMBIO DESTRUCTIVO. Solo ejecutar cuando:
- Todos los proyectos han migrado sus casos de uso a user stories
- El frontend no muestra la pestaña "Casos de Uso"
- Los prompts no generan useCasesContent

**Rollback:**
```sql
-- Restaurar desde backup column (creado durante migración)
ALTER TABLE "Project" ADD COLUMN "useCasesContent" TEXT;
UPDATE "Project" SET "useCasesContent" = "useCasesContent_backup";
ALTER TABLE "Project" DROP COLUMN "useCasesContent_backup";
```

---

## 3. Plan de Rollback Completo (emergencia)

Si necesitamos abortar TODO el proyecto lean-sdd:

### Paso 1: Revertir migraciones

```bash
cd /root/proyectos/theforge/packages/database

# Listar migraciones nuevas
npx prisma migrate status

# Revertir UNA por UNA (empezando por la más reciente)
npx prisma migrate resolve --rolled-back "20260714_add_stage_derived_spec"
```

### Paso 2: Limpiar schema.prisma

Editar `schema.prisma` y eliminar:
- Modelo `StageDerivedSpec`
- Cualquier campo que hayamos añadido a modelos existentes

### Paso 3: Regenerar cliente

```bash
npx prisma generate
```

### Paso 4: Verificar integridad

```bash
cd /root/proyectos/theforge
pnpm test
```

---

## 4. Checklist de Seguridad por Cambio

Antes de cada cambio a BD, verificar:

- [ ] ¿Es aditivo? (No modifica/elimina nada existente)
- [ ] ¿El código existente puede compilarse sin este cambio?
- [ ] ¿Hay un script de rollback documentado?
- [ ] ¿Se hizo backup antes de ejecutar `prisma migrate dev`?
- [ ] ¿Los índices necesarios están definidos?
- [ ] ¿El campo es nullable si es opcional?

---

## 5. Observaciones

- **No eliminaremos** `useCasesContent` hasta la Fase 9 (final del proyecto).
- **No modificaremos** la estructura de `tasksContent` en la BD; añadimos `tasksJson` como campo separado.
- **No tocaremos** el grafo LangGraph hasta que el backend nuevo esté probado.

---

> Actualizado en cada cambio a BD. Versión actual: 2026-07-14 v1.0
