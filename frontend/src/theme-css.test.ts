import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('integración del tema oscuro', () => {
  it('compila las variantes dark: contra el tema elegido en MRTI', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/style.css'), 'utf8');

    expect(css).toContain("@custom-variant dark (&:where([data-theme='dark'], [data-theme='dark'] *));");
  });
});
