// Admin mileage upload parser.
// Cache: no-store. Uploaded spreadsheet rows mutate private member point ledgers.

import { inflateRawSync } from 'node:zlib';
import { z } from 'zod';

export type MileageUploadMode = 'grant' | 'reset' | 'set';

export type MileageUploadRecord = {
  rowNumber: number;
  userId?: bigint;
  loginId?: string;
  email?: string;
  amount?: number;
  mode: MileageUploadMode;
  reason: string;
};

export type MileageUploadParseResult = {
  records: MileageUploadRecord[];
  skipped: number;
  errors: string[];
};

type HeaderField = 'userId' | 'loginId' | 'email' | 'amount' | 'mode' | 'reason';

const MAX_UPLOAD_ROWS = 1000;

const defaultHeaderIndexes: Record<HeaderField, number> = {
  userId: 0,
  loginId: 1,
  email: 2,
  amount: 3,
  mode: 4,
  reason: 5,
};

const headerAliases: Record<HeaderField, string[]> = {
  userId: ['회원id', '회원번호', '회원코드', 'userid', 'id'],
  loginId: ['아이디', '로그인아이디', 'loginid', 'memberid'],
  email: ['이메일', 'email', 'mail'],
  amount: ['마일리지', '적립금', '금액', 'amount', 'point', 'points', 'mileage'],
  mode: ['처리방식', '작업', '구분', 'mode', 'type'],
  reason: ['사유', '메모', '비고', 'reason', 'memo'],
};

const mileageRowSchema = z
  .object({
    rowNumber: z.number().int().min(1),
    userId: z.bigint().optional(),
    loginId: z.string().trim().min(1).max(100).optional(),
    email: z.string().trim().email().max(320).optional(),
    amount: z.number().int().min(0).max(10000000).optional(),
    mode: z.enum(['grant', 'reset', 'set']),
    reason: z.string().trim().min(1).max(200),
  })
  .superRefine((row, ctx) => {
    if (!row.userId && !row.loginId && !row.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '회원ID, 아이디, 이메일 중 하나는 필요합니다.',
        path: ['userId'],
      });
    }

    if (row.mode === 'grant' && (!row.amount || row.amount < 1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '부여 마일리지는 1 이상이어야 합니다.',
        path: ['amount'],
      });
    }

    if (row.mode === 'set' && row.amount == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '잔액 설정에는 마일리지 금액이 필요합니다.',
        path: ['amount'],
      });
    }
  });

function normalizeHeader(value: string): string {
  return value
    .replace(/\uFEFF/g, '')
    .replace(/[\s()[\]{}._-]+/g, '')
    .toLowerCase();
}

function headerField(value: string): HeaderField | null {
  const normalized = normalizeHeader(value);
  const entries = Object.entries(headerAliases) as [HeaderField, string[]][];
  const match = entries.find(([, aliases]) =>
    aliases.some((alias) => normalizeHeader(alias) === normalized),
  );
  return match?.[0] ?? null;
}

function htmlEntity(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, code: string) => {
    const normalized = code.toLowerCase();
    if (normalized === 'amp') return '&';
    if (normalized === 'lt') return '<';
    if (normalized === 'gt') return '>';
    if (normalized === 'quot') return '"';
    if (normalized === 'apos') return "'";
    if (normalized.startsWith('#x')) {
      return String.fromCodePoint(Number.parseInt(normalized.slice(2), 16));
    }
    if (normalized.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(normalized.slice(1), 10));
    }
    return entity;
  });
}

function stripXml(value: string): string {
  return htmlEntity(value.replace(/<[^>]+>/g, ''));
}

function getAttribute(tag: string, name: string): string | null {
  const pattern = new RegExp(`${name}="([^"]*)"`, 'i');
  return pattern.exec(tag)?.[1] ?? null;
}

function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes).replace(/^\uFEFF/, '');
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes).replace(/^\uFEFF/, '');
  }
  return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}

function parseHtmlTableRows(text: string): string[][] {
  const rows: string[][] = [];
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch = rowPattern.exec(text);

  while (rowMatch) {
    const rowHtml = rowMatch[1] ?? '';
    const cells: string[] = [];
    const cellPattern = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch = cellPattern.exec(rowHtml);
    while (cellMatch) {
      const cellHtml = (cellMatch[1] ?? '').replace(/<br\s*\/?>/gi, '\n');
      cells.push(stripXml(cellHtml).trim());
      cellMatch = cellPattern.exec(rowHtml);
    }
    if (cells.some((value) => value !== '')) rows.push(cells);
    rowMatch = rowPattern.exec(text);
  }

  return rows;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const signature = 0x06054b50;
  const minimumOffset = Math.max(0, buffer.length - 65557);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) return offset;
  }
  throw new Error('XLSX_END_OF_CENTRAL_DIRECTORY_NOT_FOUND');
}

function readZipEntries(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  const endOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  let offset = buffer.readUInt32LE(endOffset + 16);

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('XLSX_CENTRAL_DIRECTORY_INVALID');
    }

    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString('utf8')
      .replace(/\\/g, '/');
    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
    const data =
      compression === 0
        ? Buffer.from(compressed)
        : compression === 8
          ? inflateRawSync(compressed)
          : null;

    if (data) entries.set(name, data);
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function parseSharedStrings(xml: string): string[] {
  const sharedStrings: string[] = [];
  const itemPattern = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let itemMatch = itemPattern.exec(xml);

  while (itemMatch) {
    const itemXml = itemMatch[1] ?? '';
    const textParts = [...itemXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map((match) =>
      htmlEntity(match[1] ?? ''),
    );
    sharedStrings.push(textParts.join(''));
    itemMatch = itemPattern.exec(xml);
  }

  return sharedStrings;
}

function columnIndexFromCellRef(ref: string | null): number | null {
  if (!ref) return null;
  const letters = /^[A-Z]+/i.exec(ref)?.[0];
  if (!letters) return null;

  let index = 0;
  for (const letter of letters.toUpperCase()) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }
  return index - 1;
}

function xlsxSheetPath(entries: Map<string, Buffer>): string {
  const workbook = entries.get('xl/workbook.xml');
  const relationships = entries.get('xl/_rels/workbook.xml.rels');
  if (!workbook || !relationships) return 'xl/worksheets/sheet1.xml';

  const workbookXml = workbook.toString('utf8');
  const relsXml = relationships.toString('utf8');
  const firstSheetTag = /<sheet\b[^>]*>/i.exec(workbookXml)?.[0];
  const relId = firstSheetTag ? getAttribute(firstSheetTag, 'r:id') : null;
  if (!relId) return 'xl/worksheets/sheet1.xml';

  const relationshipPattern = /<Relationship\b[^>]*>/gi;
  let relationship = relationshipPattern.exec(relsXml);
  while (relationship) {
    const tag = relationship[0];
    if (getAttribute(tag, 'Id') === relId) {
      const target = getAttribute(tag, 'Target');
      if (!target) break;
      return target.startsWith('/') ? target.slice(1) : `xl/${target}`;
    }
    relationship = relationshipPattern.exec(relsXml);
  }

  return 'xl/worksheets/sheet1.xml';
}

function parseXlsxRows(bytes: Uint8Array): string[][] {
  const entries = readZipEntries(Buffer.from(bytes));
  const sharedStringsXml = entries.get('xl/sharedStrings.xml')?.toString('utf8') ?? '';
  const sharedStrings = parseSharedStrings(sharedStringsXml);
  const sheet = entries.get(xlsxSheetPath(entries));
  if (!sheet) throw new Error('XLSX_WORKSHEET_NOT_FOUND');

  const rows: string[][] = [];
  const sheetXml = sheet.toString('utf8');
  const rowPattern = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
  let rowMatch = rowPattern.exec(sheetXml);

  while (rowMatch) {
    const cells: string[] = [];
    const rowXml = rowMatch[1] ?? '';
    const cellPattern = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
    let cellMatch = cellPattern.exec(rowXml);

    while (cellMatch) {
      const cellTag = `<c${cellMatch[1] ?? ''}>`;
      const cellXml = cellMatch[2] ?? '';
      const index = columnIndexFromCellRef(getAttribute(cellTag, 'r')) ?? cells.length;
      const type = getAttribute(cellTag, 't');
      const rawValue = /<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(cellXml)?.[1]?.trim() ?? '';
      const value =
        type === 's'
          ? (sharedStrings[Number(rawValue)] ?? '')
          : type === 'inlineStr'
            ? [...cellXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)]
                .map((match) => htmlEntity(match[1] ?? ''))
                .join('')
            : htmlEntity(rawValue);
      cells[index] = value.trim();
      cellMatch = cellPattern.exec(rowXml);
    }

    if (cells.some((value) => (value ?? '').trim() !== '')) {
      rows.push(cells.map((value) => value ?? ''));
    }
    rowMatch = rowPattern.exec(sheetXml);
  }

  return rows;
}

function spreadsheetRows(fileName: string, bytes: Uint8Array): string[][] {
  const lowerName = fileName.toLowerCase();
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return parseXlsxRows(bytes);
  if (lowerName.endsWith('.xlsx')) throw new Error('XLSX_ZIP_SIGNATURE_NOT_FOUND');

  const text = decodeText(bytes);
  if (lowerName.endsWith('.xls') || /<table[\s>]/i.test(text)) return parseHtmlTableRows(text);
  return parseCsvRows(text);
}

function indexesFromHeader(header: string[]): { indexes: Record<HeaderField, number>; hasHeader: boolean } {
  const indexes: Record<HeaderField, number> = {
    userId: -1,
    loginId: -1,
    email: -1,
    amount: -1,
    mode: -1,
    reason: -1,
  };
  let matched = 0;

  header.forEach((cell, index) => {
    const field = headerField(cell);
    if (!field) return;
    indexes[field] = index;
    matched += 1;
  });

  return matched >= 2
    ? { indexes, hasHeader: true }
    : { indexes: { ...defaultHeaderIndexes }, hasHeader: false };
}

function cell(row: string[], index: number): string {
  return (row[index] ?? '').trim();
}

function parseOptionalBigInt(value: string): bigint | undefined {
  const normalized = value.replace(/\.0$/, '').replace(/[^\d]/g, '');
  if (!normalized) return undefined;
  return BigInt(normalized);
}

function parseAmount(value: string): number | undefined {
  const normalized = value.replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
  if (!normalized) return undefined;
  const amount = Number(normalized);
  return Number.isInteger(amount) ? amount : undefined;
}

function parseMode(value: string): MileageUploadMode | null {
  const normalized = normalizeHeader(value);
  if (!normalized) return 'grant';
  if (['부여', '지급', '적립', '추가', 'grant', 'add'].includes(normalized)) return 'grant';
  if (['초기화', '리셋', 'reset', 'zero'].includes(normalized)) return 'reset';
  if (['설정', '잔액설정', 'set', 'balance'].includes(normalized)) return 'set';
  return null;
}

function defaultReason(mode: MileageUploadMode): string {
  if (mode === 'reset') return '관리자 마일리지 엑셀 초기화';
  if (mode === 'set') return '관리자 마일리지 엑셀 잔액 설정';
  return '관리자 마일리지 엑셀 부여';
}

export function parseMileageSpreadsheet(fileName: string, bytes: ArrayBuffer): MileageUploadParseResult {
  let rows: string[][];
  try {
    rows = spreadsheetRows(fileName, new Uint8Array(bytes));
  } catch {
    return {
      records: [],
      skipped: 0,
      errors: ['업로드 파일을 읽지 못했습니다. 양식 파일을 다시 내려받아 작성해주세요.'],
    };
  }

  if (rows.length === 0) return { records: [], skipped: 0, errors: ['업로드 파일에 데이터가 없습니다.'] };

  const { indexes, hasHeader } = indexesFromHeader(rows[0] ?? []);
  const dataRows = (hasHeader ? rows.slice(1) : rows).slice(0, MAX_UPLOAD_ROWS);
  const records: MileageUploadRecord[] = [];
  const errors: string[] = [];
  let skipped = Math.max(0, rows.length - (hasHeader ? 1 : 0) - MAX_UPLOAD_ROWS);

  dataRows.forEach((row, index) => {
    const rowNumber = index + (hasHeader ? 2 : 1);
    if (row.every((value) => value.trim() === '')) return;

    const mode = parseMode(cell(row, indexes.mode));
    if (!mode) {
      skipped += 1;
      errors.push(`${rowNumber}행: 처리방식은 부여, 초기화, 설정 중 하나여야 합니다.`);
      return;
    }

    const candidate = {
      rowNumber,
      userId: parseOptionalBigInt(cell(row, indexes.userId)),
      loginId: cell(row, indexes.loginId) || undefined,
      email: cell(row, indexes.email) || undefined,
      amount: parseAmount(cell(row, indexes.amount)),
      mode,
      reason: cell(row, indexes.reason) || defaultReason(mode),
    };
    const parsed = mileageRowSchema.safeParse(candidate);

    if (!parsed.success) {
      skipped += 1;
      errors.push(`${rowNumber}행: ${parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.'}`);
      return;
    }

    records.push(parsed.data);
  });

  return { records, skipped, errors };
}
