import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ProjectGroup } from "@theforge/database";
import { getRequestUserRole } from "../../common/request-user.store.js";
import { isAdminOrAbove } from "../../common/roles.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import {
  DEFAULT_PROJECT_GROUP_ID,
  type CreateProjectGroupDto,
  type UpdateProjectGroupDto,
} from "@theforge/shared-types";
import { computeMoveToFirstUpdates } from "./project-group-order.util.js";

function slugifyGroupName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "grupo";
}

function toApiGroup(group: ProjectGroup) {
  return {
    id: group.id,
    name: group.name,
    slug: group.slug,
    isDefault: group.isDefault,
    sortOrder: group.sortOrder,
    createdAt: group.createdAt.toISOString(),
  };
}

@Injectable()
export class ProjectGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(): void {
    if (!isAdminOrAbove(getRequestUserRole())) {
      throw new ForbiddenException("Se requiere rol admin");
    }
  }

  async findAll() {
    const rows = await this.prisma.projectGroup.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return rows.map(toApiGroup);
  }

  async create(data: CreateProjectGroupDto) {
    this.assertAdmin();
    const name = data.name.trim();
    if (!name) throw new BadRequestException("El nombre no puede estar vacío");

    const baseSlug = slugifyGroupName(name);
    let slug = baseSlug;
    let suffix = 1;
    while (await this.prisma.projectGroup.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const maxSort = await this.prisma.projectGroup.aggregate({ _max: { sortOrder: true } });
    const sortOrder = (maxSort._max.sortOrder ?? 0) + 1;

    const created = await this.prisma.projectGroup.create({
      data: { name, slug, sortOrder },
    });
    return toApiGroup(created);
  }

  async update(id: string, data: UpdateProjectGroupDto) {
    this.assertAdmin();
    const existing = await this.prisma.projectGroup.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Grupo no encontrado");
    if (existing.isDefault) {
      throw new ForbiddenException("El grupo por defecto no se puede renombrar");
    }

    const name = data.name.trim();
    if (!name) throw new BadRequestException("El nombre no puede estar vacío");

    const updated = await this.prisma.projectGroup.update({
      where: { id },
      data: { name },
    });
    return toApiGroup(updated);
  }

  async remove(id: string) {
    this.assertAdmin();
    const existing = await this.prisma.projectGroup.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Grupo no encontrado");
    if (existing.isDefault) {
      throw new ForbiddenException("El grupo por defecto no se puede eliminar");
    }

    const defaultGroup = await this.prisma.projectGroup.findUnique({
      where: { id: DEFAULT_PROJECT_GROUP_ID },
    });
    if (!defaultGroup) {
      throw new BadRequestException("Grupo por defecto no configurado");
    }

    await this.prisma.$transaction([
      this.prisma.project.updateMany({
        where: { groupId: id },
        data: { groupId: defaultGroup.id },
      }),
      this.prisma.projectGroup.delete({ where: { id } }),
    ]);

    return { deleted: true, reassignedToGroupId: defaultGroup.id };
  }

  async moveToFirst(id: string) {
    this.assertAdmin();
    const all = await this.prisma.projectGroup.findMany({
      select: { id: true, sortOrder: true, name: true },
    });
    const updates = computeMoveToFirstUpdates(all, id);
    if (updates === null) throw new NotFoundException("Grupo no encontrado");
    if (updates.length === 0) {
      const existing = all.find((g) => g.id === id)!;
      return toApiGroup(
        await this.prisma.projectGroup.findUniqueOrThrow({ where: { id: existing.id } }),
      );
    }

    await this.prisma.$transaction(
      updates.map((u) =>
        this.prisma.projectGroup.update({
          where: { id: u.id },
          data: { sortOrder: u.sortOrder },
        }),
      ),
    );

    const moved = await this.prisma.projectGroup.findUniqueOrThrow({ where: { id } });
    return toApiGroup(moved);
  }

  async getDefaultGroupId(): Promise<string> {
    const row = await this.prisma.projectGroup.findFirst({
      where: { isDefault: true },
      select: { id: true },
    });
    return row?.id ?? DEFAULT_PROJECT_GROUP_ID;
  }
}
