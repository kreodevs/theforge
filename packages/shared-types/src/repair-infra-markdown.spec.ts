import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  repairBulletedYamlLines,
  repairFalseDockerfileHeadings,
  repairInfraMarkdown,
} from "./repair-infra-markdown.js";
import { formatDocumentMarkdown } from "./format-document-markdown.js";

describe("repairFalseDockerfileHeadings", () => {
  it("convierte ### WORKDIR en instrucción Docker", () => {
    const out = repairFalseDockerfileHeadings("### WORKDIR /app\nCOPY . .");
    assert.match(out, /^WORKDIR \/app/m);
    assert.doesNotMatch(out, /^### WORKDIR/);
  });
});

describe("repairBulletedYamlLines", () => {
  it("convierte viñetas en YAML indentado", () => {
    const raw = `version: '3.8'
services:
  postgres:
- image: postgres:16-alpine
- container_name: costos-postgres
- environment:
- POSTGRES_USER: user
- depends on:
- postgres:
- condition: service_healthy`;
    const out = repairBulletedYamlLines(raw);
    assert.match(out, /^\s+image: postgres:16-alpine/m);
    assert.match(out, /depends_on:/);
    assert.doesNotMatch(out, /^-\s+image:/m);
  });
});

describe("repairInfraMarkdown", () => {
  it("repara Dockerfile + compose + env típico de doc infra LLM", () => {
    const doc = `## 1. Dockerfile multietapa

### Backend (NestJS)

# ---- Build Stage ----
FROM node:20-alpine AS builder

### WORKDIR /app

COPY package*.json ./
RUN npm ci

## 2. docker-compose.yml

\`\`\`yaml
version: '3.8'

services:
\`\`\`
  postgres:
- image: postgres:16-alpine
- container_name: costos-postgres

## 3. Variables de entorno (.env.example)

# --- Base de datos ---
DATABASE_URL=postgresql://user:pass@postgres:5432/db

## 4. Volúmenes`;

    const out = repairInfraMarkdown(doc);
    assert.match(out, /```dockerfile[\s\S]*FROM node:20-alpine[\s\S]*WORKDIR \/app[\s\S]*```/);
    assert.match(out, /```yaml[\s\S]*image: postgres:16-alpine[\s\S]*```/);
    assert.match(out, /```env[\s\S]*DATABASE_URL=[\s\S]*```/);
    assert.doesNotMatch(out, /### WORKDIR/);
  });

  it("formatDocumentMarkdown aplica reparación infra", () => {
    const doc = `## 2. docker-compose.yml

\`\`\`yaml
services:
\`\`\`
  backend:
- image: node:20-alpine
- ports:
- "3000:3000"

## 3. Variables de entorno

NODE_ENV=development`;
    const out = formatDocumentMarkdown(doc);
    assert.match(out, /```yaml[\s\S]*backend:[\s\S]*image: node:20-alpine/);
    assert.match(out, /```env[\s\S]*NODE_ENV=development/);
  });
});
