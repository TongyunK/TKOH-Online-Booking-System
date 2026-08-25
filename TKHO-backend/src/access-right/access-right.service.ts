import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccessRoleDto } from './dto/create-access-role.dto';
import { UpdateAccessRoleDto } from './dto/update-access-role.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { isSuperAdminAuth } from '../auth/super-admin.util';

type AccessRoleRow = {
  id: bigint;
  role_name: string;
  description: string | null;
  annual_venue_quota: number | null;
  annual_ev_quota: number | null;
};

type DepartmentRow = {
  id: bigint;
  department_name: string;
  description: string | null;
};

@Injectable()
export class AccessRightService {
  constructor(private readonly prisma: PrismaService) {}

  private mapRole(row: AccessRoleRow, employeeCount: number) {
    return {
      id: row.id.toString(),
      roleName: row.role_name,
      description: row.description ?? '',
      AnnualVenueQuota: row.annual_venue_quota ?? 0,
      AnnualEvQuota: row.annual_ev_quota ?? 0,
      employeeCount,
    };
  }

  private mapDepartment(row: DepartmentRow, employeeCount: number) {
    return {
      id: row.id.toString(),
      departmentName: row.department_name,
      description: row.description ?? '',
      employeeCount,
    };
  }

  async listRoles(auth?: { role?: string; isSuperAdmin?: boolean }) {
    const roles = await this.prisma.access_roles.findMany({ orderBy: { id: 'asc' } });
    const groupedUsers = await this.prisma.user.findMany({
      where: { accessRoleId: { not: null } },
      select: {
        accessRoleId: true,
        access_roles: { select: { role_name: true } },
      },
    });
    const countByRoleId = new Map<string, number>();
    for (const u of groupedUsers) {
      if (u.accessRoleId == null) continue;
      if (String(u.access_roles?.role_name || '').toLowerCase() === 'superadmin') continue;
      const key = u.accessRoleId.toString();
      countByRoleId.set(key, (countByRoleId.get(key) ?? 0) + 1);
    }
    const visibleRoles = isSuperAdminAuth(auth)
      ? roles
      : roles.filter((r) => String(r.role_name || '').toLowerCase() !== 'superadmin');
    return visibleRoles.map((r) => this.mapRole(r, countByRoleId.get(r.id.toString()) ?? 0));
  }

  async listDepartments() {
    const depts = await this.prisma.departments.findMany({ orderBy: { id: 'asc' } });
    const groupedUsers = await this.prisma.user.findMany({
      where: { departmentId: { not: null } },
      select: {
        departmentId: true,
        access_roles: { select: { role_name: true } },
      },
    });
    const countByDeptId = new Map<string, number>();
    for (const u of groupedUsers) {
      if (u.departmentId == null) continue;
      if (String(u.access_roles?.role_name || '').toLowerCase() === 'superadmin') continue;
      const key = u.departmentId.toString();
      countByDeptId.set(key, (countByDeptId.get(key) ?? 0) + 1);
    }
    return depts.map((d) =>
      this.mapDepartment(d, countByDeptId.get(d.id.toString()) ?? 0),
    );
  }

  async createRole(dto: CreateAccessRoleDto) {
    const max = await this.prisma.access_roles.aggregate({ _max: { id: true } });
    const nextId = (max._max.id ?? BigInt(0)) + BigInt(1);
    try {
      const created = await this.prisma.access_roles.create({
        data: {
          id: nextId,
          role_name: dto.roleName.trim(),
          description: dto.description?.trim() || null,
          annual_venue_quota: dto.annualVenueQuota ?? 0,
          annual_ev_quota: dto.annualEvQuota ?? 0,
          employee_count: 0,
        },
      });
      return this.mapRole(created, 0);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Role name already exists');
      }
      throw e;
    }
  }

  async updateRole(id: string, dto: UpdateAccessRoleDto) {
    const roleId = BigInt(id);
    const exists = await this.prisma.access_roles.findUnique({ where: { id: roleId } });
    if (!exists) throw new NotFoundException('Role not found');

    const data: Prisma.access_rolesUpdateInput = {};
    if (dto.roleName !== undefined) data.role_name = dto.roleName.trim();
    if (dto.description !== undefined) data.description = dto.description.trim() || null;
    if (dto.annualVenueQuota !== undefined) data.annual_venue_quota = dto.annualVenueQuota;
    if (dto.annualEvQuota !== undefined) data.annual_ev_quota = dto.annualEvQuota;

    const cnt = await this.prisma.user.count({
      where: {
        accessRoleId: roleId,
        NOT: {
          access_roles: {
            is: {
              role_name: {
                equals: 'SuperAdmin',
                mode: 'insensitive',
              },
            },
          },
        },
      },
    });
    if (Object.keys(data).length === 0) {
      return this.mapRole(exists, cnt);
    }

    try {
      const updated = await this.prisma.access_roles.update({
        where: { id: roleId },
        data,
      });
      return this.mapRole(updated, cnt);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Role name already exists');
      }
      throw e;
    }
  }

  async deleteRole(id: string) {
    const roleId = BigInt(id);
    const exists = await this.prisma.access_roles.findUnique({ where: { id: roleId } });
    if (!exists) throw new NotFoundException('Role not found');
    const cnt = await this.prisma.user.count({
      where: {
        accessRoleId: roleId,
        NOT: {
          access_roles: {
            is: {
              role_name: {
                equals: 'SuperAdmin',
                mode: 'insensitive',
              },
            },
          },
        },
      },
    });
    if (cnt > 0) {
      throw new BadRequestException('Cannot delete role with assigned users');
    }
    await this.prisma.access_roles.delete({ where: { id: roleId } });
    return { ok: true };
  }

  async createDepartment(dto: CreateDepartmentDto) {
    const max = await this.prisma.departments.aggregate({ _max: { id: true } });
    const nextId = (max._max.id ?? BigInt(0)) + BigInt(1);
    try {
      const created = await this.prisma.departments.create({
        data: {
          id: nextId,
          department_name: dto.departmentName.trim(),
          description: dto.description?.trim() || null,
          employee_count: 0,
        },
      });
      return this.mapDepartment(created, 0);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Department / Unit name already exists');
      }
      throw e;
    }
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto) {
    const deptId = BigInt(id);
    const exists = await this.prisma.departments.findUnique({ where: { id: deptId } });
    if (!exists) throw new NotFoundException('Department / Unit not found');
    const oldName = exists.department_name;
    const newName =
      dto.departmentName !== undefined ? dto.departmentName.trim() : oldName;

    if (newName === oldName && dto.description === undefined) {
      const cnt = await this.prisma.user.count({
        where: {
          departmentId: deptId,
          NOT: {
            access_roles: {
              is: {
                role_name: {
                  equals: 'SuperAdmin',
                  mode: 'insensitive',
                },
              },
            },
          },
        },
      });
      return this.mapDepartment(exists, cnt);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        if (newName !== oldName) {
          await tx.departments.update({
            where: { id: deptId },
            data: {
              department_name: newName,
              description:
                dto.description !== undefined ? dto.description.trim() || null : undefined,
            },
          });
        } else if (dto.description !== undefined) {
          await tx.departments.update({
            where: { id: deptId },
            data: { description: dto.description.trim() || null },
          });
        }
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Department / Unit name already exists');
      }
      throw e;
    }

    const updated = await this.prisma.departments.findUniqueOrThrow({ where: { id: deptId } });
    const cnt = await this.prisma.user.count({
      where: {
        departmentId: deptId,
        NOT: {
          access_roles: {
            is: {
              role_name: {
                equals: 'SuperAdmin',
                mode: 'insensitive',
              },
            },
          },
        },
      },
    });
    return this.mapDepartment(updated, cnt);
  }

  async deleteDepartment(id: string) {
    const deptId = BigInt(id);
    const exists = await this.prisma.departments.findUnique({ where: { id: deptId } });
    if (!exists) throw new NotFoundException('Department / Unit not found');
    const cnt = await this.prisma.user.count({
      where: {
        departmentId: deptId,
        NOT: {
          access_roles: {
            is: {
              role_name: {
                equals: 'SuperAdmin',
                mode: 'insensitive',
              },
            },
          },
        },
      },
    });
    if (cnt > 0) {
      throw new BadRequestException('Cannot delete department with assigned users');
    }
    await this.prisma.departments.delete({ where: { id: deptId } });
    return { ok: true };
  }
}
