import { describe, it, expect } from 'vitest';

describe('basic backend sanity', () => {
  it('should pass basic assertion', () => {
    expect(1 + 1).toBe(2);
  });
});
