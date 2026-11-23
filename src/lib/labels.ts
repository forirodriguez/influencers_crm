export function offsetLabel(minutes: number, labels: { day: string; before48: string; after7: string }): string {
  if (minutes === 0) return labels.day;
  if (minutes === -2880) return labels.before48;
  if (minutes === 10080) return labels.after7;
  return `${minutes} min`;
}

export function formatFollowers(value: number | null | undefined, locale: string): string | null {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat(locale).format(value);
}
