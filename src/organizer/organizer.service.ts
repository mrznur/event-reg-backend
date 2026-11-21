import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  EventStatus,
  RegistrationStatus,
  Role,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import type { SessionUser } from '../auth/auth.types';
import { CreateEventDto } from '../events/dto/create-event.dto';
import { UpdateEventDto } from '../events/dto/update-event.dto';
import { slugify } from '../common/slug';

// ── Shared includes ───────────────────────────────────────────────────────────

const ACTIVE_STATUSES = [
  RegistrationStatus.CONFIRMED,
  RegistrationStatus.CHECKED_IN,
];

const eventInclude = {
  _count: {
    select: {
      registrations: { where: { status: { in: ACTIVE_STATUSES } } },
    },
  },
} satisfies Prisma.EventInclude;

type EventWithCount = Prisma.EventGetPayload<{ include: typeof eventInclude }>;

function toOrganizerEvent(event: EventWithCount) {
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
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

function toRegistrationResponse(
  r: Prisma.RegistrationGetPayload<Record<string, never>>,
) {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    ticketCode: r.ticketCode,
    status: r.status,
    checkedInAt: r.checkedInAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

@Injectable()
export class OrganizerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // ── Events ────────────────────────────────────────────────────────────────

  async listEvents(user: SessionUser) {
    const events = await this.prisma.event.findMany({
      where: this.ownedWhere(user),
      orderBy: { startsAt: 'desc' },
      include: eventInclude,
    });
    return { events: events.map(toOrganizerEvent) };
  }

  async getEvent(id: string, user: SessionUser) {
    const event = await this.findOwnedOrThrow(id, user);
    return { event: toOrganizerEvent(event) };
  }

  async createEvent(user: SessionUser, dto: CreateEventDto) {
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
        timezone: dto.timezone,
        startsAt,
        endsAt,
        capacity: dto.capacity,
      },
      include: eventInclude,
    });
    return { event: toOrganizerEvent(event) };
  }

  async updateEvent(id: string, user: SessionUser, dto: UpdateEventDto) {
    const existing = await this.findOwnedOrThrow(id, user);
    if (existing.status === EventStatus.CANCELLED) {
      throw new BadRequestException('Cancelled events cannot be edited');
    }

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : existing.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : existing.endsAt;
    this.assertValidRange(startsAt, endsAt);

    const registered = existing._count.registrations;
    if (dto.capacity !== undefined && dto.capacity < registered) {
      throw new BadRequestException(
        `Capacity cannot be lower than the ${registered} current registrations`,
      );
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
    return { event: toOrganizerEvent(event) };
  }

  async publishEvent(id: string, user: SessionUser) {
    const existing = await this.findOwnedOrThrow(id, user);
    if (existing.status === EventStatus.PUBLISHED) {
      return { event: toOrganizerEvent(existing) };
    }
    if (existing.status === EventStatus.CANCELLED) {
      throw new BadRequestException('Cancelled events cannot be published');
    }
    if (existing.endsAt <= new Date()) {
      throw new BadRequestException('An event that has already ended cannot be published');
    }
    return this.setStatus(id, EventStatus.PUBLISHED);
  }

  async unpublishEvent(id: string, user: SessionUser) {
    const existing = await this.findOwnedOrThrow(id, user);
    if (existing.status === EventStatus.DRAFT) {
      return { event: toOrganizerEvent(existing) };
    }
    if (existing.status === EventStatus.CANCELLED) {
      throw new BadRequestException('Cancelled events cannot be unpublished');
    }
    return this.setStatus(id, EventStatus.DRAFT);
  }

  async cancelEvent(id: string, user: SessionUser) {
    const existing = await this.findOwnedOrThrow(id, user);
    if (existing.status === EventStatus.CANCELLED) {
      return { event: toOrganizerEvent(existing) };
    }
    const result = await this.setStatus(id, EventStatus.CANCELLED);

    // Notify all confirmed/checked-in registrants — fire and forget.
    const registrations = await this.prisma.registration.findMany({
      where: {
        eventId: id,
        status: { in: [RegistrationStatus.CONFIRMED, RegistrationStatus.CHECKED_IN] },
      },
      select: { name: true, email: true },
    });
    for (const r of registrations) {
      this.mail.sendEventCancellation({
        to: r.email,
        name: r.name,
        eventTitle: existing.title,
        venue: existing.venue,
        startsAt: existing.startsAt,
        timezone: existing.timezone,
      });
    }

    return result;
  }

  // ── Registrations ─────────────────────────────────────────────────────────

  async listRegistrations(id: string, user: SessionUser, q?: string) {
    await this.findOwnedOrThrow(id, user);

    const where: Prisma.RegistrationWhereInput = { eventId: id };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { ticketCode: { contains: q, mode: 'insensitive' } },
      ];
    }

    const registrations = await this.prisma.registration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return { registrations: registrations.map(toRegistrationResponse) };
  }

  // ── Check-in ──────────────────────────────────────────────────────────────

  async checkIn(eventId: string, user: SessionUser, ticketCode: string) {
    await this.findOwnedOrThrow(eventId, user);

    const registration = await this.prisma.registration.findFirst({
      where: { ticketCode, eventId },
    });

    if (!registration) {
      throw new NotFoundException('Ticket not found for this event');
    }

    if (registration.status === RegistrationStatus.CANCELLED) {
      throw new BadRequestException('This ticket has been cancelled');
    }

    if (registration.status === RegistrationStatus.CHECKED_IN) {
      return {
        ok: true,
        alreadyCheckedIn: true,
        warning: 'This ticket has already been checked in',
        registration: toRegistrationResponse(registration),
      };
    }

    const updated = await this.prisma.registration.update({
      where: { id: registration.id },
      data: {
        status: RegistrationStatus.CHECKED_IN,
        checkedInAt: new Date(),
        checkedInById: user.sub,
      },
    });

    return {
      ok: true,
      alreadyCheckedIn: false,
      registration: toRegistrationResponse(updated),
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private ownedWhere(user: SessionUser): Prisma.EventWhereInput {
    if (user.role === Role.ADMIN) return {};
    return { organizerId: user.sub };
  }

  private async findOwnedOrThrow(id: string, user: SessionUser) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: eventInclude,
    });
    if (!event) throw new NotFoundException('Event not found');
    if (user.role !== Role.ADMIN && event.organizerId !== user.sub) {
      throw new ForbiddenException('You do not own this event');
    }
    return event;
  }

  private async setStatus(id: string, status: EventStatus) {
    const event = await this.prisma.event.update({
      where: { id },
      data: { status },
      include: eventInclude,
    });
    return { event: toOrganizerEvent(event) };
  }

  private assertValidRange(startsAt: Date, endsAt: Date) {
    if (endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title);
    const taken = await this.prisma.event.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    const used = new Set(taken.map((e) => e.slug));
    used.add('mine');

    if (!used.has(base)) return base;
    let n = 2;
    while (used.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  }
}
