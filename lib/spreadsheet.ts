import { normalizeHeader } from "@/lib/catalog-import";

export function parseCsv(text: string): string[][] {
  const raw = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = raw.split("\n");
  const first = lines.find((line) => line.trim()) ?? "";
  const delim = detectDelimiter(first);
  return lines.filter((line) => line.trim()).map((line) => splitCsvLine(line, delim));
}

export async function rowsFromUpload(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const { read, utils } = await import("xlsx");
    const book = read(Buffer.from(await file.arrayBuffer()), { type: "buffer", cellDates: true });
    const sheet = book.Sheets[book.SheetNames[0]];
    if (!sheet) return [];
    const matrix = utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
      dateNF: "yyyy-mm-dd",
    }) as unknown[][];
    return matrix.map((row) => row.map((cell) => String(cell ?? "").trim()));
  }
  return parseCsv(await file.text());
}

export function headerIndex(rows: string[][], looksLikeHeader: (cells: string[]) => boolean) {
  const limit = Math.min(rows.length, 6);
  for (let i = 0; i < limit; i += 1) {
    if (looksLikeHeader(rows[i] ?? [])) return i;
  }
  return 0;
}

export function headersOf(row: string[]) {
  return row.map((cell) => normalizeHeader(cell));
}

function detectDelimiter(headerLine: string) {
  const counts = [
    { delim: ";", count: headerLine.split(";").length },
    { delim: "\t", count: headerLine.split("\t").length },
    { delim: ",", count: headerLine.split(",").length },
  ].sort((a, b) => b.count - a.count);
  return counts[0].count > 1 ? counts[0].delim : ";";
}

function splitCsvLine(line: string, delim: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === delim && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}
