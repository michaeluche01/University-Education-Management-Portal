/**
 * CSV generation utility with formula injection neutralization.
 * Formula injection (CSV injection) occurs when untrusted spreadsheet cells begin
 * with dangerous prefixes (=, +, -, @, \t, \r) that can execute arbitrary formulas
 * or DDE commands when opened in Microsoft Excel, LibreOffice Calc, or Google Sheets.
 */

const FORMULA_PREFIX_REGEX = /^[=+\-@\t\r]/;

/**
 * Neutralizes potentially dangerous spreadsheet formula injection prefixes
 * by prepending a single quote (') if the cell begins with =, +, -, @, \t, or \r.
 */
export function sanitizeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);

  // Check if string starts with formula trigger character
  const isDangerous = FORMULA_PREFIX_REGEX.test(str);
  const safeStr = isDangerous ? `'${str}` : str;

  // Escape double quotes and enclose in quotes if it contains commas, quotes, or newlines
  if (
    safeStr.includes(",") ||
    safeStr.includes('"') ||
    safeStr.includes("\n") ||
    safeStr.includes("\r")
  ) {
    return `"${safeStr.replace(/"/g, '""')}"`;
  }

  return safeStr;
}

/**
 * Formats a 2D array of rows into a sanitized CSV string.
 */
export function generateCsvString(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): string {
  const headerLine = headers.map((h) => sanitizeCsvCell(h)).join(",");
  const dataLines = rows.map((row) =>
    row.map((cell) => sanitizeCsvCell(cell)).join(",")
  );

  return [headerLine, ...dataLines].join("\r\n");
}

/**
 * Triggers a client-side download of a CSV file.
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): void {
  const csvContent = generateCsvString(headers, rows);
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

