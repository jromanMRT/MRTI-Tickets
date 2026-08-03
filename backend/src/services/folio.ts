export function buildFolio(year: number, id: number) {
  const padded = String(id).padStart(6, '0');
  return `MRTI-${year}-${padded}`;
}
