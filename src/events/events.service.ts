import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SessionUser } from '../auth/auth.types';
import { slugify } from '../common/slug';
import { Prisma } from '../generated/prisma/client';
import {
  EventStatus,
  RegistrationStatus,
  Role,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { ListEventsQuery } from './dto/list-events.query';
import { UpdateEventDto } from './dto/update-event.dto';

const ACTIVE_REGISTRATION_STATUSES = [
  RegistrationStatus.CONFIRMED,
  RegistrationStatus.CHECKED_IN,
];

// Counts only CONFIRMED and CHECKED_IN registrations for each event.
const eventInclude = {
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

  async listMine(user: SessionUser) {
    const events = await this.prisma.event.findMany({
      where: { organizerId: user.sub },
      orderBy: { startsAt: 'desc' },
      include: eventInclude,
    });
    return { events: events.map(toEventResponse) };
  }

  async create(user: SessionUser, dto: CreateEventDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    this.assertValidRange(startsAt, endsAt);

    const slug = await this.uniqueSlug(dto.title);
    const event = await this.prisma.event.create({
      data: {
        organizerId: user.sub,
        title: dto.title,
        slug,
        description: dto.description,
        category: dto.category,
        coverImage: dto.coverImage,
        venue: dto.venue,
        timezone: dto.timezone, // undefined falls back to the schema default
        startsAt,
        endsAt,
        capacity: dto.capacity,
      },
      include: eventInclude,
    });
    return { event: toEventResponse(event) };
  }

  async update(id: string, user: SessionUser, dto: UpdateEventDto) {
    const existing = await this.findOwnedOrThrow(id, user);
    if (existing.status === EventStatus.CANCELLED) {
      throw new BadRequestException(['Cancelled events cannot be edited']);
    }

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : existing.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : existing.endsAt;
    this.assertValidRange(startsAt, endsAt);

    const registered = existing._count.registrations;
    if (dto.capacity !== undefined && dto.capacity < registered) {
      throw new BadRequestException([
        `capacity cannot be lower than the ${registered} current registrations`,
      ]);
    }

    const event = await this.prisma.event.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        coverImage: dto.coverImage,
        venue: dto.venue,
        timezone: dto.timezone,
        startsAt: dto.startsAt ? startsAt : undefined,
        endsAt: dto.endsAt ? endsAt : undefined,
        capacity: dto.capacity,
      },
      include: eventInclude,
    });
    return { event: toEventResponse(event) };
  }

  async publish(id: string, user: SessionUser) {
    const existing = await this.findOwnedOrThrow(id, user);
    if (existing.status === EventStatus.PUBLISHED) {
      return { event: toEventResponse(existing) };
    }
    if (existing.status === EventStatus.CANCELLED) {
      throw new BadRequestException(['Cancelled events cannot be published']);
    }
    if (existing.endsAt <= new Date()) {
      throw new BadRequestException([
        'An event that has already ended cannot be published',
      ]);
    }
    return this.setStatus(id, EventStatus.PUBLISHED);
  }

  async cancel(id: string, user: SessionUser) {
    const existing = await this.findOwnedOrThrow(id, user);
    if (existing.status === EventStatus.CANCELLED) {
      return { event: toEventResponse(existing) };
    }
    return this.setStatus(id, EventStatus.CANCELLED);
  }

  private async setStatus(id: string, status: EventStatus) {
    const event = await this.prisma.event.update({
      where: { id },
      data: { status },
      include: eventInclude,
    });
    return { event: toEventResponse(event) };
  }

  // 404 if missing, 403 if the caller is an organizer who does not own it.
  private async findOwnedOrThrow(id: string, user: SessionUser) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: eventInclude,
    });
    if (!event) throw new NotFoundException('Event not found');
    if (user.role !== Role.ADMIN && event.organizerId !== user.sub) {
      throw new ForbiddenException('You can only manage your own events');
    }
    return event;
  }

  private assertValidRange(startsAt: Date, endsAt: Date) {
    if (endsAt <= startsAt) {
      throw new BadRequestException(['endsAt must be after startsAt']);
    }
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    const taken = await this.prisma.event.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    const used = new Set(taken.map((e) => e.slug));
    used.add('mine'); // reserved: /events/mine is a route, not a slug

    if (!used.has(base)) return base;
    let n = 2;
    while (used.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  }
}
