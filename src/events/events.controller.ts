import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { SessionUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/auth.current-user.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { ListEventsQuery } from './dto/list-events.query';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(@Query() query: ListEventsQuery) {
    return this.events.listPublic(query);
  }

  // Must stay above ':slug'.
  @Get('mine')
  @UseGuards(AuthGuard)
  mine(@CurrentUser() user: SessionUser) {
    return this.events.listMine(user);
  }

  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.events.getPublishedBySlug(slug);
  }

  @Post()
  @UseGuards(AuthGuard)
  create(@CurrentUser() user: SessionUser, @Body() dto: CreateEventDto) {
    return this.events.create(user, dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  update(
    @Param('id') id: string,
    @CurrentUser() user: SessionUser,
    @Body() dto: UpdateEventDto,
  ) {
    return this.events.update(id, user, dto);
  }

  @Post(':id/publish')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  publish(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.events.publish(id, user);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  cancel(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.events.cancel(id, user);
  }
}
