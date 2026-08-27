import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AccountVehiclesModule } from './account-vehicles/account-vehicles.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { HealthModule } from './health/health.module';
import { MetaModule } from './meta/meta.module';
import { ParkingModule } from './parking/parking.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { VenueManagementModule } from './venue-management/venue-management.module';
import { AccessRightModule } from './access-right/access-right.module';
import { EvManagementModule } from './ev-management/ev-management.module';
import { PromptManagementModule } from './prompt-management/prompt-management.module';
import { UserManagementModule } from './user-management/user-management.module';
import { LicensePlateManagementModule } from './license-plate-management/license-plate-management.module';
import { DisplayManagementModule } from './display-management/display-management.module';
import { SystemSettingsModule } from './system-settings/system-settings.module';
import { MeetingApprovalModule } from './meeting-approval/meeting-approval.module';
import { AdminPendingModule } from './admin-pending/admin-pending.module';
import { VenueCalendarModule } from './venue-calendar/venue-calendar.module';
import { DataBackupModule } from './data-backup/data-backup.module';
import { DataRetentionModule } from './data-retention/data-retention.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    AccountVehiclesModule,
    AuthModule,
    HealthModule,
    MetaModule,
    ParkingModule,
    VenueManagementModule,
    AccessRightModule,
    EvManagementModule,
    PromptManagementModule,
    UserManagementModule,
    LicensePlateManagementModule,
    DisplayManagementModule,
    SystemSettingsModule,
    MeetingApprovalModule,
    AdminPendingModule,
    VenueCalendarModule,
    DataBackupModule,
    DataRetentionModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
