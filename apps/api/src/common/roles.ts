export const APP_ROLES = ["super_admin", "admin", "developer"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export function isSuperAdmin(role: string): boolean {
  return role === "super_admin";
}

/** Admin o super_admin (gestión de usuarios, etc.). */
export function isAdminOrAbove(role: string): boolean {
  return role === "admin" || role === "super_admin";
}

export function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}
