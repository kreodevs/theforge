/** Human-readable Workshop labels for Prisma StageStatus. */
export function stageWorkflowStatusLabel(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "Activa";
    case "ARCHIVED":
      return "Archivada";
    case "SUPERSEDED":
      return "Reemplazada";
    case "COMPLETED":
      return "Completada";
    case "DRAFT":
      return "Borrador";
    default:
      return status;
  }
}
