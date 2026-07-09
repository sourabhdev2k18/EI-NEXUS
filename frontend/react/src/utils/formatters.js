export function formatCurrency(value) {
  return `$${Number(value ?? 0).toLocaleString()}`;
}

export function formatTimeFromSeconds(value) {
  return new Date((value ?? 0) * 1000).toLocaleTimeString();
}
