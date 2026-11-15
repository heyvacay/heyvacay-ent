import 'server-only';

/**
 * Password hashing for enterprise accounts.
 *
 * Uses Node's built-in scrypt (a memory-hard KDF) rather than bcrypt/argon2 so
 * there is NO native dependency to compile into the standalone Docker image —
 * the whole auth layer runs on the Node core `crypto` module alone. Each hash
 * carries its own random salt and the scrypt parameters, so stored hashes stay
 * verifiable even if we tune the cost later.
 *
 * Stored format (single string, `$`-delimited):
 *   scrypt$<N>$<r>$<p>$<saltB64>$<hashB64>
 */

import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(_scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: { N?: number; r?: number; p?: number; maxmem?: number },
) => Promise<Buffer>;

// Cost parameters. N must be a power of two. These are comfortably above the
// interactive-login minimums while staying fast enough for a serverless request.
const N = 16384; // CPU/memory cost
const R = 8; // block size
const P = 1; // parallelization
const KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024; // 64 MB — headroom for N·r·128

/** Hash a plaintext password into a self-describing, storable string. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(normalize(plain), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

/**
 * Verify a plaintext password against a stored hash. Constant-time comparison;
 * returns false (never throws) on any malformed/legacy value.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const n = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = Buffer.from(parts[4], 'base64');
    const expected = Buffer.from(parts[5], 'base64');
    if (!n || !r || !p || salt.length === 0 || expected.length === 0) return false;
    const actual = await scrypt(normalize(plain), salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: MAXMEM,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Enforce a sane password policy at the point of setting one. Returns an error
 * string, or null when acceptable. Kept deliberately simple (length-first, the
 * single most effective rule) so the UI copy can mirror it exactly.
 */
export function passwordProblem(plain: string): string | null {
  if (typeof plain !== 'string' || plain.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (plain.length > 200) return 'Password is too long.';
  return null;
}

// Unicode-normalize so a password typed on different keyboards still matches,
// and so byte-length limits are predictable.
function normalize(plain: string): string {
  return plain.normalize('NFKC');
}
