/**
 * Update an event's coverImage using an existing Cloudinary URL.
 * Use this when the image is already on Cloudinary.
 *
 * Usage:
 *   npx tsx scripts/set-event-cover-url.ts "<url>" <eventSlug>
 *
 * Example:
 *   npx tsx scripts/set-event-cover-url.ts "https://res.cloudinary.com/..." careers-in-tech-panel
 */

import http from 'http';
import https from 'https';

process.loadEnvFile('.env');

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000/api';
const ORGANIZER_EMAIL = process.env.SEED_ORGANIZER_EMAIL ?? 'organizer@bucc.test';
const ORGANIZER_PASSWORD = process.env.SEED_ORGANIZER_PASSWORD ?? 'bucc-demo-1234';

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

async function main() {
  const [coverUrl, slug] = process.argv.slice(2);

  if (!coverUrl || !slug) {
    console.error('Usage: npx tsx scripts/set-event-cover-url.ts "<url>" <eventSlug>');
    process.exit(1);
  }

  // 1. Login
  console.log(`Logging in as ${ORGANIZER_EMAIL}...`);
  const loginRes = await request(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ORGANIZER_EMAIL, password: ORGANIZER_PASSWORD }),
  });
  if (loginRes.status >= 400) { console.error('Login failed:', await loginRes.text()); process.exit(1); }
  const authCookie = (loginRes.headers['set-cookie'] ?? '').split(';')[0];
  console.log('Logged in ✓');

  // 2. Get event ID from slug
  console.log(`Looking up event "${slug}"...`);
  const eventRes = await request(`${BASE_URL}/events/${slug}`, {
    method: 'GET',
    headers: { Cookie: authCookie },
  });
  if (eventRes.status >= 400) { console.error('Event not found:', await eventRes.text()); process.exit(1); }
  const { event } = JSON.parse(await eventRes.text()) as { event: { id: string; title: string } };
  console.log(`Found: "${event.title}" (id: ${event.id})`);

  // 3. Patch coverImage
  console.log('Updating coverImage...');
  const patchRes = await request(`${BASE_URL}/events/${event.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: authCookie },
    body: JSON.stringify({ coverImage: coverUrl }),
  });
  if (patchRes.status >= 400) { console.error('Update failed:', await patchRes.text()); process.exit(1); }
  console.log('Done ✓  coverImage updated.');
}

main().catch((err) => { console.error(err); process.exit(1); });
