export function formatCurrency(value: number | undefined | null): string {
  return `$${Number(value ?? 0).toLocaleString()}`;
}

export function formatTimeFromSeconds(value: number | undefined | null): string {
  return new Date((value ?? 0) * 1000).toLocaleTimeString();
}
