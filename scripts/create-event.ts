/**
 * Create a new event from the terminal. Auto-publishes after creation.
 *
 * Usage:
 *   npx tsx scripts/create-event.ts --title "Title" --description "Desc" --category WORKSHOP --venue "Venue" --capacity 50 --starts "2026-12-25T10:00" --ends "2026-12-25T13:00" --coverImage "https://..." --timezone "Asia/Dhaka"
 *
 * Categories: WORKSHOP | TALK | HACKATHON | SOCIAL
 * timezone and coverImage are optional.
 */

import { request, BASE_URL, login } from './lib/auth';

const PLACEHOLDER_COVER = 'https://placehold.co/1200x800?text=No+Image';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : '';
      args[key] = value;
      if (value) i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const required = ['title', 'description', 'category', 'venue', 'capacity', 'starts', 'ends'];
  const missing = required.filter((k) => !args[k]);
  if (missing.length) {
    console.error(`Missing required: ${missing.join(', ')}`);
    console.error('Categories: WORKSHOP | TALK | HACKATHON | SOCIAL');
    process.exit(1);
  }

  const authCookie = await login();

  // Create event
  console.log('Creating event...');
  const payload = {
    title: args.title,
    description: args.description,
    category: args.category,
    venue: args.venue,
    capacity: Number(args.capacity),
    startsAt: new Date(args.starts).toISOString(),
    endsAt: new Date(args.ends).toISOString(),
    coverImage: args.coverImage ?? PLACEHOLDER_COVER,
    timezone: args.timezone ?? 'Asia/Dhaka',
  };

  const createRes = await request(`${BASE_URL}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: authCookie },
    body: JSON.stringify(payload),
  });
  if (createRes.status >= 400) { console.error('Failed:', await createRes.text()); process.exit(1); }
  const { event } = JSON.parse(await createRes.text()) as { event: { id: string; slug: string; title: string } };
  console.log(`Created ✓  Slug: ${event.slug}  ID: ${event.id}`);

  // Auto-publish
  console.log('Publishing...');
  const publishRes = await request(`${BASE_URL}/events/${event.id}/publish`, {
    method: 'POST',
    headers: { Cookie: authCookie },
  });
  if (publishRes.status >= 400) {
    console.warn('Could not auto-publish. Publish manually via API.');
  } else {
    console.log('Published ✓  Event is live.');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
