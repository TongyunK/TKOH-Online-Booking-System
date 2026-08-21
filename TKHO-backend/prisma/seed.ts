import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { seedData } from './seed-data';

const prisma = new PrismaClient();

/** Parse HH:mm for @db.Time fields (time-only, UTC base date). */
function parseTimeHm(value: string): Date {
  return new Date(`1970-01-01T${value}:00.000Z`);
}

/** 解除对 departments / access_roles 的外键引用，以便 deleteMany 重建 seed 数据 */
async function detachDepartmentAndRoleReferences() {
  await prisma.user.updateMany({ data: { departmentId: null, accessRoleId: null } });
  await prisma.pending_users.updateMany({
    data: {
      department_id: null,
      access_role_id: null,
      approver_user_id: null,
    },
  });
}

async function main() {
  await detachDepartmentAndRoleReferences();

  const departmentList = seedData.departmentList ?? [];
  const accessRoleList = seedData.accessRoleList ?? [];
  const users = seedData.users ?? [];
  const venues = seedData.venues;
  const evSlots = seedData.evSlots;
  const evPeriods = seedData.evPeriods;
  const licensePlates = seedData.licensePlates;
  const prompts = seedData.prompts ?? [];

  console.log('[seed] data source: TKHO-backend/prisma/seed-data.ts');

  if (departmentList.length > 0) {
    await prisma.departments.deleteMany();
    await prisma.departments.createMany({
      data: departmentList.map((row) => ({
        id: BigInt(row.id),
        department_name: row.departmentName,
        description: row.description ?? null,
        employee_count: row.employeeCount ?? 0,
      })),
    });
  }

  if (accessRoleList.length > 0) {
    await prisma.access_roles.deleteMany();
    await prisma.access_roles.createMany({
      data: accessRoleList.map((row) => ({
        id: BigInt(row.id),
        role_name: row.roleName,
        description: row.description ?? null,
        annual_venue_quota: row.annualVenueQuota ?? 0,
        annual_ev_quota: row.annualEvQuota ?? 0,
        employee_count: row.employeeCount ?? 0,
      })),
    });
  }

  if (users.length > 0) {
    for (const row of users) {
      const userId = BigInt(row.id);
      const departmentId = BigInt(row.departmentId);
      const accessRoleId = BigInt(row.accessRoleId);
      await prisma.user.upsert({
        where: { id: userId },
        update: {
          corpId: row.corpId,
          account: row.corpId,
          name: row.name,
          email: row.email,
          contact: row.contact,
          annualQuotaEv: row.annualQuotaEV ?? 0,
          usedQuotaEv: row.usedQuotaEV ?? 0,
          annualQuotaVenue: row.annualQuotaVenue ?? 0,
          usedQuotaVenue: row.usedQuotaVenue ?? 0,
          status: 'Active',
          departmentId,
          accessRoleId,
        },
        create: {
          id: userId,
          corpId: row.corpId,
          account: row.corpId,
          password: bcrypt.hashSync('123456', 10),
          name: row.name,
          email: row.email,
          contact: row.contact,
          annualQuotaEv: row.annualQuotaEV ?? 0,
          usedQuotaEv: row.usedQuotaEV ?? 0,
          annualQuotaVenue: row.annualQuotaVenue ?? 0,
          usedQuotaVenue: row.usedQuotaVenue ?? 0,
          status: 'Active',
          departmentId,
          accessRoleId,
        },
      });
    }
  }

  if (venues.length > 0) {
    for (const row of venues) {
      const venueId = BigInt(row.id);
      await prisma.venues.upsert({
        where: { id: venueId },
        update: {
          name: row.name,
          nameZh: row.nameZh ?? null,
          tab: row.tab ?? null,
          venueType: row.type ?? null,
          roomCapacity: row.roomCapacity ?? row.capacity ?? null,
          color: row.color ?? null,
          location: row.location ?? null,
          locationZh: row.locationZh ?? null,
          displayType: row.displayType ?? null,
          userDefinedUploadEventTitle: row.userDefinedUploadEventTitle !== false,
          imageUrl: row.image ?? null,
          status: row.status ?? 'active',
        },
        create: {
          id: venueId,
          name: row.name,
          nameZh: row.nameZh ?? null,
          tab: row.tab ?? null,
          venueType: row.type ?? null,
          roomCapacity: row.roomCapacity ?? row.capacity ?? null,
          color: row.color ?? null,
          location: row.location ?? null,
          locationZh: row.locationZh ?? null,
          displayType: row.displayType ?? null,
          userDefinedUploadEventTitle: row.userDefinedUploadEventTitle !== false,
          imageUrl: row.image ?? null,
          status: row.status ?? 'active',
        },
      });
    }
  }

  if (evSlots.length > 0) {
    for (const row of evSlots) {
      const id = BigInt(row.id);
      await prisma.evParkingSlots.upsert({
        where: { id },
        update: {
          evSpace: row.evSpace,
          location: row.location ?? null,
          status: row.status ?? 'active',
        },
        create: {
          id,
          evSpace: row.evSpace,
          location: row.location ?? null,
          status: row.status ?? 'active',
        },
      });
    }
  }

  if (evPeriods.length > 0) {
    for (const row of evPeriods) {
      const id = BigInt(row.id);
      await prisma.evTimePeriods.upsert({
        where: { id },
        update: {
          period: row.period,
          startTime: parseTimeHm(row.startTime),
          endTime: parseTimeHm(row.endTime),
          status: row.status ?? 'active',
        },
        create: {
          id,
          period: row.period,
          startTime: parseTimeHm(row.startTime),
          endTime: parseTimeHm(row.endTime),
          status: row.status ?? 'active',
        },
      });
    }
  }

  if (licensePlates.length > 0) {
    for (const row of licensePlates) {
      const id = BigInt(row.id);
      const userId = row.userId != null ? BigInt(row.userId) : null;
      await prisma.license_plates.upsert({
        where: { id },
        update: {
          user_id: userId,
          plate_number: row.plateNumber,
          is_default: row.isDefault === true,
          status: row.status ?? 'active',
        },
        create: {
          id,
          user_id: userId,
          plate_number: row.plateNumber,
          is_default: row.isDefault === true,
          status: row.status ?? 'active',
        },
      });
    }
  }

  if (prompts.length > 0) {
    for (const row of prompts) {
      const id = BigInt(row.id);
      await prisma.prompts.upsert({
        where: { id },
        update: {
          prompt_key: row.promptKey,
          name: row.name,
          content: row.content,
          category: row.category,
          can_add: row.canAdd === true,
          template_type: row.templateType ?? null,
        },
        create: {
          id,
          prompt_key: row.promptKey,
          name: row.name,
          content: row.content,
          category: row.category,
          can_add: row.canAdd === true,
          template_type: row.templateType ?? null,
        },
      });
    }
  }

  console.log(
    `[seed] done: departments=${departmentList.length}, accessRoles=${accessRoleList.length}, users=${users.length}, venues=${venues.length}, evSlots=${evSlots.length}, evPeriods=${evPeriods.length}, licensePlates=${licensePlates.length}, prompts=${prompts.length}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
