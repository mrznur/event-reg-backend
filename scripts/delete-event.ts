/**
 * Cancel (soft-delete) an event by slug.
 *
 * Usage:
 *   npx tsx scripts/delete-event.ts <eventSlug>
 *
 * Example:
 *   npx tsx scripts/delete-event.ts careers-in-tech-panel
 */

import { request, BASE_URL, login } from './lib/auth';

async function main() {
  const [slug] = process.argv.slice(2);
  if (!slug) {
    console.error('Usage: npx tsx scripts/delete-event.ts <eventSlug>');
    process.exit(1);
  }

  const authCookie = await login();

  // Get event ID
  console.log(`Looking up event "${slug}"...`);
  const eventRes = await request(`${BASE_URL}/events/${slug}`, {
    method: 'GET',
    headers: { Cookie: authCookie },
  });
  if (eventRes.status >= 400) { console.error('Event not found:', await eventRes.text()); process.exit(1); }
  const { event } = JSON.parse(await eventRes.text()) as { event: { id: string; title: string } };
  console.log(`Found: "${event.title}"`);

  // Cancel
  console.log('Cancelling event...');
  const cancelRes = await request(`${BASE_URL}/events/${event.id}/cancel`, {
    method: 'POST',
    headers: { Cookie: authCookie },
  });
  if (cancelRes.status >= 400) { console.error('Cancel failed:', await cancelRes.text()); process.exit(1); }
  console.log('Done ✓  Event cancelled and hidden from public.');
}

main().catch((err) => { console.error(err); process.exit(1); });
