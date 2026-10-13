import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { EvManagementService } from './ev-management.service';
import { CreateEvParkingDto } from './dto/create-ev-parking.dto';
import { UpdateEvParkingDto } from './dto/update-ev-parking.dto';
import { CreateEvTimePeriodDto } from './dto/create-ev-time-period.dto';
import { UpdateEvTimePeriodDto } from './dto/update-ev-time-period.dto';
import { PublishEvWindowDto } from './dto/publish-ev-window.dto';
import { EvPublicDisplayQueryDto } from './dto/ev-public-display-query.dto';
import { ListEvBookingsQueryDto } from './dto/list-ev-bookings-query.dto';
import { UpdateEvManageBookingDto } from './dto/update-ev-manage-booking.dto';

@ApiTags('ev-management')
@ApiBearerAuth()
@Controller('api/ev-management')
export class EvManagementController {
  constructor(private readonly evManagementService: EvManagementService) {}

  @Public()
  @Get('public/display')
  getPublicDisplay(@Query() query: EvPublicDisplayQueryDto) {
    return this.evManagementService.getPublicDisplayData(query.date);
  }

  @Get('parking')
  listParking() {
    return this.evManagementService.listParkingSlots();
  }

  @Post('parking')
  createParking(@Body() dto: CreateEvParkingDto) {
    return this.evManagementService.createParkingSlot(dto);
  }

  @Patch('parking/:id')
  updateParking(@Param('id') id: string, @Body() dto: UpdateEvParkingDto) {
    return this.evManagementService.updateParkingSlot(id, dto);
  }

  @Delete('parking/:id')
  deleteParking(
    @Param('id') id: string,
    @Query('cascadeRelated') cascadeRelated?: string,
  ) {
    const cascade =
      cascadeRelated === 'true' || cascadeRelated === '1' || cascadeRelated === 'yes';
    return this.evManagementService.deleteParkingSlot(id, cascade);
  }

  @Get('time-periods')
  listTimePeriods() {
    return this.evManagementService.listTimePeriods();
  }

  @Post('time-periods')
  createTimePeriod(@Body() dto: CreateEvTimePeriodDto) {
    return this.evManagementService.createTimePeriod(dto);
  }

  @Patch('time-periods/:id')
  updateTimePeriod(@Param('id') id: string, @Body() dto: UpdateEvTimePeriodDto) {
    return this.evManagementService.updateTimePeriod(id, dto);
  }

  @Delete('time-periods/:id')
  deleteTimePeriod(
    @Param('id') id: string,
    @Query('cascadeRelated') cascadeRelated?: string,
  ) {
    const cascade =
      cascadeRelated === 'true' || cascadeRelated === '1' || cascadeRelated === 'yes';
    return this.evManagementService.deleteTimePeriod(id, cascade);
  }

  @Get('booking-window')
  getBookingWindow() {
    return this.evManagementService.getEvBookingWindow();
  }

  @Patch('booking-window')
  publishBookingWindow(@Body() dto: PublishEvWindowDto) {
    return this.evManagementService.publishEvBookingWindow(dto);
  }

  @Get('bookings')
  listBookings(
    @Req() req: { user: { sub?: string; corpId?: string; role?: string; system?: string } },
    @Query() query: ListEvBookingsQueryDto,
  ) {
    return this.evManagementService.listManageBookings(req.user, {
      ...query,
      scope: query.scope ?? 'my',
    });
  }

  @Patch('bookings/:id/cancel')
  cancelBooking(
    @Req() req: { user: { sub?: string; corpId?: string; role?: string; system?: string } },
    @Param('id') id: string,
  ) {
    return this.evManagementService.cancelManageBooking(req.user, id);
  }

  @Patch('bookings/:id')
  updateBooking(
    @Req() req: { user: { sub?: string; corpId?: string; role?: string; system?: string } },
    @Param('id') id: string,
    @Body() dto: UpdateEvManageBookingDto,
  ) {
    return this.evManagementService.updateManageBooking(req.user, id, dto);
  }
}
