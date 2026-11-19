/**
 * Set an event's cover image using an existing Cloudinary URL.
 *
 * Usage:
 *   npx tsx scripts/set-event-cover-url.ts "<cloudinaryUrl>" <eventSlug>
 *
 * Example:
 *   npx tsx scripts/set-event-cover-url.ts "https://res.cloudinary.com/..." careers-in-tech-panel
 */

import { request, BASE_URL, login } from './lib/auth';

async function main() {
  const [coverUrl, slug] = process.argv.slice(2);

  if (!coverUrl || !slug) {
    console.error('Usage: npx tsx scripts/set-event-cover-url.ts "<url>" <eventSlug>');
    process.exit(1);
  }

  const authCookie = await login();

  // Look up event by slug
  console.log(`Looking up event "${slug}"...`);
  const eventRes = await request(`${BASE_URL}/events/${slug}`, {
    method: 'GET',
    headers: { Cookie: authCookie },
  });
  if (eventRes.status >= 400) { console.error('Event not found:', await eventRes.text()); process.exit(1); }
  const { event } = JSON.parse(await eventRes.text()) as { event: { id: string; title: string } };
  console.log(`Found: "${event.title}" (id: ${event.id})`);

  // Patch coverImage
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
