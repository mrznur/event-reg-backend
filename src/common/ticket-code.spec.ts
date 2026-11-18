import {
  generateTicketCode,
  verifyTicketCode,
} from './ticket-code';

const SECRET = 'test-secret-one';

function flip(char: string): string {
  return char === '0' ? '1' : '0';
}

describe('ticket codes', () => {
  it('has the BUCC-XXXXXXXX-XXXXXXXX format', () => {
    expect(generateTicketCode(SECRET)).toMatch(
      /^BUCC-[0-9A-HJKMNP-TV-Z]{8}-[0-9A-HJKMNP-TV-Z]{8}$/,
    );
  });

  it('verifies a code made with the same secret', () => {
    const code = generateTicketCode(SECRET);
    expect(verifyTicketCode(code, SECRET)).toBe(true);
  });

  it('rejects a code checked with a different secret', () => {
    const code = generateTicketCode(SECRET);
    expect(verifyTicketCode(code, 'another-secret')).toBe(false);
  });

  it('rejects a code with a changed character', () => {
    const code = generateTicketCode(SECRET);

    const changedSignature = code.slice(0, -1) + flip(code.slice(-1));
    expect(verifyTicketCode(changedSignature, SECRET)).toBe(false);

    const chars = code.split('');
    chars[5] = flip(chars[5]); // first character of the id
    expect(verifyTicketCode(chars.join(''), SECRET)).toBe(false);
  });

  it('accepts lowercase, extra spaces and look-alike letters', () => {
    const code = generateTicketCode(SECRET);
    expect(verifyTicketCode(`  ${code.toLowerCase()} `, SECRET)).toBe(true);

    const typed = code.replace(/0/g, 'O').replace(/1/g, 'l');
    expect(verifyTicketCode(typed, SECRET)).toBe(true);
  });

  it('rejects garbage', () => {
    for (const text of ['', 'hello', 'BUCC-123', 'BUCC-AAAAAAAA-BBBBBBBB']) {
      expect(verifyTicketCode(text, SECRET)).toBe(false);
    }
  });

  it('generates a different code every time', () => {
    const codes = new Set(
      Array.from({ length: 50 }, () => generateTicketCode(SECRET)),
    );
    expect(codes.size).toBe(50);
  });
});
