import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { Public } from '../auth/decorators/public.decorator';
import { VenueManagementService } from './venue-management.service';
import { UpsertVenueDto } from './dto/upsert-venue.dto';
import { PublishVenueWindowDto } from './dto/publish-venue-window.dto';
import { CreateVenueBlockDto } from './dto/create-venue-block.dto';
import { ListVenueBookingsQueryDto } from './dto/list-venue-bookings-query.dto';
import { UpdateVenueManageBookingDto } from './dto/update-venue-manage-booking.dto';
import {
  ApproveVenueManageBookingDto,
  RejectVenueManageBookingDto,
} from './dto/review-venue-booking.dto';
import { TeaServiceDisplayQueryDto } from './dto/tea-service-display-query.dto';
import { UpdateTeaNoRequestCompletedDto } from './dto/update-tea-no-request-completed.dto';
import { UpdateTeaServiceCompletedDto } from './dto/update-tea-service-completed.dto';
import { VenuePublicDisplayQueryDto } from './dto/venue-public-display-query.dto';
import { VenueMergePublicDisplayQueryDto } from './dto/venue-merge-public-display-query.dto';

@ApiTags('venue-management')
@ApiBearerAuth()
@Controller('api/venue-management')
export class VenueManagementController {
  constructor(private readonly venueService: VenueManagementService) {}

  @Public()
  @Get('public/tea-service-display')
  getPublicTeaServiceDisplay(@Query() query: TeaServiceDisplayQueryDto) {
    return this.venueService.getPublicTeaServiceDisplay(query.fromDate);
  }

  @Public()
  @Patch('public/tea-service-display/requests/:bookingId/completed')
  setPublicTeaServiceCompleted(
    @Param('bookingId') bookingId: string,
    @Body() dto: UpdateTeaServiceCompletedDto,
  ) {
    return this.venueService.setPublicTeaServiceCompleted(bookingId, dto.completed);
  }

  @Public()
  @Patch('public/tea-service-display/no-request-completed')
  setPublicTeaNoRequestCompleted(@Body() dto: UpdateTeaNoRequestCompletedDto) {
    return this.venueService.setPublicTeaNoRequestCompleted(
      dto.date,
      dto.venueName,
      dto.completed,
    );
  }

  @Public()
  @Get('public/venue-display')
  getPublicVenueDisplay(@Query() query: VenuePublicDisplayQueryDto) {
    return this.venueService.getPublicVenueDisplay(query.venueId, query.date);
  }

  @Public()
  @Get('public/venue-merge-display')
  getPublicVenueMergeDisplay(@Query() query: VenueMergePublicDisplayQueryDto) {
    return this.venueService.getPublicVenueMergeDisplay(query.date);
  }

  @Get('venues')
  listVenues() {
    return this.venueService.listVenues();
  }

  @Post('venues')
  createVenue(@Body() dto: UpsertVenueDto) {
    return this.venueService.createVenue(dto);
  }

  @Patch('venues/:id')
  updateVenue(@Param('id') id: string, @Body() dto: UpsertVenueDto) {
    return this.venueService.updateVenue(id, dto);
  }

  @Delete('venues/:id')
  deleteVenue(
    @Param('id') id: string,
    @Query('cascadeRelated') cascadeRelated?: string,
  ) {
    const cascade =
      cascadeRelated === 'true' || cascadeRelated === '1' || cascadeRelated === 'yes';
    return this.venueService.deleteVenue(id, cascade);
  }

  @Post('venues/:id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), 'uploads', 'venues'),
        filename: (_, file, cb) => {
          const ext = extname(file.originalname || '').toLowerCase();
          const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
          cb(null, `venue-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_, file, cb) => {
        const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
        cb(ok ? null : new BadRequestException('Only jpg/png/webp allowed'), ok);
      },
    }),
  )
  uploadVenueImage(@Param('id') id: string, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('Image file is required');
    return this.venueService.saveVenueImage(id, file.filename);
  }

  @Get('booking-window')
  getVenueWindow() {
    return this.venueService.getVenueWindow();
  }

  @Patch('booking-window')
  publishVenueWindow(@Body() dto: PublishVenueWindowDto) {
    return this.venueService.publishVenueWindow(dto);
  }

  @Post('venues/:id/blocks')
  addBlock(@Param('id') id: string, @Body() dto: CreateVenueBlockDto) {
    return this.venueService.addBlock(id, dto);
  }

  @Delete('venues/:venueId/blocks/:blockId')
  removeBlock(@Param('venueId') venueId: string, @Param('blockId') blockId: string) {
    return this.venueService.removeBlock(venueId, blockId);
  }

  @Get('bookings')
  listVenueBookings(
    @Req() req: { user: { sub?: string; corpId?: string; role?: string; system?: string } },
    @Query() query: ListVenueBookingsQueryDto,
  ) {
    return this.venueService.listManageBookings(req.user, {
      ...query,
      scope: query.scope ?? 'my',
    });
  }

  @Patch('bookings/:id')
  updateVenueBooking(
    @Req() req: { user: { sub?: string; corpId?: string; role?: string; system?: string } },
    @Param('id') id: string,
    @Body() dto: UpdateVenueManageBookingDto,
  ) {
    return this.venueService.updateManageBooking(req.user, id, dto);
  }

  @Patch('bookings/:id/toggle-cancel')
  toggleCancelVenueBooking(
    @Req() req: { user: { sub?: string; corpId?: string; role?: string; system?: string } },
    @Param('id') id: string,
  ) {
    return this.venueService.toggleCancelManageBooking(req.user, id);
  }

  @Post('bookings/:id/approve')
  approveVenueBooking(
    @Req() req: { user: { sub?: string; corpId?: string; role?: string; system?: string } },
    @Param('id') id: string,
    @Body() dto: ApproveVenueManageBookingDto,
  ) {
    return this.venueService.approveManageBooking(req.user, id, dto);
  }

  @Post('bookings/:id/reject')
  rejectVenueBooking(
    @Req() req: { user: { sub?: string; corpId?: string; role?: string; system?: string } },
    @Param('id') id: string,
    @Body() dto: RejectVenueManageBookingDto,
  ) {
    return this.venueService.rejectManageBooking(req.user, id, dto);
  }
}

