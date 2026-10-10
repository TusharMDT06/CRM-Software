export function sanitizeCSVCell(value: any): string {
  if (value === null || value === undefined) return '';

  let str = String(value);

  // Protect against CSV formula injection: prefix =, +, -, @, or tab/CR with a single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // If cell contains commas, quotes, or newlines, escape quotes and wrap in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function toCSV(
  rows: Record<string, any>[],
  headers: { key: string; label: string }[]
): string {
  // UTF-8 BOM (\uFEFF) ensures Excel renders characters (including ₹) properly
  const bom = '\uFEFF';

  const headerLine = headers.map((h) => sanitizeCSVCell(h.label)).join(',');
  const rowLines = rows.map((row) =>
    headers
      .map((h) => {
        const val = row[h.key];
        return sanitizeCSVCell(val);
      })
      .join(',')
  );

  return bom + [headerLine, ...rowLines].join('\r\n');
}
