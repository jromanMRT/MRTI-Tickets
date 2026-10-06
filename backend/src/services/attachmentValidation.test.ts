import { safeDownloadFilename, validateAttachment } from './attachmentValidation';

describe('attachment validation', () => {
  it('accepts declared PDFs with their signature', () => {
    expect(validateAttachment('evidence.pdf', 'application/pdf', Buffer.from('%PDF-1.7'))).toEqual({ valid: true });
  });

  it('rejects a spoofed PDF and wrong extension', () => {
    expect(validateAttachment('evidence.pdf', 'application/pdf', Buffer.from('not pdf'))).toMatchObject({ valid: false });
    expect(validateAttachment('evidence.exe', 'application/pdf', Buffer.from('%PDF-1.7'))).toMatchObject({ valid: false });
  });

  it('removes header control characters from download names', () => {
    expect(safeDownloadFilename('archivo"\r\nX-Test: yes.pdf')).toBe('archivo___X-Test_ yes.pdf');
  });
});
