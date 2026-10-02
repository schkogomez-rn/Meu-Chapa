import crypto from "node:crypto";

/**
 * Hash password using scrypt with random salt.
 * Output format: saltHex:hashHex
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify password against saltHex:hashHex using timingSafeEqual
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(":");
    if (parts.length !== 2) return false;
    const [salt, expectedHash] = parts;
    const computedHash = crypto.scryptSync(password, salt, 64);
    const expectedBuffer = Buffer.from(expectedHash, "hex");
    if (computedHash.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(computedHash, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Generate cryptographically secure random token
 */
export function generateSecureToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString("hex");
}

/**
 * Generate secure URL-friendly token for QR codes (/m/{token})
 */
export function generateQRToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/**
 * Generate a secure temporary password with uppercase, lowercase, numbers and symbols
 */
export function generateTempPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
  const bytes = crypto.randomBytes(12);
  let pass = "";
  for (let i = 0; i < 12; i++) {
    pass += chars[bytes[i] % chars.length];
  }
  return pass;
}
