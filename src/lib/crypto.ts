/**
 * Crittografia AES-256-GCM per i contenuti dei messaggi.
 *
 * - La chiave master sta in ENCRYPTION_KEY (env var, 32 byte in base64 o hex).
 * - Ogni messaggio viene criptato con IV random.
 * - Formato: base64(iv || authTag || ciphertext)
 *
 * USO: solo server-side (API route). La chiave non deve mai raggiungere il browser.
 *
 * Genera una chiave nuova con:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // 96 bit, raccomandato per GCM
const TAG_LEN = 16;

function getKey(): Buffer {
  const k = process.env.ENCRYPTION_KEY;
  if (!k) {
    throw new Error("ENCRYPTION_KEY env var mancante. Generala con `node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"` e mettila in Vercel env.");
  }
  // Accetta base64 (44 char) o hex (64 char)
  let buf: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(k)) {
    buf = Buffer.from(k, "hex");
  } else {
    buf = Buffer.from(k, "base64");
  }
  if (buf.length !== 32) {
    throw new Error(`ENCRYPTION_KEY deve essere 32 byte (è ${buf.length}). Usa base64 di 32 byte random.`);
  }
  return buf;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Formato: iv (12) || tag (16) || ciphertext
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error("Payload criptato troppo corto");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}

// Hash one-way per topic/query aggregate (usato per ML analytics senza esporre contenuto)
export function anonHash(text: string): string {
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256")
    .update((process.env.ENCRYPTION_KEY || "") + ":" + text.toLowerCase().trim())
    .digest("hex")
    .slice(0, 16);
}

export function isEncryptionReady(): boolean {
  return Boolean(process.env.ENCRYPTION_KEY);
}
