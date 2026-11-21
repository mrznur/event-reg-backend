import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { ListEventsQuery } from './dto/list-events.query';
import { EventsService } from './events.service';

// Public-facing event routes — no auth required.
// All organizer write operations live in /api/organizer/events/*.
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  // GET /api/events
  // GET /api/events?category=WORKSHOP&upcoming=true&limit=10
  @Get()
  list(@Query() query: ListEventsQuery) {
    return this.events.listPublic(query);
  }

  // GET /api/events/:slug
  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.events.getPublishedBySlug(slug);
  }
}
