/**
 * Re-encrypt data_backup_sending_email_password for local dev JWT_SECRET.
 *
 * Usage (PowerShell):
 *   $env:DATABASE_URL="postgresql://..."
 *   $env:SOURCE_JWT_SECRET="production-jwt-used-when-migration-ran"
 *   $env:JWT_SECRET="local-jwt-from-.env"
 *   npx ts-node scripts/reencrypt-data-backup-password.ts
 */
import { PrismaClient } from '@prisma/client';
import {
  decryptSettingSecret,
  encryptSettingSecret,
  isEncryptedSettingSecret,
} from '../src/common/settings-secret.crypto';

const KEY = 'data_backup_sending_email_password';

async function main() {
  const sourceSecret = String(process.env.SOURCE_JWT_SECRET ?? '').trim();
  const targetSecret = String(process.env.JWT_SECRET ?? '').trim();
  if (!sourceSecret || !targetSecret) {
    console.error(
      'Set SOURCE_JWT_SECRET (old key) and JWT_SECRET (new local key) before running.',
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const row = await prisma.system_settings.findUnique({
      where: { setting_key: KEY },
    });
    const stored = String(row?.setting_value ?? '').trim();
    if (!stored) {
      console.error(`No value found for ${KEY}.`);
      process.exit(1);
    }
    if (!isEncryptedSettingSecret(stored)) {
      console.log('Password is not encrypted; encrypting with local JWT_SECRET...');
      process.env.JWT_SECRET = targetSecret;
      const encrypted = encryptSettingSecret(stored);
      await prisma.system_settings.update({
        where: { setting_key: KEY },
        data: { setting_value: encrypted, updated_at: new Date() },
      });
      console.log('Done. Password encrypted with local JWT_SECRET.');
      return;
    }

    process.env.JWT_SECRET = sourceSecret;
    const plaintext = decryptSettingSecret(stored);

    process.env.JWT_SECRET = targetSecret;
    const reencrypted = encryptSettingSecret(plaintext);

    await prisma.system_settings.update({
      where: { setting_key: KEY },
      data: { setting_value: reencrypted, updated_at: new Date() },
    });

    console.log('Done. Password re-encrypted with local JWT_SECRET.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
