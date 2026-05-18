import { describe, it, expect } from "vitest";
import { AesSecretStore } from "@/infrastructure/crypto/aes-secret-store";
import { randomBytes } from "node:crypto";

describe("AesSecretStore", () => {
  const key = randomBytes(32).toString("hex");
  const store = new AesSecretStore(key);

  it("encrypts and decrypts a string correctly", () => {
    const plaintext = "sk_test_12345abcdef";
    const encrypted = store.encrypt(plaintext);
    const decrypted = store.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertexts for same plaintext (random IV)", () => {
    const plaintext = "same_input";
    const a = store.encrypt(plaintext);
    const b = store.encrypt(plaintext);
    expect(a).not.toBe(b);
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = store.encrypt("hello");
    const tampered = encrypted.slice(0, -2) + "xx";
    expect(() => store.decrypt(tampered)).toThrow();
  });

  it("throws if key is wrong length", () => {
    expect(() => new AesSecretStore("short")).toThrow();
  });
});
