import { type FieldError } from 'react-hook-form';

export function FieldError({ error }: { error?: FieldError }) {
  if (!error?.message) return null;
  return <p className="mt-1 text-xs text-mrt-bad dark:text-mrt-bad-light">{error.message}</p>;
}
