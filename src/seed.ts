import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from './common/password';
import { PrismaClient } from './generated/prisma/client';
import { EventCategory, EventStatus, Role } from './generated/prisma/enums';

process.loadEnvFile('.env');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in .env');
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ORGANIZER_EMAIL = 'organizer@bucc.test';
const ORGANIZER_PASSWORD = 'bucc-demo-1234';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@bucc.club';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  throw new Error('ADMIN_PASSWORD is not set in .env');
}

const VERIFIED_ADMIN_PASSWORD: string = ADMIN_PASSWORD;

// Placeholder used for events that have no real cover image yet.
// Replace via: npx tsx scripts/set-event-cover-url.ts "<cloudinaryUrl>" <eventSlug>
const PLACEHOLDER_COVER = 'https://placehold.co/1200x800?text=No+Image';

// Asia/Dhaka is UTC+6, so a Dhaka hour is (hour - 6) in UTC.
function schedule(
  daysFromNow: number,
  hourDhaka: number,
  durationHours: number,
) {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  day.setUTCDate(day.getUTCDate() + daysFromNow);
  const startsAt = new Date(day.getTime() + (hourDhaka - 6) * 3_600_000);
  const endsAt = new Date(startsAt.getTime() + durationHours * 3_600_000);
  return { startsAt, endsAt };
}

async function main() {
  // ── Admin ────────────────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      name: 'BUCC Admin',
      email: ADMIN_EMAIL,
      passwordHash: await hashPassword(VERIFIED_ADMIN_PASSWORD),
      role: Role.ADMIN,
      verified: true,
    },
  });
  console.log(`Seeded admin: ${ADMIN_EMAIL}`);

  // ── Organizer ─────────────────────────────────────────────────────────────
  const organizer = await prisma.user.upsert({
    where: { email: ORGANIZER_EMAIL },
    update: {},
    create: {
      name: 'BUCC Demo Organizer',
      email: ORGANIZER_EMAIL,
      passwordHash: await hashPassword(ORGANIZER_PASSWORD),
      verified: true,
    },
  });

  const samples = [
    {
      slug: 'intro-to-git-and-github',
      title: 'Intro to Git and GitHub',
      description:
        'A hands-on workshop covering repositories, branches, commits and pull requests. Bring a laptop and a GitHub account.',
      category: EventCategory.WORKSHOP,
      coverImage: PLACEHOLDER_COVER,
      venue: 'Computer Lab 2, Main Campus',
      capacity: 40,
      ...schedule(6, 15, 3),
    },
    {
      slug: 'building-with-ai-apis',
      title: 'Building with AI APIs',
      description:
        'A talk on how developers add language model features to real web apps, with a live demo and Q and A.',
      category: EventCategory.TALK,
      coverImage: PLACEHOLDER_COVER,
      venue: 'Auditorium, Main Campus',
      capacity: 120,
      ...schedule(10, 17, 2),
    },
    {
      slug: 'board-game-night',
      title: 'Board Game Night',
      description:
        'Meet other members over board games and snacks. No experience needed, just good company.',
      category: EventCategory.SOCIAL,
      coverImage: PLACEHOLDER_COVER,
      venue: 'Student Lounge, Block B',
      capacity: 50,
      ...schedule(13, 18, 3),
    },
    {
      slug: 'bucc-winter-hackathon',
      title: 'BUCC Winter Hackathon',
      description:
        'A one-day build sprint. Form a team, pick a theme, and ship a working demo by the evening showcase.',
      category: EventCategory.HACKATHON,
      coverImage: PLACEHOLDER_COVER,
      venue: 'Innovation Hall, Main Campus',
      capacity: 80,
      ...schedule(20, 9, 10),
    },
    {
      slug: 'web-dev-bootcamp-day',
      title: 'Web Dev Bootcamp Day',
      description:
        'A full-day workshop on HTML, CSS and JavaScript fundamentals, ending with a small portfolio page.',
      category: EventCategory.WORKSHOP,
      coverImage: PLACEHOLDER_COVER,
      venue: 'Computer Lab 1, Main Campus',
      capacity: 60,
      ...schedule(-15, 10, 6),
    },
    {
      slug: 'careers-in-tech-panel',
      title: 'Careers in Tech Panel',
      description:
        'Alumni and industry guests shared how they started their careers in software and answered student questions.',
      category: EventCategory.TALK,
      coverImage: PLACEHOLDER_COVER,
      venue: 'Auditorium, Main Campus',
      capacity: 150,
      ...schedule(-35, 16, 2),
    },
  ];

  for (const sample of samples) {
    const createData = {
      ...sample,
      organizerId: organizer.id,
      status: EventStatus.PUBLISHED,
      timezone: 'Asia/Dhaka',
    };
    // coverImage excluded from update so re-seeding never overwrites
    // images uploaded via the upload script.
    const { organizerId: _org, coverImage: _img, ...updateData } = createData;
    await prisma.event.upsert({
      where: { slug: sample.slug },
      update: updateData,
      create: createData,
    });
  }

  console.log(
    `Seeded organizer ${ORGANIZER_EMAIL} and ${samples.length} events`,
  );
  // Gallery images are managed through the API — no seed data.

  // Seed site stats
  await prisma.siteStat.upsert({
    where: { id: 'activeMembers' },
    update: {},
    create: { id: 'activeMembers', value: 1200 },
  });
  console.log('Seeded site stats');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
