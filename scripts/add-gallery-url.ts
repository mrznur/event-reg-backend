/**
 * Add a gallery image record using an existing Cloudinary URL.
 * Use this when the image is already uploaded to Cloudinary.
 *
 * Usage:
 *   npx tsx scripts/add-gallery-url.ts "<url>" "<title>" [eventSlug] [caption]
 *
 * Examples:
 *   npx tsx scripts/add-gallery-url.ts "https://res.cloudinary.com/coms6y4f/..." "Python Workshop" intro-to-python-programming "Hands-on session at Computer Lab 1"
 *   npx tsx scripts/add-gallery-url.ts "https://res.cloudinary.com/coms6y4f/..." "Hackathon Night"
 */

import http from 'http';
import https from 'https';

process.loadEnvFile('.env');

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000/api';
const ORGANIZER_EMAIL =
  process.env.SEED_ORGANIZER_EMAIL ?? 'organizer@bucc.test';
const ORGANIZER_PASSWORD =
  process.env.SEED_ORGANIZER_PASSWORD ?? 'bucc-demo-1234';

// ── HTTP helper ───────────────────────────────────────────────────────────────

function request(
  url: string,
  options: {
    method: string;
    headers?: Record<string, string>;
    body?: string;
  },
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
  const [url, title, eventSlug, caption] = process.argv.slice(2);

  if (!url || !title) {
    console.error(
      'Usage: npx tsx scripts/add-gallery-url.ts "<url>" "<title>" [eventSlug] [caption]',
    );
    process.exit(1);
  }

  // ── 1. Login ──────────────────────────────────────────────────────────────────
  console.log(`Logging in as ${ORGANIZER_EMAIL}...`);
  const loginRes = await request(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ORGANIZER_EMAIL, password: ORGANIZER_PASSWORD }),
  });

  if (loginRes.status >= 400) {
    console.error('Login failed:', await loginRes.text());
    process.exit(1);
  }

  const authCookie = (loginRes.headers['set-cookie'] ?? '').split(';')[0];
  if (!authCookie) {
    console.error('No auth cookie received');
    process.exit(1);
  }
  console.log('Logged in ✓');

  // ── 2. Look up event ID (optional) ────────────────────────────────────────────
  let eventId: string | undefined;
  if (eventSlug) {
    console.log(`Looking up event "${eventSlug}"...`);
    const eventRes = await request(`${BASE_URL}/events/${eventSlug}`, {
      method: 'GET',
      headers: { Cookie: authCookie },
    });

    if (eventRes.status >= 400) {
      console.warn(`Event "${eventSlug}" not found — image will be unlinked from any event.`);
    } else {
      const { event } = JSON.parse(await eventRes.text()) as {
        event: { id: string; title: string };
      };
      eventId = event.id;
      console.log(`Linked to event: "${event.title}"`);
    }
  }

  // ── 3. Create gallery record ──────────────────────────────────────────────────
  console.log('Saving gallery record...');
  const payload: Record<string, string> = { title, url };
  if (caption) payload.caption = caption;
  if (eventId) payload.eventId = eventId;

  const galleryRes = await request(`${BASE_URL}/gallery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: authCookie },
    body: JSON.stringify(payload),
  });

  const galleryText = await galleryRes.text();
  if (galleryRes.status >= 400) {
    console.error('Failed:', galleryText);
    process.exit(1);
  }

  const { image } = JSON.parse(galleryText) as { image: { id: string } };
  console.log(`Done ✓  Gallery image saved (id: ${image.id})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
