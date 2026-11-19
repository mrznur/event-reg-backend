/**
 * Delete a gallery image by its ID.
 * Get IDs from: GET /api/gallery
 *
 * Usage:
 *   npx tsx scripts/delete-gallery-image.ts <imageId>
 *
 * Example:
 *   npx tsx scripts/delete-gallery-image.ts cmwn5bpqo00007sy8klv1ujai
 */

import { request, BASE_URL, login } from './lib/auth';

async function main() {
  const [imageId] = process.argv.slice(2);
  if (!imageId) {
    console.error('Usage: npx tsx scripts/delete-gallery-image.ts <imageId>');
    console.error('Get image IDs: Invoke-WebRequest -Uri "http://localhost:4000/api/gallery" -UseBasicParsing | Select-Object -ExpandProperty Content');
    process.exit(1);
  }

  const authCookie = await login();

  console.log(`Deleting gallery image "${imageId}"...`);
  const deleteRes = await request(`${BASE_URL}/gallery/${imageId}`, {
    method: 'DELETE',
    headers: { Cookie: authCookie },
  });
  if (deleteRes.status !== 204 && deleteRes.status >= 400) {
    console.error('Delete failed:', await deleteRes.text());
    process.exit(1);
  }
  console.log('Done ✓  Gallery image deleted.');
}

main().catch((err) => { console.error(err); process.exit(1); });
