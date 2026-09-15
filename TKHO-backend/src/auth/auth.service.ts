import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import * as bcrypt from 'bcryptjs';
import { isSuperAdminRole } from './super-admin.util';
import { assertUserCanAuthenticate } from './auth-user-status.util';
import { formatUserDisplayName } from '../common/user-display-name';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  private canAccessAdminPortal(role: string | null): boolean {
    const normalized = String(role || '').toLowerCase();
    return normalized.includes('admin') || isSuperAdminRole(role);
  }

  private verifyPassword(plain: string, stored: string): boolean {
    if (!plain || !stored) {
      return false;
    }
    if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
      return bcrypt.compareSync(plain, stored);
    }
    return plain === stored;
  }

  private normalizeUser(user: any, system: string) {
    const departmentName = user.department?.department_name ?? null;
    const roleName = user.access_roles?.role_name ?? null;
    return {
      id: user.id.toString(),
      corpId: user.corpId,
      name: formatUserDisplayName(user),
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      employeeNo: user.employeeNo ?? null,
      rank: user.rank ?? null,
      department: departmentName,
      role: roleName,
      departmentId: user.departmentId != null ? user.departmentId.toString() : null,
      accessRoleId: user.accessRoleId != null ? user.accessRoleId.toString() : null,
      email: user.email,
      contact: user.contact,
      annualQuotaEv: user.annualQuotaEv,
      usedQuotaEv: user.usedQuotaEv,
      annualQuotaVenue: user.annualQuotaVenue,
      usedQuotaVenue: user.usedQuotaVenue,
      isSuperAdmin: isSuperAdminRole(roleName),
      status: user.status,
      lastLoginTime: user.lastLoginTime,
      createdAt: user.createdAt,
      system,
    };
  }

  private readonly userAuthInclude = {
    department: { select: { department_name: true } },
    access_roles: { select: { role_name: true } },
  } as const;

  private parseAuthSub(auth: any): bigint {
    const sub = String(auth?.sub ?? '').trim();
    if (!/^\d+$/.test(sub)) {
      throw new UnauthorizedException('Invalid token');
    }
    return BigInt(sub);
  }

  async login(dto: LoginDto) {
    const corpId = dto.corpId.trim();
    const user = await this.prisma.user.findUnique({
      where: { corpId },
      include: this.userAuthInclude,
    });

    if (!user || !this.verifyPassword(dto.password, user.password)) {
      throw new UnauthorizedException('Incorrect CORP User ID or password');
    }
    assertUserCanAuthenticate(user.status);
    const roleName = user.access_roles?.role_name ?? null;
    const isSuperAdmin = isSuperAdminRole(roleName);
    if (dto.system === 'admin' && !this.canAccessAdminPortal(roleName)) {
      throw new ForbiddenException('Not authorized for admin portal');
    }

    const token = this.jwtService.sign({
      sub: String(user.id),
      system: dto.system,
      corpId: user.corpId,
      name: formatUserDisplayName(user),
      role: roleName,
      isSuperAdmin,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginTime: new Date() },
    });

    return {
      token,
      user: this.normalizeUser(user, dto.system),
      userAutoLogoutMinutes:
        await this.systemSettingsService.getUserAutoLogoutMinutes(),
    };
  }

  async getSessionPolicy() {
    return {
      userAutoLogoutMinutes:
        await this.systemSettingsService.getUserAutoLogoutMinutes(),
    };
  }

  async getCurrentUser(auth: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: this.parseAuthSub(auth) },
      include: this.userAuthInclude,
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    assertUserCanAuthenticate(user.status);

    return {
      user: this.normalizeUser(user, auth.system || 'room'),
      userAutoLogoutMinutes:
        await this.systemSettingsService.getUserAutoLogoutMinutes(),
    };
  }

  async updateProfile(auth: any, dto: UpdateProfileDto) {
    const id = this.parseAuthSub(auth);
    const updateData: Record<string, unknown> = {
      contact: dto.phone.trim(),
    };

    if (dto.firstName !== undefined) {
      updateData.firstName = String(dto.firstName).trim();
    }
    if (dto.lastName !== undefined) {
      updateData.lastName = String(dto.lastName).trim();
    } else if (dto.fullName !== undefined && dto.firstName === undefined) {
      // Legacy fullName: write entire string to lastName; leave firstName unchanged
      updateData.lastName = String(dto.fullName).trim();
    }

    if (dto.employeeNo !== undefined) {
      const employeeNo = String(dto.employeeNo).trim();
      updateData.employeeNo = employeeNo === '' ? null : employeeNo;
    }

    if (dto.rank !== undefined) {
      const rank = String(dto.rank).trim();
      updateData.rank = rank === '' ? null : rank;
    }

    if (dto.department !== undefined && dto.department !== null) {
      const trimmed = dto.department.trim();
      if (trimmed === '') {
        updateData.departmentId = null;
      } else {
        const dept = await this.prisma.departments.findFirst({
          where: { department_name: trimmed },
        });
        if (!dept) {
          throw new BadRequestException('Unknown department');
        }
        updateData.departmentId = dept.id;
      }
    }

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: updateData,
        include: this.userAuthInclude,
      });
      return {
        message: 'Profile updated',
        user: this.normalizeUser(user, auth.system || 'room'),
      };
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new BadRequestException('Employee No already exists');
      }
      throw error;
    }
  }

  async changePassword(auth: any, dto: ChangePasswordDto) {
    const id = this.parseAuthSub(auth);
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!this.verifyPassword(dto.currentPassword, user.password)) {
      throw new BadRequestException('Current password is incorrect');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different');
    }
    await this.prisma.user.update({
      where: { id },
      data: { password: bcrypt.hashSync(dto.newPassword, 10) },
    });
    return { message: 'Password updated' };
  }
}
