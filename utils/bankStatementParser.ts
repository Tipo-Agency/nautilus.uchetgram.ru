/**
 * Парсер выписок из банка (Excel).
 * Поддерживает распространённые форматы; при несовпадении — пришлите пример файла для настройки маппинга колонок.
 */
import * as XLSX from 'xlsx';
import type { BankStatementLine } from '../types';

const DATE_COLUMNS = ['дата', 'date', 'дата операции', 'дата операции по документу', 'дата проводки'];
const AMOUNT_COLUMNS = ['сумма', 'amount', 'сумма операции', 'сумма по дебету', 'сумма по кредиту'];
// В выписке по счёту клиента: дебет = приход на счёт, кредит = списание (вид с банка).
const INCOME_COLUMNS = ['приход', 'доход', 'входящий остаток', 'поступление', 'дебет', 'debit'];
const OUTCOME_COLUMNS = ['расход', 'списание', 'кредит', 'credit'];
const DESC_COLUMNS = ['назначение', 'описание', 'операция', 'назначение платежа', 'description', 'details'];
const COUNTERPARTY_COLUMNS = ['контрагент', 'получатель', 'плательщик', 'counterparty', 'party'];
const DOC_NO_COLUMNS = ['номер документа', 'номер', 'document number', 'doc', 'doc_no'];

function findColumnIndex(sheet: XLSX.WorkSheet, rowIndex: number, possibleNames: string[]): number {
  const row = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 })[rowIndex] as string[] | undefined;
  if (!row || !Array.isArray(row)) return -1;
  const lower = (v: unknown) => String(v || '').toLowerCase().trim();
  for (let i = 0; i < row.length; i++) {
    const val = lower(row[i]);
    if (possibleNames.some(n => val.includes(n.toLowerCase()))) return i;
  }
  return -1;
}

function safeNumber(val: unknown): number {
  if (val == null || val === '') return 0;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  const s = String(val).replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

function toDateStr(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  // DD.MM.YYYY (Сбер, Альфа и др.)
  const dmy = typeof val === 'string' && val.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    return `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`;
  }
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const d = new Date(String(val));
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
}

export interface ParseResult {
  lines: BankStatementLine[];
  totalIncome: number;
  totalOutcome: number;
  periodFrom: string;
  periodTo: string;
}

/**
 * Парсит Excel-файл выписки.
 * Ищет заголовки в первых 5 строках; данные — до первой полностью пустой строки.
 */
export function parseBankStatementExcel(
  file: File,
  statementId: string
): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error('Не удалось прочитать файл');
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        if (!sheet) throw new Error('Лист не найден');

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1, defval: '' }) as (string | number)[][];
        let headerRow = 0;
        for (let r = 0; r < Math.min(15, rows.length); r++) {
          const row = rows[r];
          if (!row) continue;
          const str = row.map(c => String(c || '').toLowerCase()).join(' ');
          // Ищем строку с «дата» и колонками приход/расход (дебет, кредит, сумма) — чтобы не спутать с «Обороты дебет»
          const hasDate = str.includes('дата') || str.includes('date');
          const hasAmount = str.includes('дебет') || str.includes('кредит') || str.includes('сумма') || str.includes('amount') || str.includes('приход') || str.includes('расход');
          if (hasDate && hasAmount) {
            headerRow = r;
            break;
          }
        }

        const cols = {
          date: -1,
          amount: -1,
          income: -1,
          outcome: -1,
          desc: -1,
          counterparty: -1,
          docNo: -1,
        };

        cols.date = findColumnIndex(sheet, headerRow, DATE_COLUMNS);
        cols.amount = findColumnIndex(sheet, headerRow, AMOUNT_COLUMNS);
        cols.income = findColumnIndex(sheet, headerRow, INCOME_COLUMNS);
        cols.outcome = findColumnIndex(sheet, headerRow, OUTCOME_COLUMNS);
        cols.desc = findColumnIndex(sheet, headerRow, DESC_COLUMNS);
        cols.counterparty = findColumnIndex(sheet, headerRow, COUNTERPARTY_COLUMNS);
        cols.docNo = findColumnIndex(sheet, headerRow, DOC_NO_COLUMNS);

        if (cols.date < 0 && cols.amount < 0) {
          throw new Error('Не найдены колонки «дата» и «сумма». Пришлите пример файла для настройки маппинга.');
        }

        const lines: BankStatementLine[] = [];
        let totalIncome = 0;
        let totalOutcome = 0;
        let minDate = '';
        let maxDate = '';

        for (let r = headerRow + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row || !Array.isArray(row)) continue;
          const isEmpty = row.every(c => c == null || String(c).trim() === '');
          if (isEmpty) break;

          const dateStr = cols.date >= 0 ? toDateStr(row[cols.date]) : '';
          let amount = cols.amount >= 0 ? safeNumber(row[cols.amount]) : 0;
          const incomeVal = cols.income >= 0 ? safeNumber(row[cols.income]) : 0;
          const outcomeVal = cols.outcome >= 0 ? safeNumber(row[cols.outcome]) : 0;

          if (cols.income >= 0 && cols.outcome >= 0) {
            amount = incomeVal > 0 ? incomeVal : -outcomeVal;
          } else if (cols.income >= 0) {
            amount = incomeVal;
          } else if (cols.outcome >= 0) {
            amount = -outcomeVal;
          }

          if (amount === 0 && incomeVal === 0 && outcomeVal === 0) continue;

          const type: 'income' | 'outcome' = amount >= 0 ? 'income' : 'outcome';
          if (type === 'income') totalIncome += amount;
          else totalOutcome += Math.abs(amount);

          if (dateStr && (!minDate || dateStr < minDate)) minDate = dateStr;
          if (dateStr && (!maxDate || dateStr > maxDate)) maxDate = dateStr;

          const desc = cols.desc >= 0 ? String(row[cols.desc] ?? '') : '';
          const counterparty = cols.counterparty >= 0 ? String(row[cols.counterparty] ?? '') : '';
          const docNo = cols.docNo >= 0 ? String(row[cols.docNo] ?? '') : '';

          lines.push({
            id: `line-${statementId}-${r}-${Date.now()}`,
            statementId,
            date: dateStr || minDate || maxDate || new Date().toISOString().slice(0, 10),
            amount: type === 'outcome' ? -Math.abs(amount) : Math.abs(amount),
            description: desc || undefined,
            counterparty: counterparty || undefined,
            documentNumber: docNo || undefined,
            type,
          });
        }

        resolve({
          lines,
          totalIncome,
          totalOutcome,
          periodFrom: minDate || new Date().toISOString().slice(0, 10),
          periodTo: maxDate || new Date().toISOString().slice(0, 10),
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Ошибка парсинга'));
      }
    };
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsArrayBuffer(file);
  });
}
