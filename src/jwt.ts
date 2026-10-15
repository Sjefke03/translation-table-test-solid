/**
 * Minimal HS256 JWTs with WebCrypto. Authorization codes and access tokens are both
 * self-contained signed tokens, so the Worker needs no storage.
 */

const enc = new TextEncoder();

export function base64url(bytes: Uint8Array | string): string {
  const b = typeof bytes === "string" ? enc.encode(bytes) : bytes;
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlBytes(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function fromBase64url(s: string): string {
  return new TextDecoder().decode(base64urlBytes(s));
}

const key = (secret: string) =>
  crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

export async function sign(payload: Record<string, unknown>, secret: string, ttlSeconds: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const body = `${base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${base64url(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds }))}`;
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body)));
  return `${body}.${base64url(sig)}`;
}

/** Returns the payload, or null if the signature is wrong or the token expired. */
export async function verify<T = Record<string, unknown>>(token: string, secret: string): Promise<(T & { exp: number }) | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const sig = base64urlBytes(parts[2]);
    const ok = await crypto.subtle.verify("HMAC", await key(secret), sig, enc.encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return null;
    const payload = JSON.parse(fromBase64url(parts[1]));
    return payload.exp > Date.now() / 1000 ? payload : null;
  } catch {
    return null;
  }
}

/** PKCE S256: base64url(sha256(verifier)). */
export async function pkceChallenge(verifier: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(verifier))));
}
