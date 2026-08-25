import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

const ENCRYPTED_PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';
const KEY_SALT = 'tkho-settings-secret-v1';

function resolveEncryptionKey(): Buffer {
  const secret = String(
    process.env.SETTINGS_ENCRYPTION_KEY ?? process.env.JWT_SECRET ?? '',
  ).trim();
  if (!secret) {
    throw new Error(
      'SETTINGS_ENCRYPTION_KEY or JWT_SECRET is required to encrypt settings secrets',
    );
  }
  return scryptSync(secret, KEY_SALT, 32);
}

export function isEncryptedSettingSecret(value: string): boolean {
  return String(value ?? '').startsWith(ENCRYPTED_PREFIX);
}

export function encryptSettingSecret(plaintext: string): string {
  const value = String(plaintext ?? '').trim();
  if (!value) return '';
  if (isEncryptedSettingSecret(value)) return value;

  const key = resolveEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptSettingSecret(stored: string): string {
  const value = String(stored ?? '').trim();
  if (!value) return '';
  if (!isEncryptedSettingSecret(value)) return value;

  const payload = value.slice(ENCRYPTED_PREFIX.length);
  const [ivPart, tagPart, dataPart] = payload.split(':');
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error('Invalid encrypted settings secret format');
  }

  const key = resolveEncryptionKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivPart, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64url')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
