import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { ApproveBookingDto } from './dto/approve-booking.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';
import { MeetingApprovalListQuery } from './dto/list-bookings-query.dto';
import { MeetingApprovalService } from './meeting-approval.service';

@ApiTags('meeting-approval')
@ApiBearerAuth()
@UseGuards(AdminRoleGuard)
@Controller('api/admin/bookings')
export class MeetingApprovalController {
  constructor(private readonly meetingApprovalService: MeetingApprovalService) {}

  @Get('pending')
  listPending(@Query() query: MeetingApprovalListQuery) {
    return this.meetingApprovalService.listPending(query);
  }

  @Get('pending-expired')
  listPendingExpired(@Query() query: MeetingApprovalListQuery) {
    return this.meetingApprovalService.listPendingExpired(query);
  }

  @Get('approved')
  listApproved(@Query() query: MeetingApprovalListQuery) {
    return this.meetingApprovalService.listByApprovalStatus('approved', query);
  }

  @Get('rejected')
  listRejected(@Query() query: MeetingApprovalListQuery) {
    return this.meetingApprovalService.listByApprovalStatus('rejected', query);
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveBookingDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.meetingApprovalService.approveBooking(id, dto, req?.user?.sub);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectBookingDto,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.meetingApprovalService.rejectBooking(id, dto, req?.user?.sub);
  }
}
