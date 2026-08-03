import { describe, it, expect } from 'vitest';
import { buildFolio } from './folio';

describe('folio service', () => {
  it('builds formatted folio strings', () => {
    expect(buildFolio(2026, 1)).toBe('MRTI-2026-000001');
    expect(buildFolio(2026, 123)).toBe('MRTI-2026-000123');
  });
});
