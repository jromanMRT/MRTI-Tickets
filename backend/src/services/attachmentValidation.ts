const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'application/pdf', 'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip',
]);

const extensions: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'application/pdf': ['pdf'], 'text/plain': ['txt'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'], 'application/zip': ['zip'],
};

export type AttachmentValidation = { valid: true } | { valid: false; message: string };

function isZip(buffer: Buffer) { return buffer.length >= 4 && (buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) || buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x05, 0x06]))); }

export function validateAttachment(filename: string, mimeType: string, buffer: Buffer): AttachmentValidation {
  const normalizedMime = String(mimeType || '').toLowerCase();
  const extension = String(filename || '').split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_MIME_TYPES.has(normalizedMime) || !extensions[normalizedMime].includes(extension)) return { valid: false, message: 'El tipo o la extensión del archivo no están permitidos' };
  if (buffer.length < 1) return { valid: false, message: 'El archivo está vacío' };
  if (normalizedMime === 'image/jpeg' && !(buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])))) return { valid: false, message: 'El contenido no corresponde a una imagen JPEG' };
  if (normalizedMime === 'image/png' && !(buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))) return { valid: false, message: 'El contenido no corresponde a una imagen PNG' };
  if (normalizedMime === 'application/pdf' && !buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) return { valid: false, message: 'El contenido no corresponde a un PDF' };
  if (normalizedMime !== 'text/plain' && normalizedMime !== 'application/pdf' && !isZip(buffer)) return { valid: false, message: 'El contenido no corresponde a un archivo ZIP compatible' };
  if (normalizedMime === 'text/plain' && buffer.includes(0)) return { valid: false, message: 'El archivo de texto contiene datos binarios' };
  return { valid: true };
}

export function safeDownloadFilename(filename: string): string {
  const clean = String(filename || 'archivo').replace(/[\r\n"\\]/g, '_').replace(/[^\p{L}\p{N} ._()-]/gu, '_').trim();
  return (clean || 'archivo').slice(0, 180);
}
