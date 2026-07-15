const archiveDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/u;

export function parseHotspotArchiveDate(value: string): string | null {
  const match = archiveDatePattern.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return value;
}
