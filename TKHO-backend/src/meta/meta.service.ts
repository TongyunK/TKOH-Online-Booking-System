import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isSuperAdminAuth } from '../auth/super-admin.util';
import { formatUserDisplayName } from '../common/user-display-name';

@Injectable()
export class MetaService {
  constructor(private readonly prisma: PrismaService) {}

  async users(auth?: { isSuperAdmin?: boolean; role?: string }) {
    const users = await this.prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        corpId: true,
        firstName: true,
        lastName: true,
        employeeNo: true,
        rank: true,
        departmentId: true,
        accessRoleId: true,
        email: true,
        contact: true,
        annualQuotaEv: true,
        usedQuotaEv: true,
        annualQuotaVenue: true,
        usedQuotaVenue: true,
        status: true,
        lastLoginTime: true,
        createdAt: true,
        department: { select: { department_name: true } },
        access_roles: { select: { role_name: true } },
      },
    });

    const visibleUsers = isSuperAdminAuth(auth)
      ? users
      : users.filter((user) => String(user.access_roles?.role_name || '').toLowerCase() !== 'superadmin');

    return visibleUsers.map((user) => ({
      id: user.id.toString(),
      corpId: user.corpId,
      name: formatUserDisplayName(user),
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      employeeNo: user.employeeNo ?? null,
      rank: user.rank ?? null,
      departmentId: user.departmentId != null ? user.departmentId.toString() : null,
      accessRoleId: user.accessRoleId != null ? user.accessRoleId.toString() : null,
      department: user.department?.department_name ?? null,
      role: user.access_roles?.role_name ?? null,
      email: user.email,
      contact: user.contact,
      annualQuotaEv: user.annualQuotaEv,
      usedQuotaEv: user.usedQuotaEv,
      annualQuotaVenue: user.annualQuotaVenue,
      usedQuotaVenue: user.usedQuotaVenue,
      status: user.status,
      lastLoginTime: user.lastLoginTime,
      createdAt: user.createdAt,
    }));
  }

  async venues() {
    const venues = await this.prisma.venues.findMany({ orderBy: { id: 'asc' } });
    return venues.map((venue) => ({
      ...venue,
      id: venue.id.toString(),
    }));
  }
}
