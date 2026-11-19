import { request } from './http';

export { request };

process.loadEnvFile('.env');

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000/api';
const ORGANIZER_EMAIL =
  process.env.SEED_ORGANIZER_EMAIL ?? 'organizer@bucc.test';
const ORGANIZER_PASSWORD =
  process.env.SEED_ORGANIZER_PASSWORD ?? 'bucc-demo-1234';

export { BASE_URL };

/**
 * Logs in as the organizer and returns the auth cookie string.
 * All terminal scripts use this instead of duplicating login logic.
 */
export async function login(): Promise<string> {
  console.log(`Logging in as ${ORGANIZER_EMAIL}...`);
  const res = await request(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: ORGANIZER_EMAIL,
      password: ORGANIZER_PASSWORD,
    }),
  });

  if (res.status >= 400) {
    console.error('Login failed:', await res.text());
    process.exit(1);
  }

  const authCookie = (res.headers['set-cookie'] ?? '').split(';')[0];
  if (!authCookie) {
    console.error('No auth cookie received');
    process.exit(1);
  }

  console.log('Logged in ✓');
  return authCookie;
}
