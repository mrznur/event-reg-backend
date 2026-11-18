import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from './common/password';
import { PrismaClient } from './generated/prisma/client';
import { EventCategory, EventStatus } from './generated/prisma/enums';

process.loadEnvFile('.env');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in .env');
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ORGANIZER_EMAIL = 'organizer@bucc.test';
const ORGANIZER_PASSWORD = 'bucc-demo-1234';

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

const cover = (seed: string) => `https://picsum.photos/seed/${seed}/1200/800`;

async function main() {
  const organizer = await prisma.user.upsert({
    where: { email: ORGANIZER_EMAIL },
    update: {},
    create: {
      name: 'BUCC Demo Organizer',
      email: ORGANIZER_EMAIL,
      passwordHash: await hashPassword(ORGANIZER_PASSWORD),
    },
  });

  const samples = [
    {
      slug: 'intro-to-git-and-github',
      title: 'Intro to Git and GitHub',
      description:
        'A hands-on workshop covering repositories, branches, commits and pull requests. Bring a laptop and a GitHub account.',
      category: EventCategory.WORKSHOP,
      coverImage: 'https://i.ibb.co.com/j9V9CW8q/Introduction-to-Git-Hub-Neon-Developer-Guide.png',
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
      coverImage: cover('bucc-ai'),
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
      coverImage: cover('bucc-games'),
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
      coverImage: cover('bucc-hack'),
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
      coverImage: cover('bucc-web'),
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
      coverImage: cover('bucc-careers'),
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
    // organizerId and status are excluded from update to avoid relation-key errors
    // and to preserve any manual status changes on existing rows.
    const { organizerId: _org, status: _status, ...updateData } = createData;
    await prisma.event.upsert({
      where: { slug: sample.slug },
      update: updateData,
      create: createData,
    });
  }

  console.log(
    `Seeded organizer ${ORGANIZER_EMAIL} and ${samples.length} events`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
