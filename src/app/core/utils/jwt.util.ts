/**
 * Tiny JWT helpers — payload-only, no signature verification (the server
 * already verified it; we just need the `exp` claim to schedule refresh).
 */

interface JwtPayload {
  exp?: number; // seconds since epoch
  [k: string]: unknown;
}

/** Parses the payload of a JWT. Returns null on any failure. */
export function decodeJwt(token: string | null | undefined): JwtPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    // base64url → base64
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = atob(b64);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/** Returns the JWT's expiry as a millisecond epoch, or null if missing. */
export function getJwtExpiry(token: string | null | undefined): number | null {
  const payload = decodeJwt(token);
  if (!payload?.exp) return null;
  return payload.exp * 1000;
}

/** True when the JWT has no `exp` or has already passed. */
export function isJwtExpired(token: string | null | undefined): boolean {
  const exp = getJwtExpiry(token);
  if (exp === null) return true;
  return Date.now() >= exp;
}
