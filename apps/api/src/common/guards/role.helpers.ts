import { ForbiddenException } from "@nestjs/common";
import { getRequestUserRole } from "../request-user.store.js";
import { isAdminOrAbove, isSuperAdmin } from "../roles.js";

export function requireSuperAdmin(): void {
  if (!isSuperAdmin(getRequestUserRole())) {
    throw new ForbiddenException("Se requiere rol super_admin");
  }
}

export function requireAdmin(): void {
  if (!isAdminOrAbove(getRequestUserRole())) {
    throw new ForbiddenException("Se requiere rol admin");
  }
}
