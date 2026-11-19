/**
 * Create a new event from the terminal.
 *
 * Usage:
 *   npx tsx scripts/create-event.ts \
 *     --title "Event Title" \
 *     --description "Event description" \
 *     --category WORKSHOP \
 *     --venue "Venue Name" \
 *     --capacity 50 \
 *     --starts "2026-12-25T10:00" \
 *     --ends "2026-12-25T13:00" \
 *     --coverImage "https://res.cloudinary.com/..." \
 *     --timezone "Asia/Dhaka"
 *
 * Categories: WORKSHOP | TALK | HACKATHON | SOCIAL
 * timezone is optional, defaults to Asia/Dhaka
 * coverImage is optional, defaults to placeholder
 */

import http from 'http';
import https from 'https';

process.loadEnvFile('.env');

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000/api';
const ORGANIZER_EMAIL = process.env.SEED_ORGANIZER_EMAIL ?? 'organizer@bucc.test';
const ORGANIZER_PASSWORD = process.env.SEED_ORGANIZER_PASSWORD ?? 'bucc-demo-1234';
const PLACEHOLDER_COVER = 'https://placehold.co/1200x800?text=No+Image';

// ── Arg parser ────────────────────────────────────────────────────────────────

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

// ── HTTP helper ───────────────────────────────────────────────────────────────

function request(
  url: string,
  options: { method: string; headers?: Record<string, string>; body?: string },
): Promise<{ status: number; headers: Record<string, string>; text: () => Promise<string> }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const body = options.body ? Buffer.from(options.body) : undefined;

    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: options.method,
        headers: {
          ...options.headers,
          ...(body ? { 'Content-Length': String(body.byteLength) } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const rawHeaders = res.headers as Record<string, string | string[]>;
          const flatHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(rawHeaders)) {
            flatHeaders[k] = Array.isArray(v) ? v.join(', ') : (v ?? '');
          }
          resolve({
            status: res.statusCode ?? 0,
            headers: flatHeaders,
            text: () => Promise.resolve(Buffer.concat(chunks).toString('utf8')),
          });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const required = ['title', 'description', 'category', 'venue', 'capacity', 'starts', 'ends'];
  const missing = required.filter((k) => !args[k]);
  if (missing.length) {
    console.error(`Missing required arguments: ${missing.join(', ')}`);
    console.error(`
Usage:
  npx tsx scripts/create-event.ts \\
    --title "Event Title" \\
    --description "Description" \\
    --category WORKSHOP \\
    --venue "Venue" \\
    --capacity 50 \\
    --starts "2026-12-25T10:00" \\
    --ends "2026-12-25T13:00" \\
    --coverImage "https://res.cloudinary.com/..." \\
    --timezone "Asia/Dhaka"

Categories: WORKSHOP | TALK | HACKATHON | SOCIAL
    `);
    process.exit(1);
  }

  // ── 1. Login ──────────────────────────────────────────────────────────────────
  console.log(`Logging in as ${ORGANIZER_EMAIL}...`);
  const loginRes = await request(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ORGANIZER_EMAIL, password: ORGANIZER_PASSWORD }),
  });
  if (loginRes.status >= 400) { console.error('Login failed:', await loginRes.text()); process.exit(1); }
  const authCookie = (loginRes.headers['set-cookie'] ?? '').split(';')[0];
  console.log('Logged in ✓');

  // ── 2. Create event ───────────────────────────────────────────────────────────
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

  const createText = await createRes.text();
  if (createRes.status >= 400) { console.error('Failed:', createText); process.exit(1); }

  const { event } = JSON.parse(createText) as {
    event: { id: string; slug: string; title: string; status: string };
  };

  console.log(`Created ✓`);
  console.log(`  Title  : ${event.title}`);
  console.log(`  Slug   : ${event.slug}`);
  console.log(`  ID     : ${event.id}`);
  console.log(`  Status : ${event.status} (run publish command to make it live)`);

  // ── 3. Auto-publish ───────────────────────────────────────────────────────────
  console.log('Publishing...');
  const publishRes = await request(`${BASE_URL}/events/${event.id}/publish`, {
    method: 'POST',
    headers: { Cookie: authCookie },
  });
  if (publishRes.status >= 400) {
    console.warn('Could not auto-publish:', await publishRes.text());
    console.warn('Publish manually: POST /api/events/:id/publish');
  } else {
    console.log('Published ✓  Event is now live.');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
