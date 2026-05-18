export interface SecretStore {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}
