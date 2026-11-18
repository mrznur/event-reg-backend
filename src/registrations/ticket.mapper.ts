import { Prisma } from '../generated/prisma/client';

type RegistrationWithEvent = Prisma.RegistrationGetPayload<{
  include: { event: true };
}>;

export function toTicketResponse(registration: RegistrationWithEvent) {
  return {
    code: registration.ticketCode,
    status: registration.status,
    name: registration.name,
    email: registration.email,
    event: {
      title: registration.event.title,
      slug: registration.event.slug,
      venue: registration.event.venue,
      timezone: registration.event.timezone,
      startsAt: registration.event.startsAt.toISOString(),
      endsAt: registration.event.endsAt.toISOString(),
    },
  };
}
