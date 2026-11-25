import type { CookieOptions } from 'express';

export const AUTH_COOKIE_NAME = 'bucc_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function sessionCookieOptions(): CookieOptions {
  // On Vercel (and any proxy), NODE_ENV is 'production' but the internal
  // connection is HTTP. We use VERCEL env var to detect this case.
  // secure:true is correct on Vercel because the browser-to-edge connection
  // IS HTTPS — Vercel handles TLS termination and sets X-Forwarded-Proto.
  // With trust proxy=1 set in main.ts, Express correctly reads the forwarded
  // protocol, so secure cookies are sent and received correctly.
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
  };
}
