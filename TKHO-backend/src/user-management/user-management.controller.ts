import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { ApprovePendingDto } from './dto/approve-pending.dto';
import { CreateUserDto } from './dto/create-user.dto';
import {
  ListPendingUsersQuery,
  ListUsersQuery,
} from './dto/list-users-query.dto';
import { RejectPendingDto } from './dto/reject-pending.dto';
import { ReplacePasswordDto } from './dto/replace-password.dto';
import { SubmitPendingUserDto } from './dto/submit-pending-user.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserManagementService } from './user-management.service';

@ApiTags('user-management')
@Controller('api/user-management')
export class UserManagementController {
  constructor(private readonly userManagementService: UserManagementService) {}

  @Public()
  @Get('registration/options')
  getRegistrationOptions() {
    return this.userManagementService.getRegistrationOptions();
  }

  @Public()
  @Post('registration/submit')
  submitRegistration(@Body() dto: SubmitPendingUserDto) {
    return this.userManagementService.submitPendingUser(dto);
  }

  @ApiBearerAuth()
  @UseGuards(AdminRoleGuard)
  @Get('users')
  listUsers(@Req() req: any, @Query() query: ListUsersQuery) {
    return this.userManagementService.listUsers(req?.user, query);
  }

  @ApiBearerAuth()
  @UseGuards(AdminRoleGuard)
  @Get('users/options')
  listUserOwnerOptions(
    @Req() req: any,
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('scope') scope?: string,
  ) {
    return this.userManagementService.listUserOwnerOptions(
      req?.user,
      keyword,
      Number(page ?? 1),
      Number(pageSize ?? 20),
      scope,
    );
  }

  @ApiBearerAuth()
  @UseGuards(AdminRoleGuard)
  @Post('users')
  createUser(@Body() dto: CreateUserDto, @Req() req: any) {
    return this.userManagementService.createUser(dto, req?.user);
  }

  @ApiBearerAuth()
  @UseGuards(AdminRoleGuard)
  @Get('users/:id')
  getUser(@Param('id') id: string, @Req() req: any) {
    return this.userManagementService.getUser(id, req?.user);
  }

  @ApiBearerAuth()
  @UseGuards(AdminRoleGuard)
  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: any) {
    return this.userManagementService.updateUser(id, dto, req?.user);
  }

  @ApiBearerAuth()
  @UseGuards(AdminRoleGuard)
  @Delete('users/:id')
  deleteUser(@Param('id') id: string, @Req() req: any) {
    return this.userManagementService.deleteUser(id, req?.user);
  }

  @ApiBearerAuth()
  @UseGuards(AdminRoleGuard)
  @Patch('users/:id/password')
  replacePassword(@Param('id') id: string, @Body() dto: ReplacePasswordDto, @Req() req: any) {
    return this.userManagementService.replacePassword(id, dto.password, req?.user);
  }

  @ApiBearerAuth()
  @UseGuards(AdminRoleGuard)
  @Patch('users/:id/quotas/reset')
  resetUsedQuotas(@Param('id') id: string, @Req() req: any) {
    return this.userManagementService.resetUsedQuotas(id, req?.user);
  }

  @ApiBearerAuth()
  @UseGuards(AdminRoleGuard)
  @Patch('users/:id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto, @Req() req: any) {
    return this.userManagementService.updateStatus(id, dto.status, req?.user);
  }

  @ApiBearerAuth()
  @UseGuards(AdminRoleGuard)
  @Get('pending-users')
  listPendingUsers(@Query() query: ListPendingUsersQuery) {
    return this.userManagementService.listPendingUsersByStatus(query);
  }

  @ApiBearerAuth()
  @UseGuards(AdminRoleGuard)
  @Post('pending-users/:id/approve')
  approvePending(@Param('id') id: string, @Body() dto: ApprovePendingDto, @Req() req: any) {
    return this.userManagementService.approvePending(id, dto, req?.user?.sub, req?.user);
  }

  @ApiBearerAuth()
  @UseGuards(AdminRoleGuard)
  @Post('pending-users/:id/reject')
  rejectPending(@Param('id') id: string, @Body() dto: RejectPendingDto, @Req() req: any) {
    return this.userManagementService.rejectPending(id, req?.user?.sub, dto.rejectReason);
  }
}
