import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyTicketCode } from '../common/ticket-code';
import { PrismaService } from '../prisma/prisma.service';
import { RegistrationsService } from './registrations.service';

const SECRET = 'test-secret';
const DAY = 24 * 60 * 60 * 1000;

const openEvent = {
  id: 'event-1',
  title: 'Demo Event',
  slug: 'demo-event',
  venue: 'Room 1',
  timezone: 'Asia/Dhaka',
  status: 'PUBLISHED',
  capacity: 2,
  startsAt: new Date(Date.now() + DAY),
  endsAt: new Date(Date.now() + 2 * DAY),
};

const dto = {
  name: 'Rahim Uddin',
  email: 'rahim@example.com',
  phone: '01712345678',
};

function setup() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    event: { findUnique: jest.fn().mockResolvedValue(openEvent) },
    registration: {
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...data, status: 'CONFIRMED', event: openEvent }),
        ),
    },
  };
  const prisma = {
    event: { findFirst: jest.fn().mockResolvedValue({ id: openEvent.id }) },
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const config = { getOrThrow: jest.fn().mockReturnValue(SECRET) };
  const service = new RegistrationsService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService,
  );
  return { service, prisma, tx };
}

describe('RegistrationsService.register', () => {
  it('registers a guest and returns a ticket with a valid signed code', async () => {
    const { service, tx } = setup();

    const { ticket } = await service.register('demo-event', dto);

    expect(ticket.status).toBe('CONFIRMED');
    expect(ticket.email).toBe('rahim@example.com');
    expect(ticket.event.title).toBe('Demo Event');
    expect(verifyTicketCode(ticket.code, SECRET)).toBe(true);
    expect(tx.registration.create).toHaveBeenCalledTimes(1);
  });

  it('gives 404 for an unknown or unpublished event', async () => {
    const { service, prisma } = setup();
    prisma.event.findFirst.mockResolvedValue(null);

    await expect(service.register('nope', dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses registration after the event has ended', async () => {
    const { service, tx } = setup();
    tx.event.findUnique.mockResolvedValue({
      ...openEvent,
      endsAt: new Date(Date.now() - 1000),
    });

    await expect(service.register('demo-event', dto)).rejects.toThrow(
      'Registration is closed for this event',
    );
  });

  it('refuses a duplicate email and creates nothing', async () => {
    const { service, tx } = setup();
    tx.registration.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(service.register('demo-event', dto)).rejects.toThrow(
      'already registered',
    );
    expect(tx.registration.create).not.toHaveBeenCalled();
  });

  it('refuses registration when the event is full', async () => {
    const { service, tx } = setup();
    tx.registration.count.mockResolvedValue(2); // capacity is 2

    await expect(service.register('demo-event', dto)).rejects.toThrow(
      'This event is full',
    );
    expect(tx.registration.create).not.toHaveBeenCalled();
  });

  it('allows the last seat', async () => {
    const { service, tx } = setup();
    tx.registration.count.mockResolvedValue(1); // 1 of 2 taken

    const { ticket } = await service.register('demo-event', dto);
    expect(ticket.status).toBe('CONFIRMED');
  });

  it('counts only confirmed and checked-in registrations', async () => {
    const { service, tx } = setup();

    await service.register('demo-event', dto);

    expect(tx.registration.count).toHaveBeenCalledWith({
      where: {
        eventId: 'event-1',
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
      },
    });
  });

  it('retries once when the database reports a unique conflict', async () => {
    const { service, tx } = setup();
    tx.registration.create.mockRejectedValueOnce({ code: 'P2002' });

    const { ticket } = await service.register('demo-event', dto);

    expect(ticket.status).toBe('CONFIRMED');
    expect(tx.registration.create).toHaveBeenCalledTimes(2);
  });
});
