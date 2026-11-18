/**
 * Upload a gallery image from the terminal.
 *
 * Usage:
 *   npx tsx scripts/upload-gallery-image.ts <imagePath> <title> [eventSlug] [caption]
 *
 * Examples:
 *   npx tsx scripts/upload-gallery-image.ts assets/gallery/git-workshop.png "Git & GitHub Workshop" intro-to-git-and-github "Hands-on session at Computer Lab 2"
 *   npx tsx scripts/upload-gallery-image.ts assets/gallery/hackathon.png "BUCC Hackathon"
 *
 * The script will:
 *   1. Log in as the organizer
 *   2. Upload the image to Cloudinary via POST /uploads/image
 *   3. Optionally look up the event by slug to get its ID
 *   4. Create the gallery record via POST /gallery
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

// ── HTTP helper ───────────────────────────────────────────────────────────────

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

// ── Multipart builder ─────────────────────────────────────────────────────────

function buildMultipart(
  fields: Record<string, string>,
  file: { name: string; buffer: Buffer; mime: string },
) {
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

  return {
    body: Buffer.concat(parts),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const [imagePath, title, eventSlug, caption] = process.argv.slice(2);

  if (!imagePath || !title) {
    console.error(
      'Usage: npx tsx scripts/upload-gallery-image.ts <imagePath> <title> [eventSlug] [caption]',
    );
    process.exit(1);
  }

  const resolvedPath = path.resolve(imagePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  // ── 1. Login ─────────────────────────────────────────────────────────────────
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

  // ── 2. Upload image to Cloudinary ─────────────────────────────────────────────
  console.log(`Uploading ${path.basename(resolvedPath)}...`);
  const fileBuffer = fs.readFileSync(resolvedPath);
  const slugForId = eventSlug ?? path.basename(resolvedPath, path.extname(resolvedPath));
  const { body, contentType } = buildMultipart(
    { slug: `gallery-${slugForId}` },
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

  // ── 3. Look up event ID (optional) ────────────────────────────────────────────
  let eventId: string | undefined;
  if (eventSlug) {
    console.log(`Looking up event "${eventSlug}"...`);
    const eventRes = await request(`${BASE_URL}/events/${eventSlug}`, {
      method: 'GET',
      headers: { Cookie: authCookie },
    });

    if (eventRes.status >= 400) {
      console.warn(`Event "${eventSlug}" not found — gallery image will be unlinked.`);
    } else {
      const { event } = JSON.parse(await eventRes.text()) as {
        event: { id: string; title: string };
      };
      eventId = event.id;
      console.log(`Linked to event: "${event.title}"`);
    }
  }

  // ── 4. Create gallery record ──────────────────────────────────────────────────
  console.log('Creating gallery record...');
  const payload: Record<string, string> = { title, url };
  if (caption) payload.caption = caption;
  if (eventId) payload.eventId = eventId;

  const galleryRes = await request(`${BASE_URL}/gallery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: authCookie },
    body: JSON.stringify(payload),
  });

  if (galleryRes.status >= 400) {
    console.error('Gallery create failed:', await galleryRes.text());
    process.exit(1);
  }

  console.log('Done ✓  Gallery image saved to database.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
