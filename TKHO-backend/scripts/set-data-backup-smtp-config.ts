/**
 * Update data backup SMTP sender settings in system_settings.
 *
 * Usage (PowerShell):
 *   cd TKHO-backend
 *   $env:JWT_SECRET="..."
 *   $env:DATABASE_URL="..."
 *   npx ts-node scripts/set-data-backup-smtp-config.ts "email" "host" "password"
 */
import { PrismaClient } from '@prisma/client';
import { encryptSettingSecret } from '../src/common/settings-secret.crypto';

async function upsert(
  prisma: PrismaClient,
  key: string,
  value: string,
  description: string,
) {
  await prisma.system_settings.upsert({
    where: { setting_key: key },
    create: {
      setting_key: key,
      setting_value: value,
      description,
      updated_at: new Date(),
    },
    update: {
      setting_value: value,
      updated_at: new Date(),
    },
  });
}

async function main() {
  const email = process.argv[2] ?? '';
  const host = process.argv[3] ?? '';
  const password = process.argv[4] ?? '';
  if (!email || !host || !password) {
    console.error(
      'Usage: npx ts-node scripts/set-data-backup-smtp-config.ts "<email>" "<host>" "<password>"',
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    await upsert(
      prisma,
      'data_backup_sending_email',
      email,
      'SMTP sender email for data backup notifications (admin UI hidden)',
    );
    await upsert(
      prisma,
      'data_backup_sending_email_host',
      host,
      'SMTP host for data backup sender email (admin UI hidden)',
    );
    await upsert(
      prisma,
      'data_backup_sending_email_password',
      encryptSettingSecret(password),
      'SMTP password for data backup sender email (admin UI hidden, encrypted at rest)',
    );
    console.log('Done. SMTP sender config updated.');
    console.log(`email=${email}`);
    console.log(`host=${host}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
