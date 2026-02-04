# Guía: Crear plantilla Backstage para The Forge

**Propósito:** Pasos concretos para registrar en Backstage (Spotify) una plantilla que consuma el Scaffold Manifest de The Forge y genere un repositorio que el desarrollador pueda clonar.

**Prerrequisitos:** Backstage instalado y accesible; permiso para registrar templates.

---

## 1. Estructura del template en Backstage

- Crear un repo (o carpeta en un repo existente) para la plantilla, ej. `the-forge-scaffold`.
- Estructura mínima:
  - `template.yaml` — Definición de la plantilla (metadata, parameters, steps).
  - `skeleton/` — Contenido que se copiará al nuevo repo (carpetas, archivos base, `catalog-info.yaml`).

---

## 2. Definir `template.yaml`

- **apiVersion:** `scaffolder.backstage.io/v1beta3`
- **kind:** `Template`
- **metadata.name:** ej. `the-forge-scaffold`
- **spec.parameters:** Form steps que reciban al menos:
  - `name` (component name, único)
  - `description` (descripción del repo)
  - `owner` (OwnerPicker: grupo/usuario en el catálogo)
  - `repoUrl` (RepoUrlPicker: dónde crear el repo, ej. GitHub)
  - (Opcional) `entities`, `stack`, `hasCicd`, etc., si se quieren usar en el skeleton (Nunjucks).
- **spec.steps:**
  1. **fetch:template** — `url: ./skeleton`, `values`: pasar `name`, `description`, `owner`, y el resto de parámetros que el skeleton use.
  2. **publish:github** (o **publish:gitlab**) — `repoUrl`, `description`, `defaultBranch: 'main'`.
  3. **catalog:register** — `repoContentsUrl` del paso publish, `catalogInfoPath: '/catalog-info.yaml'`.
- **spec.output.links:** Enlace al repo (`steps.publish.output.remoteUrl`) y a la entidad en el catálogo (`steps.register.output.entityRef`).

Ejemplo mínimo de `parameters` alineado con el Scaffold Manifest:

```yaml
parameters:
  - title: Datos del proyecto (The Forge)
    required: [name, owner, repoUrl]
    properties:
      name:
        title: Nombre del componente
        type: string
        description: Debe coincidir con projectName del Scaffold Manifest
      description:
        title: Descripción
        type: string
      owner:
        title: Owner
        type: string
        ui:field: OwnerPicker
        ui:options:
          catalogFilter:
            kind: Group
      repoUrl:
        title: Repositorio (GitHub/GitLab)
        type: string
        ui:field: RepoUrlPicker
        ui:options:
          allowedHosts: [github.com]
  - title: Opcionales (desde The Forge)
    properties:
      entities:
        title: Entidades (JSON array o texto)
        type: string
      stackBackend:
        title: Backend
        type: string
        default: NestJS
      stackFrontend:
        title: Frontend
        type: string
        default: React
```

---

## 3. Skeleton del repositorio

- **skeleton/catalog-info.yaml:** Entidad `Component` con `metadata.name: ${{ parameters.name }}`, `metadata.description`, `spec.owner`.
- **skeleton/README.md:** Generado con Nunjucks usando `${{ values.name }}`, `${{ values.description }}`.
- **skeleton/docs/** (opcional): Carpeta donde la plantilla pueda inyectar MDD, Blueprint, OpenAPI (si Backstage recibe esos contenidos como parámetros y los escribe con un custom action o con `fetch:template` + archivos en skeleton con placeholders).

Para que el dev "descargue" el repo: tras ejecutar la plantilla, Backstage muestra el enlace al repo creado; el desarrollador clona ese repo (git clone).

---

## 4. Registrar la plantilla en el catálogo Backstage

- Añadir la plantilla al `app-config.yaml` (o al lugar donde se registren templates en tu instalación), ej.:

```yaml
catalog:
  locations:
    - type: url
      target: https://github.com/tu-org/the-forge-scaffold/blob/main/template.yaml
```

- O registrar un Location apuntando al repo que contiene `template.yaml`.

---

## 5. Probar el flujo

1. En Backstage, ir a "Create" / "Software Templates".
2. Seleccionar la plantilla "The Forge Scaffold".
3. Rellenar nombre, owner, repoUrl (y opcionales).
4. Ejecutar; verificar que se crea el repo y aparece el enlace.
5. Clonar el repo y comprobar que contiene `catalog-info.yaml`, README y, si aplica, docs.

---

## Referencias

- [Writing Templates](https://backstage.io/docs/features/software-templates/writing-templates)
- [Built-in actions](https://backstage.io/docs/features/software-templates/builtin-actions)
- `SPEC-INTEGRACION-THE-FORGE-BACKSTAGE.md` — Contrato Scaffold Manifest.
