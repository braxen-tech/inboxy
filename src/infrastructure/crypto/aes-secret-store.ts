import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { SecretStore } from "@/domain/ports";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

const HEX_KEY_RE = /^[0-9a-fA-F]{64}$/;

/** AES-256 key as 64 hex chars (openssl rand -hex 32). */
export function isValidEncryptionKeyHex(key: string): boolean {
  return HEX_KEY_RE.test(key.trim());
}

export class AesSecretStore implements SecretStore {
  private readonly key: Buffer;

  constructor(hexKey: string) {
    const trimmed = hexKey.trim();
    if (!HEX_KEY_RE.test(trimmed)) {
      throw new Error("ENCRYPTION_KEY must be 64 hex characters (0-9, a-f)");
    }
    this.key = Buffer.from(trimmed, "hex");
    if (this.key.length !== 32) {
      throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString("base64");
  }

  decrypt(ciphertext: string): string {
    const buf = Buffer.from(ciphertext, "base64");
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final("utf8");
  }
}
