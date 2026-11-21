import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventStatus, Role } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { SessionUser } from '../auth/auth.types';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Users ─────────────────────────────────────────────────────────────────

  async listUsers() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        verified: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return { users };
  }

  async deleteUser(targetId: string, caller: SessionUser) {
    if (targetId === caller.sub) {
      throw new BadRequestException('You cannot delete your own account.');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, role: true },
    });

    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (target.role === Role.ADMIN) {
      throw new BadRequestException('Admin accounts cannot be deleted.');
    }

    await this.prisma.user.delete({ where: { id: targetId } });
    return { ok: true };
  }

  // ── Events ────────────────────────────────────────────────────────────────

  async listAllEvents() {
    const events = await this.prisma.event.findMany({
      include: {
        organizer: { select: { id: true, name: true, email: true } },
        _count: { select: { registrations: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        slug: e.slug,
        description: e.description,
        category: e.category,
        coverImage: e.coverImage,
        venue: e.venue,
        timezone: e.timezone,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt.toISOString(),
        capacity: e.capacity,
        status: e.status,
        registeredCount: e._count.registrations,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
        organizer: e.organizer,
      })),
    };
  }

  async cancelEvent(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.status === EventStatus.CANCELLED) {
      return { ok: true };
    }

    await this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.CANCELLED },
    });

    return { ok: true };
  }
}
