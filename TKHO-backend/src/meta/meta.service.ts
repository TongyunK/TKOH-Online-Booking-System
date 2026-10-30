import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isSuperAdminAuth } from '../auth/super-admin.util';
import { formatUserDisplayName } from '../common/user-display-name';
import {
  batchCountUsedForYear,
  getAppCalendarYear,
} from '../common/user-quota';

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
        annualQuotaVenue: true,
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

    const year = getAppCalendarYear();
    const { evUsedByUserId, venueUsedByUserId } = await batchCountUsedForYear(
      this.prisma,
      visibleUsers.map((u) => u.id),
      year,
    );

    return visibleUsers.map((user) => {
      const id = user.id.toString();
      return {
        id,
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
        /** 已用按 Reserved By（Venue reserved_by / EV 车牌所属用户），非 Submitted By */
        usedQuotaEv: evUsedByUserId.get(id) ?? 0,
        annualQuotaVenue: user.annualQuotaVenue,
        usedQuotaVenue: venueUsedByUserId.get(id) ?? 0,
        quotaYear: year,
        status: user.status,
        lastLoginTime: user.lastLoginTime,
        createdAt: user.createdAt,
      };
    });
  }

  async venues() {
    const venues = await this.prisma.venues.findMany({ orderBy: { id: 'asc' } });
    return venues.map((venue) => ({
      ...venue,
      id: venue.id.toString(),
    }));
  }
}
