import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateTicketCode } from '../common/ticket-code';
import { EventStatus, RegistrationStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { toTicketResponse } from './ticket.mapper';

const MAX_ATTEMPTS = 3;

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async register(slug: string, dto: CreateRegistrationDto) {
    const event = await this.prisma.event.findFirst({
      where: { slug, status: EventStatus.PUBLISHED },
      select: { id: true },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    for (let attempt = 1; ; attempt++) {
      try {
        return await this.registerOnce(event.id, dto);
      } catch (error) {
        // P2002 = a unique rule was hit (for example two identical ticket
        // codes). Retrying re-runs every check, so a real duplicate email
        // still ends in the correct 409.
        const isUniqueViolation = (error as { code?: string }).code === 'P2002';

        if (!isUniqueViolation || attempt >= MAX_ATTEMPTS) {
          throw error;
        }
      }
    }
  }

  private registerOnce(eventId: string, dto: CreateRegistrationDto) {
    const ticketCode = generateTicketCode(
      this.config.getOrThrow<string>('TICKET_SECRET'),
    );

    return this.prisma.$transaction(
      async (tx) => {
        // Lock this event's row until the transaction ends, so two people
        // cannot take the last seat at the same time.
        await tx.$queryRaw`
          SELECT "id"
          FROM "Event"
          WHERE "id" = ${eventId}
          FOR UPDATE
        `;

        const event = await tx.event.findUnique({
          where: { id: eventId },
        });

        if (!event || event.status !== EventStatus.PUBLISHED) {
          throw new NotFoundException('Event not found');
        }

        if (event.endsAt <= new Date()) {
          throw new ConflictException('Registration is closed for this event');
        }

        const duplicate = await tx.registration.findFirst({
          where: { eventId, email: dto.email },
          select: { id: true },
        });

        if (duplicate) {
          throw new ConflictException(
            'This email is already registered for this event',
          );
        }

        const taken = await tx.registration.count({
          where: {
            eventId,
            status: {
              in: [RegistrationStatus.CONFIRMED, RegistrationStatus.CHECKED_IN],
            },
          },
        });

        if (taken >= event.capacity) {
          throw new ConflictException('This event is full');
        }

        const registration = await tx.registration.create({
          data: {
            eventId,
            name: dto.name,
            email: dto.email,
            phone: dto.phone,
            ticketCode,
          },
          include: { event: true },
        });

        return { ticket: toTicketResponse(registration) };
      },
      { maxWait: 10_000, timeout: 20_000 },
    );
  }
}
