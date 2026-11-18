import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const PREFIX = 'BUCC';
const PART_LENGTH = 8;
const TICKET_PATTERN = /^BUCC-([0-9A-HJKMNP-TV-Z]{8})-([0-9A-HJKMNP-TV-Z]{8})$/;

function toBase32(bytes: Buffer, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % 32];
  return out;
}

function sign(id: string, secret: string): string {
  const digest = createHmac('sha256', secret).update(id).digest();
  return toBase32(digest, PART_LENGTH);
}

export function generateTicketCode(secret: string): string {
  const id = toBase32(randomBytes(PART_LENGTH), PART_LENGTH);
  return `${PREFIX}-${id}-${sign(id, secret)}`;
}

// Makes a scanned or hand-typed code comparable: trims, uppercases, and maps
// the look-alike letters O, I and L (never used in codes) to 0, 1 and 1.
export function normalizeTicketCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export function verifyTicketCode(input: string, secret: string): boolean {
  const match = TICKET_PATTERN.exec(normalizeTicketCode(input));
  if (!match) return false;

  const expected = Buffer.from(sign(match[1], secret));
  const actual = Buffer.from(match[2]);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
