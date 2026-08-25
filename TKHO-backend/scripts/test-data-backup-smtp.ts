/**
 * Test SMTP login without sending mail. Does not print passwords.
 *
 * Usage (PowerShell):
 *   cd TKHO-backend
 *   npx ts-node scripts/test-data-backup-smtp.ts
 *   npx ts-node scripts/test-data-backup-smtp.ts 465
 */
import { PrismaClient } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { decryptSettingSecret } from '../src/common/settings-secret.crypto';

async function loadSmtpConfig() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.system_settings.findMany({
      where: {
        setting_key: {
          in: [
            'data_backup_sending_email',
            'data_backup_sending_email_host',
            'data_backup_sending_email_password',
          ],
        },
      },
    });
    const map = new Map(rows.map((r) => [r.setting_key, r.setting_value ?? '']));
    const from = String(map.get('data_backup_sending_email') ?? '').trim();
    const host = String(map.get('data_backup_sending_email_host') ?? '').trim();
    const storedPass = String(
      map.get('data_backup_sending_email_password') ?? '',
    ).trim();
    const pass = storedPass.startsWith('enc:v1:')
      ? decryptSettingSecret(storedPass)
      : storedPass;
    return { from, host, pass };
  } finally {
    await prisma.$disconnect();
  }
}

async function tryVerify(label: string, options: Record<string, unknown>) {
  const transporter = nodemailer.createTransport(options);
  try {
    await transporter.verify();
    console.log(`${label}: OK`);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`${label}: FAIL — ${message}`);
    return false;
  } finally {
    transporter.close();
  }
}

async function main() {
  const preferredPort = Number.parseInt(process.argv[2] ?? '', 10);
  const { from, host, pass } = await loadSmtpConfig();

  if (!from || !host || !pass) {
    console.error('Missing SMTP config in system_settings / env.');
    process.exit(1);
  }

  console.log(`Host: ${host}`);
  console.log(`User: ${from}`);
  console.log(`Password length: ${pass.length}`);

  const ports = Number.isFinite(preferredPort)
    ? [preferredPort]
    : [587, 465, 25];

  for (const port of ports) {
    const secure = port === 465;
    await tryVerify(`port ${port} secure=${secure}`, {
      host,
      port,
      secure,
      tls: { rejectUnauthorized: false },
      auth: { user: from, pass },
      ...(port === 587 ? { requireTLS: true } : {}),
    });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
