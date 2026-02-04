#!/usr/bin/env node
/**
 * Asegura que Colima (runtime de contenedores) y el contenedor Postgres `theforge-db`
 * existan y estén en ejecución. Solo para uso en local.
 * Requiere Colima y Docker (CLI) instalados.
 */

const { spawnSync } = require('child_process');

const CONTAINER_NAME = 'theforge-db';
const COLIMA_START_ARGS = '--cpu 2 --memory 4';
const DOCKER_RUN_ARGS = [
  '-d',
  '--name', CONTAINER_NAME,
  '-e', 'POSTGRES_USER=theforge',
  '-e', 'POSTGRES_PASSWORD=theforge',
  '-e', 'POSTGRES_DB=theforge',
  '-p', '5432:5432',
  'postgres:15-alpine',
];

function run(cmd, options = {}) {
  return spawnSync(cmd, [], {
    encoding: 'utf8',
    shell: true,
    ...options,
  });
}

function ensureColima() {
  const status = run('colima status');
  if (status.status === 0) {
    console.log('[ensure-postgres] Colima ya está en ejecución.');
    return 0;
  }
  console.log('[ensure-postgres] Iniciando Colima (--cpu 2 --memory 4)...');
  const start = run(`colima start ${COLIMA_START_ARGS}`);
  if (start.status !== 0) {
    console.error('[ensure-postgres] Error al iniciar Colima:', start.stderr || start.error);
    return 1;
  }
  console.log('[ensure-postgres] Colima iniciado.');
  return 0;
}

function getContainerStatus() {
  const result = run(
    `docker ps -a --filter name=^${CONTAINER_NAME}$ --format "{{.Names}}\t{{.Status}}"`,
  );
  if (result.status !== 0 || !result.stdout || !result.stdout.trim()) {
    return { exists: false, running: false };
  }
  const line = result.stdout.trim().split('\n')[0] || '';
  const [name, status] = line.split('\t');
  if (name !== CONTAINER_NAME) return { exists: false, running: false };
  return { exists: true, running: (status || '').toLowerCase().startsWith('up') };
}

function ensurePostgres() {
  const { exists, running } = getContainerStatus();
  if (running) {
    console.log(`[ensure-postgres] ${CONTAINER_NAME} ya está en ejecución.`);
    return 0;
  }
  if (exists) {
    console.log(`[ensure-postgres] Iniciando ${CONTAINER_NAME}...`);
    const start = run(`docker start ${CONTAINER_NAME}`);
    if (start.status !== 0) {
      console.error('[ensure-postgres] Error al iniciar el contenedor:', start.stderr || start.error);
      return 1;
    }
    console.log(`[ensure-postgres] ${CONTAINER_NAME} iniciado.`);
    return 0;
  }
  console.log(`[ensure-postgres] Creando e iniciando ${CONTAINER_NAME}...`);
  const create = run(`docker run ${DOCKER_RUN_ARGS.join(' ')}`);
  if (create.status !== 0) {
    console.error('[ensure-postgres] Error al crear el contenedor:', create.stderr || create.error);
    return 1;
  }
  console.log(`[ensure-postgres] ${CONTAINER_NAME} creado e iniciado.`);
  return 0;
}

function main() {
  const colimaOk = ensureColima();
  if (colimaOk !== 0) return colimaOk;
  return ensurePostgres();
}

const code = main();
process.exit(code);
