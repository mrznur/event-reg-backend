import { Injectable } from '@nestjs/common';
import { EventStatus, RegistrationStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [events, registrations, checkedIn, membersStat] = await Promise.all([
      this.prisma.event.count({
        where: { status: EventStatus.PUBLISHED, endsAt: { lt: new Date() } },
      }),
      this.prisma.registration.count({
        where: {
          status: {
            in: [RegistrationStatus.CONFIRMED, RegistrationStatus.CHECKED_IN],
          },
        },
      }),
      this.prisma.registration.count({
        where: { status: RegistrationStatus.CHECKED_IN },
      }),
      this.prisma.siteStat.findUnique({ where: { id: 'activeMembers' } }),
    ]);

    return {
      events,
      registrations,
      checkedIn,
      activeMembers: membersStat?.value ?? 0,
    };
  }
}
