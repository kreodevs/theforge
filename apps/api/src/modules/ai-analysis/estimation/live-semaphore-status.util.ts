import { Status } from "@theforge/database";
import type { SemaphoreStatusLive } from "./estimation.types.js";

/** Mapea el semáforo en vivo (UI Workshop) al enum persistido en `Stage.status`. */
export function liveSemaphoreToDbStatus(status: SemaphoreStatusLive): Status {
  if (status === "green") return Status.VERDE;
  if (status === "yellow") return Status.AMARILLO;
  return Status.ROJO;
}

/** Inverso: enum de etapa → semáforo en vivo. */
export function dbStatusToLiveSemaphore(status: Status): SemaphoreStatusLive {
  if (status === Status.VERDE) return "green";
  if (status === Status.AMARILLO) return "yellow";
  return "red";
}
