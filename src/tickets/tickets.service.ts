import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async getByCode(code: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { ticketCode: code },
      include: { event: true },
    });

    if (!registration) {
      throw new NotFoundException('Ticket not found');
    }

    return {
      ticket: {
        code: registration.ticketCode,
        status: registration.status,
        name: registration.name,
        email: registration.email,
        phone: registration.phone,
        checkedInAt: registration.checkedInAt?.toISOString() ?? null,
        createdAt: registration.createdAt.toISOString(),
        event: {
          id: registration.event.id,
          title: registration.event.title,
          slug: registration.event.slug,
          category: registration.event.category,
          coverImage: registration.event.coverImage,
          venue: registration.event.venue,
          timezone: registration.event.timezone,
          startsAt: registration.event.startsAt.toISOString(),
          endsAt: registration.event.endsAt.toISOString(),
          status: registration.event.status,
        },
      },
    };
  }
}
