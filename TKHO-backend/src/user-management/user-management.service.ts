import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovePendingDto } from './dto/approve-pending.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { SubmitPendingUserDto } from './dto/submit-pending-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { isSuperAdminAuth, isSuperAdminRole } from '../auth/super-admin.util';
import {
  formatUserDisplayName,
  userDisplayNameSelect,
} from '../common/user-display-name';

const userSelect = {
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
  inactiveTime: true,
  inactivedBy: true,
  createdAt: true,
  department: { select: { department_name: true } },
  access_roles: { select: { role_name: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UserManagementService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertTargetUserVisibleToActor(
    id: bigint,
    auth: { isSuperAdmin?: boolean; role?: string } | null | undefined,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, access_roles: { select: { role_name: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    if (isSuperAdminAuth(auth)) return user;

    const targetRole = user.access_roles?.role_name ?? '';
    if (isSuperAdminRole(targetRole)) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private assertCanAssignRole(
    roleName: string | undefined,
    auth: { isSuperAdmin?: boolean; role?: string } | null | undefined,
  ) {
    if (isSuperAdminAuth(auth)) return;
    if (isSuperAdminRole(roleName)) {
      throw new ForbiddenException('Operation not allowed');
    }
  }

  private parseApproverId(authSub: any): bigint {
    const raw = String(authSub ?? '').trim();
    if (!/^\d+$/.test(raw)) {
      throw new BadRequestException('Invalid approver user id');
    }
    return BigInt(raw);
  }

  private statusToDb(s: string | undefined): string {
    const x = String(s ?? '')
      .trim()
      .toLowerCase();
    if (x === 'inactive') return 'Inactive';
    if (x === 'expired') return 'Expired';
    return 'Active';
  }

  private statusFromDb(s: string | undefined): string {
    const x = String(s ?? '')
      .trim()
      .toLowerCase();
    if (x === 'inactive') return 'inactive';
    if (x === 'expired') return 'expired';
    return 'active';
  }

  /** Set inactiveTime / inactivedBy when status becomes Inactive; clear when reactivated to Active. */
  private inactiveFieldsForStatus(
    statusFe: string,
    inactivedBy?: string | null,
  ): { inactiveTime?: Date | null; inactivedBy?: string | null } {
    const db = this.statusToDb(statusFe);
    if (db === 'Inactive') {
      return {
        inactiveTime: new Date(),
        ...(inactivedBy !== undefined ? { inactivedBy } : {}),
      };
    }
    if (db === 'Active') {
      return { inactiveTime: null, inactivedBy: null };
    }
    return {};
  }

  private async resolveActorDisplayName(
    auth?: { sub?: unknown } | null,
  ): Promise<string> {
    const raw = String(auth?.sub ?? '').trim();
    if (!/^\d+$/.test(raw)) return 'Admin';
    const actor = await this.prisma.user.findUnique({
      where: { id: BigInt(raw) },
      select: userDisplayNameSelect,
    });
    return formatUserDisplayName(actor) || 'Admin';
  }

  private mapUser(user: Prisma.UserGetPayload<{ select: typeof userSelect }>) {
    return {
      id: user.id.toString(),
      corpId: user.corpId,
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      name: formatUserDisplayName(user),
      employeeNo: user.employeeNo ?? '',
      rank: user.rank ?? '',
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
      status: this.statusFromDb(user.status),
      lastLoginTime: user.lastLoginTime,
      inactiveTime: user.inactiveTime,
      inactivedBy: user.inactivedBy ?? '',
      createdAt: user.createdAt,
    };
  }

  private mapPendingUser(p: {
    id: bigint;
    corp_id: string;
    first_name: string;
    last_name: string;
    employee_no: string | null;
    rank: string | null;
    department_id: bigint | null;
    approver_user_id: bigint | null;
    approver_name: string | null;
    email: string | null;
    contact_no: string | null;
    reason: string | null;
    car_plate_no: string | null;
    reject_reason: string | null;
    submitted_at: Date | null;
    handled_at: Date | null;
    approval_status: string;
    departments?: { department_name: string } | null;
  }) {
    const firstName = p.first_name ?? '';
    const lastName = p.last_name ?? '';
    return {
      id: p.id.toString(),
      corpId: p.corp_id,
      firstName,
      lastName,
      name: formatUserDisplayName({ firstName, lastName }),
      employeeNo: p.employee_no ?? '',
      rank: p.rank ?? '',
      department: p.departments?.department_name ?? null,
      departmentId: p.department_id != null ? p.department_id.toString() : null,
      approverUserId: p.approver_user_id != null ? p.approver_user_id.toString() : null,
      approverName: p.approver_name ?? null,
      email: p.email,
      contactNo: p.contact_no,
      reason: p.reason,
      carPlateNo: p.car_plate_no ?? '',
      rejectReason: p.reject_reason,
      submittedAt: p.submitted_at,
      handledAt: p.handled_at,
      approvalStatus: String(p.approval_status || '').toLowerCase(),
    };
  }

  private async nextDepartmentId(): Promise<bigint> {
    const max = await this.prisma.departments.aggregate({ _max: { id: true } });
    return (max._max.id ?? BigInt(0)) + BigInt(1);
  }

  private async resolveDepartmentId(name: string | undefined): Promise<bigint | null> {
    const trimmed = name?.trim();
    if (!trimmed) return null;
    const existing = await this.prisma.departments.findFirst({
      where: { department_name: trimmed },
    });
    if (existing) return existing.id;

    const nextId = await this.nextDepartmentId();
    try {
      const created = await this.prisma.departments.create({
        data: {
          id: nextId,
          department_name: trimmed,
        },
      });
      return created.id;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const row = await this.prisma.departments.findFirst({
          where: { department_name: trimmed },
        });
        if (row) return row.id;
      }
      throw e;
    }
  }

  private async resolveAccessRoleId(roleName: string | undefined): Promise<bigint | null> {
    const trimmed = roleName?.trim();
    if (!trimmed) return null;
    if (isSuperAdminRole(trimmed)) {
      throw new BadRequestException('Invalid role');
    }
    const row = await this.prisma.access_roles.findFirst({
      where: { role_name: trimmed },
    });
    if (!row) throw new BadRequestException('Invalid role');
    return row.id;
  }

  private async nextUserId(): Promise<bigint> {
    const max = await this.prisma.user.aggregate({ _max: { id: true } });
    return (max._max.id ?? BigInt(0)) + BigInt(1);
  }

  private normalizeCarPlateNo(raw: string | null | undefined): string {
    return String(raw ?? '')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 8)
      .toUpperCase();
  }

  private isEvBookingReason(reason: string | null | undefined): boolean {
    return String(reason ?? '').trim().toLowerCase() === 'ev booking';
  }

  private async nextLicensePlateId(
    tx: Prisma.TransactionClient,
  ): Promise<bigint> {
    const latest = await tx.license_plates.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    return latest ? latest.id + BigInt(1) : BigInt(1);
  }

  private async createLinkedLicensePlate(
    tx: Prisma.TransactionClient,
    userId: bigint,
    plateNumber: string,
  ) {
    const existing = await tx.license_plates.findFirst({
      where: { plate_number: plateNumber },
    });
    if (existing) {
      if (existing.user_id != null && existing.user_id !== userId) {
        throw new ConflictException(
          `License plate ${plateNumber} is already assigned to another user`,
        );
      }
      await tx.license_plates.update({
        where: { id: existing.id },
        data: {
          user_id: userId,
          status: 'active',
          is_default: true,
        },
      });
      return;
    }

    await tx.license_plates.create({
      data: {
        id: await this.nextLicensePlateId(tx),
        user_id: userId,
        plate_number: plateNumber,
        status: 'active',
        is_default: true,
      },
    });
  }

  private async nextPendingUserId(): Promise<bigint> {
    const max = await this.prisma.pending_users.aggregate({ _max: { id: true } });
    return (max._max.id ?? BigInt(0)) + BigInt(1);
  }

  async getRegistrationOptions() {
    const departments = await this.prisma.departments.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, department_name: true },
    });
    return {
      departments: departments.map((d) => ({
        id: d.id.toString(),
        departmentName: d.department_name,
      })),
    };
  }

  async submitPendingUser(dto: SubmitPendingUserDto) {
    const corpId = dto.corpId.trim();
    const firstName = String(dto.firstName ?? '').trim();
    const lastName = dto.lastName.trim();
    const employeeNo = dto.employeeNo?.trim() || null;
    const rank = dto.rank?.trim() || null;
    const email = dto.email.trim();
    const contactNo = dto.contactNo.trim();
    const reason = dto.reason?.trim() || null;
    const carPlateNo = dto.carPlateNo?.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase() || null;
    const departmentId = await this.resolveDepartmentId(dto.department);

    const [existingUser, existingPending] = await Promise.all([
      this.prisma.user.findFirst({
        where: { corpId },
        select: { id: true },
      }),
      this.prisma.pending_users.findFirst({
        where: { corp_id: corpId, approval_status: 'Pending' },
        select: { id: true },
      }),
    ]);
    if (existingUser || existingPending) {
      throw new ConflictException('This CORP User ID has already submitted or owns an account');
    }

    const id = await this.nextPendingUserId();
    const created = await this.prisma.pending_users.create({
      data: {
        id,
        corp_id: corpId,
        first_name: firstName,
        last_name: lastName,
        employee_no: employeeNo,
        rank,
        department_id: departmentId,
        email,
        contact_no: contactNo,
        reason,
        car_plate_no: carPlateNo,
        submitted_at: new Date(),
        approval_status: 'Pending',
      },
    });
    return {
      id: created.id.toString(),
      message: 'Application submitted',
    };
  }

  async listUsers(auth?: { isSuperAdmin?: boolean; role?: string }) {
    const rows = await this.prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: userSelect,
    });
    const visibleRows = isSuperAdminAuth(auth)
      ? rows
      : rows.filter((u) => !isSuperAdminRole(u.access_roles?.role_name ?? ''));
    return visibleRows.map((u) => this.mapUser(u));
  }

  async listUserOwnerOptions(
    auth: { isSuperAdmin?: boolean; role?: string } | undefined,
    keyword?: string,
    page: number = 1,
    pageSize: number = 20,
    scopeRaw?: string,
  ) {
    const q = String(keyword ?? '').trim();
    const scope = String(scopeRaw ?? '').trim().toLowerCase();
    const venueOwnerScope = scope === 'venue';
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safePageSize = Number.isFinite(pageSize) ? Math.min(100, Math.max(1, Math.floor(pageSize))) : 20;
    const skip = (safePage - 1) * safePageSize;

    const hideSuperAdmin =
      venueOwnerScope ||
      !isSuperAdminAuth(auth);

    const where: Prisma.UserWhereInput = {
      status: 'Active',
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { corpId: { contains: q, mode: 'insensitive' } },
              { employeeNo: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(hideSuperAdmin
        ? {
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
          }
        : {}),
      ...(venueOwnerScope
        ? {
            access_roles: {
              is: {
                OR: [
                  { annual_venue_quota: { gt: 0 } },
                  { annual_venue_quota: -1 },
                ],
              },
            },
          }
        : {}),
    };

    const rows = await this.prisma.user.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { corpId: 'asc' }],
      skip,
      take: safePageSize + 1,
      select: {
        id: true,
        corpId: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    });

    const hasMore = rows.length > safePageSize;
    const items = (hasMore ? rows.slice(0, safePageSize) : rows).map((u) => ({
      id: u.id.toString(),
      corpId: u.corpId,
      name: formatUserDisplayName(u),
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
      status: this.statusFromDb(u.status),
    }));

    return {
      items,
      page: safePage,
      pageSize: safePageSize,
      hasMore,
    };
  }

  async getUser(id: string, auth?: { isSuperAdmin?: boolean; role?: string }) {
    const bid = BigInt(id);
    const user = await this.prisma.user.findUnique({
      where: { id: bid },
      select: userSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    if (!isSuperAdminAuth(auth) && isSuperAdminRole(user.access_roles?.role_name ?? '')) {
      throw new NotFoundException('User not found');
    }
    return this.mapUser(user);
  }

  async createUser(
    dto: CreateUserDto,
    auth?: { isSuperAdmin?: boolean; role?: string; sub?: unknown },
  ) {
    const corpId = dto.corpId.trim();
    const departmentId = await this.resolveDepartmentId(dto.department);
    const accessRoleId = await this.resolveAccessRoleId(dto.role);
    this.assertCanAssignRole(dto.role, auth);
    const id = await this.nextUserId();
    const statusDb = this.statusToDb(dto.status);
    const plateNumber = this.normalizeCarPlateNo(dto.carPlateNo);
    const inactivedBy =
      statusDb === 'Inactive' ? await this.resolveActorDisplayName(auth) : null;
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            id,
            corpId,
            password: bcrypt.hashSync(dto.password, 10),
            firstName: String(dto.firstName ?? '').trim(),
            lastName: dto.lastName.trim(),
            employeeNo: dto.employeeNo?.trim() || null,
            rank: dto.rank?.trim() || null,
            email: dto.email?.trim() || null,
            contact: dto.contact?.trim() || null,
            departmentId,
            accessRoleId,
            annualQuotaEv: dto.annualQuotaEV ?? 30,
            usedQuotaEv: 0,
            annualQuotaVenue: dto.annualQuotaVenue ?? 30,
            usedQuotaVenue: 0,
            status: statusDb,
            ...(statusDb === 'Inactive'
              ? { inactiveTime: new Date(), inactivedBy }
              : {}),
          },
          select: userSelect,
        });
        if (plateNumber) {
          await this.createLinkedLicensePlate(tx, id, plateNumber);
        }
        return user;
      });
      return this.mapUser(created);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const target = Array.isArray(e.meta?.target)
          ? e.meta.target.join(',')
          : String(e.meta?.target ?? '');
        if (target.toLowerCase().includes('plate')) {
          throw new ConflictException('License plate already exists');
        }
        throw new ConflictException('CORP User ID already exists');
      }
      throw e;
    }
  }

  async updateUser(
    id: string,
    dto: UpdateUserDto,
    auth?: { isSuperAdmin?: boolean; role?: string; sub?: unknown },
  ) {
    const bid = BigInt(id);
    await this.assertTargetUserVisibleToActor(bid, auth);

    const data: Prisma.UserUncheckedUpdateInput = {};
    if (dto.corpId !== undefined) data.corpId = dto.corpId.trim();
    if (dto.firstName !== undefined) data.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) data.lastName = dto.lastName.trim();
    if (dto.employeeNo !== undefined) data.employeeNo = dto.employeeNo.trim() || null;
    if (dto.rank !== undefined) data.rank = dto.rank.trim() || null;
    if (dto.contact !== undefined) data.contact = dto.contact.trim() || null;
    if (dto.email !== undefined) data.email = dto.email?.trim() || null;
    if (dto.annualQuotaEV !== undefined) data.annualQuotaEv = dto.annualQuotaEV;
    if (dto.annualQuotaVenue !== undefined) data.annualQuotaVenue = dto.annualQuotaVenue;
    if (dto.usedQuotaEV !== undefined) data.usedQuotaEv = dto.usedQuotaEV;
    if (dto.usedQuotaVenue !== undefined) data.usedQuotaVenue = dto.usedQuotaVenue;
    if (dto.status !== undefined) {
      data.status = this.statusToDb(dto.status);
      const actorName =
        this.statusToDb(dto.status) === 'Inactive'
          ? await this.resolveActorDisplayName(auth)
          : null;
      Object.assign(data, this.inactiveFieldsForStatus(dto.status, actorName));
    }
    if (dto.password !== undefined && dto.password.trim() !== '') {
      data.password = bcrypt.hashSync(dto.password, 10);
    }
    if (dto.department !== undefined) {
      const trimmed = dto.department?.trim();
      data.departmentId = trimmed ? await this.resolveDepartmentId(trimmed) : null;
    }
    if (dto.role !== undefined) {
      const trimmed = dto.role?.trim();
      this.assertCanAssignRole(trimmed, auth);
      data.accessRoleId = trimmed ? await this.resolveAccessRoleId(trimmed) : null;
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id: bid },
        data,
        select: userSelect,
      });
      return this.mapUser(updated);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('CORP User ID already exists');
      }
      throw e;
    }
  }

  async deleteUser(id: string, auth?: { isSuperAdmin?: boolean; role?: string }) {
    const bid = BigInt(id);
    await this.assertTargetUserVisibleToActor(bid, auth);
    try {
      await this.prisma.user.delete({ where: { id: bid } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      throw e;
    }
    return { ok: true };
  }

  async replacePassword(id: string, plain: string, auth?: { isSuperAdmin?: boolean; role?: string }) {
    const bid = BigInt(id);
    await this.assertTargetUserVisibleToActor(bid, auth);
    await this.prisma.user.update({
      where: { id: bid },
      data: { password: bcrypt.hashSync(plain, 10) },
    });
    return { ok: true };
  }

  async resetUsedQuotas(id: string, auth?: { isSuperAdmin?: boolean; role?: string }) {
    const bid = BigInt(id);
    await this.assertTargetUserVisibleToActor(bid, auth);
    const updated = await this.prisma.user.update({
      where: { id: bid },
      data: { usedQuotaEv: 0, usedQuotaVenue: 0 },
      select: userSelect,
    });
    return this.mapUser(updated);
  }

  async updateStatus(
    id: string,
    statusFe: string,
    auth?: { isSuperAdmin?: boolean; role?: string; sub?: unknown },
  ) {
    const bid = BigInt(id);
    await this.assertTargetUserVisibleToActor(bid, auth);
    const data: Prisma.UserUpdateInput = { status: this.statusToDb(statusFe) };
    const actorName =
      this.statusToDb(statusFe) === 'Inactive'
        ? await this.resolveActorDisplayName(auth)
        : null;
    Object.assign(data, this.inactiveFieldsForStatus(statusFe, actorName));
    const updated = await this.prisma.user.update({
      where: { id: bid },
      data,
      select: userSelect,
    });
    return this.mapUser(updated);
  }

  async listPendingUsers() {
    const rows = await this.prisma.pending_users.findMany({
      where: { approval_status: 'Pending' },
      orderBy: { id: 'asc' },
      include: {
        departments: { select: { department_name: true } },
      },
    });
    return rows.map((p) => this.mapPendingUser(p));
  }

  async listPendingUsersByStatus(status?: string) {
    const normalized = String(status ?? '').trim().toLowerCase();
    const statusMap: Record<string, string> = {
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
    };
    const where = statusMap[normalized]
      ? { approval_status: statusMap[normalized] }
      : undefined;
    const rows = await this.prisma.pending_users.findMany({
      where,
      orderBy: { id: 'asc' },
      include: {
        departments: { select: { department_name: true } },
      },
    });
    return rows.map((p) => this.mapPendingUser(p));
  }

  async approvePending(
    id: string,
    dto: ApprovePendingDto,
    approverSub: any,
    auth?: { isSuperAdmin?: boolean; role?: string },
  ) {
    const pid = BigInt(id);
    const approverUserId = this.parseApproverId(approverSub);
    const approver = await this.prisma.user.findUnique({
      where: { id: approverUserId },
      select: userDisplayNameSelect,
    });
    if (!approver) {
      throw new NotFoundException('Approver user not found');
    }
    const p = await this.prisma.pending_users.findUnique({ where: { id: pid } });
    if (!p) throw new NotFoundException('Pending user not found');
    if (p.approval_status !== 'Pending') {
      throw new BadRequestException('Pending user already handled');
    }

    const corpId = (dto.corpId ?? p.corp_id).trim();
    const firstName =
      dto.firstName !== undefined ? dto.firstName.trim() : (p.first_name ?? '');
    const lastName =
      dto.lastName !== undefined ? dto.lastName.trim() : (p.last_name ?? '');
    const employeeNo =
      dto.employeeNo !== undefined
        ? dto.employeeNo.trim() || null
        : p.employee_no;
    const rank =
      dto.rank !== undefined ? dto.rank.trim() || null : p.rank;
    const contact =
      dto.contact !== undefined
        ? dto.contact.trim() || null
        : p.contact_no?.trim() || null;
    const email =
      dto.email !== undefined
        ? dto.email.trim() || null
        : p.email?.trim() || null;
    const departmentId =
      dto.department !== undefined
        ? await this.resolveDepartmentId(dto.department)
        : p.department_id;
    const roleName = String(dto.role ?? '').trim();
    if (!roleName) {
      throw new BadRequestException('Role is required');
    }
    this.assertCanAssignRole(roleName, auth);
    const accessRoleId = await this.resolveAccessRoleId(roleName);

    const newId = await this.nextUserId();
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id: newId,
            corpId,
            password: bcrypt.hashSync(dto.password, 10),
            firstName,
            lastName,
            employeeNo,
            rank,
            email,
            contact,
            departmentId,
            accessRoleId,
            annualQuotaEv: dto.annualQuotaEV ?? 30,
            usedQuotaEv: 0,
            annualQuotaVenue: dto.annualQuotaVenue ?? 30,
            usedQuotaVenue: 0,
            status: 'Active',
          },
        });
        if (this.isEvBookingReason(p.reason)) {
          const plateNumber = this.normalizeCarPlateNo(p.car_plate_no);
          if (!plateNumber) {
            throw new BadRequestException(
              'Car plate number is required for EV booking applications',
            );
          }
          await this.createLinkedLicensePlate(tx, newId, plateNumber);
        }
        await tx.pending_users.update({
          where: { id: pid },
          data: {
            approval_status: 'Approved',
            approver_user_id: approverUserId,
            approver_name: formatUserDisplayName(approver),
            reject_reason: null,
            handled_at: new Date(),
          },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const target = Array.isArray(e.meta?.target)
          ? e.meta.target.join(',')
          : String(e.meta?.target ?? '');
        if (target.toLowerCase().includes('plate')) {
          throw new ConflictException('License plate already exists');
        }
        throw new ConflictException('User with this CORP User ID already exists');
      }
      throw e;
    }

    return this.getUser(newId.toString());
  }

  async rejectPending(id: string, approverSub: any, rejectReason?: string) {
    const pid = BigInt(id);
    const approverUserId = this.parseApproverId(approverSub);
    const approver = await this.prisma.user.findUnique({
      where: { id: approverUserId },
      select: userDisplayNameSelect,
    });
    if (!approver) {
      throw new NotFoundException('Approver user not found');
    }
    try {
      const updated = await this.prisma.pending_users.update({
        where: { id: pid },
        data: {
          approval_status: 'Rejected',
          approver_user_id: approverUserId,
          approver_name: formatUserDisplayName(approver),
          reject_reason: rejectReason?.trim() || null,
          handled_at: new Date(),
        },
      });
      if (updated.approval_status !== 'Rejected') {
        throw new NotFoundException('Pending user not found');
      }
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Pending user not found');
      }
      throw e;
    }
    return { ok: true };
  }
}
