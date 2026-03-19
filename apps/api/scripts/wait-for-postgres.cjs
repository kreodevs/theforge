/**
 * Espera a que TCP (host:puerto) de DATABASE_URL acepte conexiones.
 * Evita fallos transitorios de "Can't reach database" al arrancar api antes que db.
 */
const net = require("net");

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error("wait-for-postgres: DATABASE_URL is not set");
  process.exit(1);
}

let url;
try {
  url = new URL(raw.replace(/^postgresql:/i, "http:"));
} catch (e) {
  console.error("wait-for-postgres: invalid DATABASE_URL", e.message);
  process.exit(1);
}

const host = url.hostname;
const port = parseInt(url.port || "5432", 10);
const maxAttempts = parseInt(process.env.WAIT_FOR_POSTGRES_ATTEMPTS || "90", 10);
const delayMs = parseInt(process.env.WAIT_FOR_POSTGRES_DELAY_MS || "1000", 10);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function tryConnect() {
  return new Promise((resolve, reject) => {
    const s = net.createConnection({ host, port }, () => {
      s.end();
      resolve();
    });
    s.on("error", reject);
  });
}

(async () => {
  process.stdout.write(`wait-for-postgres: waiting for ${host}:${port} ...\n`);
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await tryConnect();
      process.stdout.write(`wait-for-postgres: ok (attempt ${i})\n`);
      process.exit(0);
    } catch {
      if (i === maxAttempts) {
        console.error(`wait-for-postgres: timeout after ${maxAttempts} attempts`);
        process.exit(1);
      }
      await sleep(delayMs);
    }
  }
})();
