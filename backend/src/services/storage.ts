import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const BASE = process.env.ATTACHMENTS_PATH || path.join(process.cwd(), 'storage', 'attachments');

export async function ensureBase() {
  await fs.promises.mkdir(BASE, { recursive: true });
}

export async function saveAttachment(originalName: string, buffer: Buffer, mimeType: string) {
  await ensureBase();
  const id = uuidv4();
  const safe = `${id}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const target = path.join(BASE, safe);
  await fs.promises.writeFile(target, buffer);
  return { storage_path: target, filename: originalName, mime_type: mimeType, size: buffer.length };
}
