import http from 'http';
import https from 'https';

/**
 * Shared HTTP request helper for all terminal scripts.
 */
export function request(
  url: string,
  options: {
    method: string;
    headers?: Record<string, string>;
    body?: Buffer | string;
  },
): Promise<{
  status: number;
  headers: Record<string, string>;
  text: () => Promise<string>;
}> {
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
            text: () =>
              Promise.resolve(Buffer.concat(chunks).toString('utf8')),
          });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
