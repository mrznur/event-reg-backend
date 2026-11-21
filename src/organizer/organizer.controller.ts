import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/auth.current-user.decorator';
import type { SessionUser } from '../auth/auth.types';
import { Role } from '../generated/prisma/enums';
import { CreateEventDto } from '../events/dto/create-event.dto';
import { UpdateEventDto } from '../events/dto/update-event.dto';
import { CheckInDto } from './dto/check-in.dto';
import { OrganizerService } from './organizer.service';

@Controller('organizer')
@UseGuards(AuthGuard, RoleGuard)
@Roles(Role.ORGANIZER, Role.ADMIN)
export class OrganizerController {
  constructor(private readonly organizer: OrganizerService) {}

  // ── Events ────────────────────────────────────────────────────────────────

  // GET /api/organizer/events
  @Get('events')
  listEvents(@CurrentUser() user: SessionUser) {
    return this.organizer.listEvents(user);
  }

  // GET /api/organizer/events/:id
  @Get('events/:id')
  getEvent(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.organizer.getEvent(id, user);
  }

  // POST /api/organizer/events
  @Post('events')
  createEvent(
    @CurrentUser() user: SessionUser,
    @Body() dto: CreateEventDto,
  ) {
    return this.organizer.createEvent(user, dto);
  }

  // PATCH /api/organizer/events/:id
  @Patch('events/:id')
  updateEvent(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
    @Body() dto: UpdateEventDto,
  ) {
    return this.organizer.updateEvent(id, user, dto);
  }

  // PATCH /api/organizer/events/:id/publish
  @Patch('events/:id/publish')
  publishEvent(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.organizer.publishEvent(id, user);
  }

  // PATCH /api/organizer/events/:id/unpublish
  @Patch('events/:id/unpublish')
  unpublishEvent(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.organizer.unpublishEvent(id, user);
  }

  // PATCH /api/organizer/events/:id/cancel
  @Patch('events/:id/cancel')
  cancelEvent(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.organizer.cancelEvent(id, user);
  }

  // ── Registrations ─────────────────────────────────────────────────────────

  // GET /api/organizer/events/:id/registrations?q=
  @Get('events/:id/registrations')
  listRegistrations(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
    @Query('q') q?: string,
  ) {
    return this.organizer.listRegistrations(id, user, q);
  }

  // ── Check-in ──────────────────────────────────────────────────────────────

  // POST /api/organizer/events/:id/check-in
  @Post('events/:id/check-in')
  checkIn(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
    @Body() dto: CheckInDto,
  ) {
    return this.organizer.checkIn(id, user, dto.ticketCode);
  }
}
