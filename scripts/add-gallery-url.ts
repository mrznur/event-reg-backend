/**
 * Add a gallery image using an existing Cloudinary URL.
 *
 * Usage:
 *   npx tsx scripts/add-gallery-url.ts "<url>" "<title>" [eventSlug] [caption]
 *
 * Example:
 *   npx tsx scripts/add-gallery-url.ts "https://res.cloudinary.com/..." "Title" event-slug "Caption"
 */

import { request, BASE_URL, login } from './lib/auth';

async function main() {
  const [url, title, eventSlug, caption] = process.argv.slice(2);

  if (!url || !title) {
    console.error('Usage: npx tsx scripts/add-gallery-url.ts "<url>" "<title>" [eventSlug] [caption]');
    process.exit(1);
  }

  const authCookie = await login();

  // Look up event (optional)
  let eventId: string | undefined;
  if (eventSlug) {
    console.log(`Looking up event "${eventSlug}"...`);
    const eventRes = await request(`${BASE_URL}/events/${eventSlug}`, {
      method: 'GET',
      headers: { Cookie: authCookie },
    });
    if (eventRes.status >= 400) {
      console.warn(`Event "${eventSlug}" not found — image will be unlinked.`);
    } else {
      const { event } = JSON.parse(await eventRes.text()) as { event: { id: string; title: string } };
      eventId = event.id;
      console.log(`Linked to event: "${event.title}"`);
    }
  }

  // Create gallery record
  console.log('Saving gallery record...');
  const payload: Record<string, string> = { title, url };
  if (caption) payload.caption = caption;
  if (eventId) payload.eventId = eventId;

  const galleryRes = await request(`${BASE_URL}/gallery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: authCookie },
    body: JSON.stringify(payload),
  });
  if (galleryRes.status >= 400) { console.error('Failed:', await galleryRes.text()); process.exit(1); }
  const { image } = JSON.parse(await galleryRes.text()) as { image: { id: string } };
  console.log(`Done ✓  Gallery image saved (id: ${image.id})`);
}

main().catch((err) => { console.error(err); process.exit(1); });
