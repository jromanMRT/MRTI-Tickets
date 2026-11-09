import { describe, expect, it } from 'vitest';
import { normalizeRelation, parseTicketIds } from './workbench';

describe('workbench input normalization', () => {
  it('acepta sólo IDs positivos, enteros, únicos y limita el lote', () => {
    const input = [3, '2', 3, 0, -1, 'x', 4.5, ...Array.from({ length: 120 }, (_, index) => index + 10)];
    const result = parseTicketIds(input);
    expect(result.slice(0, 2)).toEqual([3, 2]);
    expect(result).toHaveLength(100);
    expect(result.every((id) => Number.isInteger(id) && id > 0)).toBe(true);
  });

  it('rechaza una entrada que no sea arreglo', () => {
    expect(parseTicketIds('1,2,3')).toEqual([]);
  });

  it('normaliza relaciones simétricas para impedir duplicados invertidos', () => {
    expect(normalizeRelation(20, 10, 'related')).toEqual({ sourceId: 10, relatedId: 20 });
    expect(normalizeRelation(20, 10, 'duplicate')).toEqual({ sourceId: 10, relatedId: 20 });
  });

  it('conserva el sentido de una relación direccional', () => {
    expect(normalizeRelation(20, 10, 'blocks')).toEqual({ sourceId: 20, relatedId: 10 });
  });
});
