/**
 * Encrypt and store data_backup_sending_email_password in system_settings.
 *
 * Usage (PowerShell):
 *   cd TKHO-backend
 *   $env:JWT_SECRET="your-local-jwt"
 *   $env:DATABASE_URL="postgresql://..."
 *   npx ts-node scripts/set-data-backup-smtp-password.ts "plain-text-password"
 */
import { PrismaClient } from '@prisma/client';
import { encryptSettingSecret } from '../src/common/settings-secret.crypto';

const KEY = 'data_backup_sending_email_password';

async function main() {
  const plaintext = process.argv[2] ?? '';
  if (!plaintext) {
    console.error(
      'Usage: npx ts-node scripts/set-data-backup-smtp-password.ts "<password>"',
    );
    process.exit(1);
  }

  const encrypted = encryptSettingSecret(plaintext);
  const prisma = new PrismaClient();
  try {
    await prisma.system_settings.upsert({
      where: { setting_key: KEY },
      create: {
        setting_key: KEY,
        setting_value: encrypted,
        description:
          'SMTP password for data backup sender email (admin UI hidden, encrypted at rest)',
        updated_at: new Date(),
      },
      update: {
        setting_value: encrypted,
        updated_at: new Date(),
      },
    });
    console.log('Done. SMTP password updated and encrypted with current JWT_SECRET.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
