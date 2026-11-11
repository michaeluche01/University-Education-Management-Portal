import { describe, expect, it } from "vitest";
import { generateCsvString, sanitizeCsvCell } from "../../src/lib/csv";

describe("CSV Sanitization and Generation (Formula Injection Defense)", () => {
  describe("sanitizeCsvCell", () => {
    it("neutralizes formula injection triggers (=, +, -, @, \\t, \\r)", () => {
      expect(sanitizeCsvCell("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
      expect(sanitizeCsvCell("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
      expect(sanitizeCsvCell("-100")).toBe("'-100");
      expect(sanitizeCsvCell("@SUM(1+2)")).toBe("'@SUM(1+2)");
      expect(sanitizeCsvCell("\tmalicious")).toBe("'\tmalicious");
      // Contains carriage return, so it also gets wrapped in quotes per RFC 4180
      expect(sanitizeCsvCell("\rmalicious")).toBe('"\'\rmalicious"');
    });

    it("leaves safe strings and numbers without leading trigger characters unchanged", () => {
      expect(sanitizeCsvCell("John Doe")).toBe("John Doe");
      expect(sanitizeCsvCell("CSC 101")).toBe("CSC 101");
      expect(sanitizeCsvCell(45)).toBe("45");
      expect(sanitizeCsvCell(0)).toBe("0");
      expect(sanitizeCsvCell(true)).toBe("true");
    });

    it("handles null and undefined as empty string", () => {
      expect(sanitizeCsvCell(null)).toBe("");
      expect(sanitizeCsvCell(undefined)).toBe("");
    });

    it("quotes strings containing commas", () => {
      expect(sanitizeCsvCell("Doe, John")).toBe('"Doe, John"');
    });

    it("doubles existing quotes and wraps cell in quotes", () => {
      expect(sanitizeCsvCell('Dr. "Ngozi" Eze')).toBe('"Dr. ""Ngozi"" Eze"');
    });

    it("handles both formula prefix and commas/quotes properly", () => {
      expect(sanitizeCsvCell('=HYPERLINK("http://evil.com", "Click")')).toBe(
        `"'=HYPERLINK(""http://evil.com"", ""Click"")"`
      );
    });

    it("quotes strings containing newlines", () => {
      expect(sanitizeCsvCell("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
    });
  });

  describe("generateCsvString", () => {
    it("generates valid RFC 4180 CSV with CRLF line breaks and headers", () => {
      const headers = ["Matric No", "Name", "Total Score"];
      const rows = [
        ["UEMP/2026/001", "Alice Smith", 85.5],
        ["UEMP/2026/002", "Bob, Jr.", "=SUM(1+2)"],
      ];

      const csv = generateCsvString(headers, rows);
      expect(csv).toBe(
        `Matric No,Name,Total Score\r\nUEMP/2026/001,Alice Smith,85.5\r\nUEMP/2026/002,"Bob, Jr.",'=SUM(1+2)`
      );
    });
  });
});
