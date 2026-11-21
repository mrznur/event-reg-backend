import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  EventStatus,
  RegistrationStatus,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { ListEventsQuery } from './dto/list-events.query';

const ACTIVE_REGISTRATION_STATUSES = [
  RegistrationStatus.CONFIRMED,
  RegistrationStatus.CHECKED_IN,
];

export const eventInclude = {
  _count: {
    select: {
      registrations: {
        where: { status: { in: ACTIVE_REGISTRATION_STATUSES } },
      },
    },
  },
} satisfies Prisma.EventInclude;

type EventWithCount = Prisma.EventGetPayload<{ include: typeof eventInclude }>;

export function toEventResponse(event: EventWithCount) {
  const registeredCount = event._count.registrations;
  return {
    id: event.id,
    title: event.title,
    slug: event.slug,
    description: event.description,
    category: event.category,
    coverImage: event.coverImage,
    venue: event.venue,
    timezone: event.timezone,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    capacity: event.capacity,
    status: event.status,
    registeredCount,
    spotsLeft: Math.max(0, event.capacity - registeredCount),
  };
}

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(query: ListEventsQuery) {
    const where: Prisma.EventWhereInput = { status: EventStatus.PUBLISHED };
    if (query.category) where.category = query.category;
    if (query.upcoming === 'true') where.endsAt = { gt: new Date() };

    const events = await this.prisma.event.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      take: query.limit ?? 100,
      include: eventInclude,
    });
    return { events: events.map(toEventResponse) };
  }

  async getPublishedBySlug(slug: string) {
    const event = await this.prisma.event.findFirst({
      where: { slug, status: EventStatus.PUBLISHED },
      include: eventInclude,
    });
    if (!event) throw new NotFoundException('Event not found');
    return { event: toEventResponse(event) };
  }
}
