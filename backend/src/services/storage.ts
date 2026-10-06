import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const BASE = process.env.ATTACHMENTS_PATH || path.join(process.cwd(), 'storage', 'attachments');

export async function ensureBase() {
  await fs.promises.mkdir(BASE, { recursive: true, mode: 0o700 });
}

export async function saveAttachment(originalName: string, buffer: Buffer, mimeType: string) {
  await ensureBase();
  const id = randomUUID();
  const safe = `${id}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const target = path.join(BASE, safe);
  await fs.promises.writeFile(target, buffer, { mode: 0o600 });
  await fs.promises.chmod(target, 0o600);
  return { storage_path: target, filename: originalName, mime_type: mimeType, size: buffer.length };
}
