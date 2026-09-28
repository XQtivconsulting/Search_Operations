import { randomBytes, timingSafeEqual } from "node:crypto";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

// Cloudflare's native PBKDF2 caps iterations at 100,000. Keep the existing
// 600,000-round format with a portable implementation inside the Durable Object.
const derive = (password: string, salt: string) =>
  pbkdf2(
    sha256,
    new TextEncoder().encode(password),
    new TextEncoder().encode(salt),
    {
      c: 600000,
      dkLen: 32,
    },
  );

export function passwordHash(password: string) {
  const salt = Buffer.from(randomBytes(16)).toString("hex");
  return `${salt}:${Buffer.from(derive(password, salt)).toString("hex")}`;
}

export function passwordOK(password: string, stored: string) {
  const [salt, digest] = stored.split(":");
  return timingSafeEqual(derive(password, salt), Buffer.from(digest, "hex"));
}

