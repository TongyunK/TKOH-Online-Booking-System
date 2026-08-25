/**
 * Encrypt a settings secret for manual DB updates.
 *
 * Usage (PowerShell):
 *   $env:JWT_SECRET="your-secret"
 *   npx ts-node scripts/encrypt-setting-secret.ts "plain-text-password"
 */
import { encryptSettingSecret } from '../src/common/settings-secret.crypto';

const plaintext = process.argv[2] ?? '';
if (!plaintext) {
  console.error('Usage: npx ts-node scripts/encrypt-setting-secret.ts "<plaintext>"');
  process.exit(1);
}

console.log(encryptSettingSecret(plaintext));
