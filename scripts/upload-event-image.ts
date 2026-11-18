/**
 * Upload an image for an event from the terminal.
 *
 * Usage:
 *   npx tsx scripts/upload-event-image.ts <imagePath> <eventSlugOrId>
 *
 * Examples:
 *   npx tsx scripts/upload-event-image.ts ./my-cover.png intro-to-git-and-github
 *   npx tsx scripts/upload-event-image.ts assets/event-covers/banner.jpg bucc-winter-hackathon
 *
 * The script will:
 *   1. Log in as the organizer to get an auth cookie
 *   2. Upload the image to Cloudinary via POST /uploads/image
 *   3. Find the event by slug (GET /events/:slug) to get its ID
 *   4. Update the event's coverImage via PATCH /events/:id
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';

process.loadEnvFile('.env');

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000/api';
const ORGANIZER_EMAIL =
  process.env.SEED_ORGANIZER_EMAIL ?? 'organizer@bucc.test';
const ORGANIZER_PASSWORD =
  process.env.SEED_ORGANIZER_PASSWORD ?? 'bucc-demo-1234';

// ── Minimal fetch wrapper using node:http/https ──────────────────────────────

function request(
  url: string,
  options: {
    method: string;
    headers?: Record<string, string>;
    body?: Buffer | string;
  },
): Promise<{ status: number; headers: Record<string, string>; text: () => Promise<string> }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const body =
      options.body instanceof Buffer
        ? options.body
        : options.body
          ? Buffer.from(options.body)
          : undefined;

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
          const buf = Buffer.concat(chunks);
          resolve({
            status: res.statusCode ?? 0,
            headers: flatHeaders,
            text: () => Promise.resolve(buf.toString('utf8')),
          });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── Build a multipart/form-data body manually ────────────────────────────────

function buildMultipart(fields: Record<string, string>, file: { name: string; buffer: Buffer; mime: string }) {
  const boundary = `----FormBoundary${Date.now().toString(16)}`;
  const parts: Buffer[] = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  }

  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.mime}\r\n\r\n`,
    ),
    file.buffer,
    Buffer.from('\r\n'),
    Buffer.from(`--${boundary}--\r\n`),
  );

  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

function mimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return map[ext] ?? 'application/octet-stream';
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const [imagePath, slug] = process.argv.slice(2);

  if (!imagePath || !slug) {
    console.error(
      'Usage: npx tsx scripts/upload-event-image.ts <imagePath> <eventSlug>',
    );
    process.exit(1);
  }

  const resolvedPath = path.resolve(imagePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  // ── 1. Login ────────────────────────────────────────────────────────────────
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

  const rawCookie = loginRes.headers['set-cookie'] ?? '';
  const authCookie = rawCookie.split(';')[0];
  if (!authCookie) {
    console.error('No auth cookie received after login');
    process.exit(1);
  }
  console.log('Logged in ✓');

  // ── 2. Upload image ──────────────────────────────────────────────────────────
  console.log(`Uploading ${path.basename(resolvedPath)}...`);
  const fileBuffer = fs.readFileSync(resolvedPath);
  const { body, contentType } = buildMultipart(
    { slug },
    { name: path.basename(resolvedPath), buffer: fileBuffer, mime: mimeType(resolvedPath) },
  );

  const uploadRes = await request(`${BASE_URL}/uploads/image`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, Cookie: authCookie },
    body,
  });

  const uploadText = await uploadRes.text();
  if (uploadRes.status >= 400) {
    console.error('Upload failed:', uploadText);
    process.exit(1);
  }

  const { url } = JSON.parse(uploadText) as { url: string };
  console.log('Uploaded ✓');
  console.log('Image URL:', url);

  // ── 3. Find event by slug ────────────────────────────────────────────────────
  console.log(`Looking up event "${slug}"...`);
  const eventRes = await request(`${BASE_URL}/events/${slug}`, {
    method: 'GET',
    headers: { Cookie: authCookie },
  });

  if (eventRes.status >= 400) {
    console.error('Event not found:', await eventRes.text());
    process.exit(1);
  }

  const { event } = JSON.parse(await eventRes.text()) as {
    event: { id: string; title: string };
  };
  console.log(`Found: "${event.title}" (id: ${event.id})`);

  // ── 4. Update coverImage ─────────────────────────────────────────────────────
  console.log('Updating coverImage...');
  const patchRes = await request(`${BASE_URL}/events/${event.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: authCookie },
    body: JSON.stringify({ coverImage: url }),
  });

  if (patchRes.status >= 400) {
    console.error('Update failed:', await patchRes.text());
    process.exit(1);
  }

  console.log('Done ✓  coverImage updated in the database.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
