import { Prisma } from '../generated/prisma/client';

type RegistrationWithEvent = Prisma.RegistrationGetPayload<{
  include: { event: true };
}>;

export function toTicketResponse(registration: RegistrationWithEvent) {
  return {
    code: registration.ticketCode,
  };
}
