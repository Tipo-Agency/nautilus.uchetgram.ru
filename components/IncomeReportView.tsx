/**
 * Справка о доходах — загрузка выписок, сверка, формирование справки.
 * Данные по дням; минимальный период — 1 день; валюта — RUB.
 */
import React, { useState, useRef, useEffect } from 'react';
import { BankStatement, BankStatementLine, IncomeReport, IncomeFrom1C, User } from '../types';
import { FileText, Check, DollarSign, ChevronRight, X, RefreshCw, AlertTriangle, Printer } from 'lucide-react';
import { parseBankStatementExcel, type ParseResult } from '../utils/bankStatementParser';
import { Button, Card, DateInput } from './ui';
import { TaskSelect } from './TaskSelect';

const CURRENCY = 'RUB';

interface IncomeReportViewProps {
  bankStatements: BankStatement[];
  incomeReports: IncomeReport[];
  incomeFrom1C?: IncomeFrom1C[];
  currentUser: User;
  departments: { id: string; name: string }[];
  financialPlannings: { id: string; departmentId: string; period: string; income?: number }[];
  onSaveBankStatements: (stmt: BankStatement) => void;
  onSaveIncomeReports: (report: IncomeReport) => void;
  onSaveFinancialPlanning: (p: { id: string; departmentId: string; period: string; income?: number; [k: string]: unknown }) => void;
}

type ReconciliationStatus = 'ok' | 'mismatch' | 'next_day' | 'missing_bank' | 'missing_1c';

interface ReconRow {
  date: string;
  amount1C: number;
  amountBank: number;
  status: ReconciliationStatus;
  daysMissing?: number;
}

export const IncomeReportView: React.FC<IncomeReportViewProps> = ({
  bankStatements,
  incomeReports,
  incomeFrom1C = [],
  currentUser,
  departments,
  financialPlannings,
  onSaveBankStatements,
  onSaveIncomeReports,
  onSaveFinancialPlanning,
}) => {
  const [viewMode, setViewMode] = useState<'statements' | 'reports' | 'reconciliation'>('statements');
  const [uploading, setUploading] = useState(false);
  const [createReportOpen, setCreateReportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const uploadHandler = () => fileInputRef.current?.click();
    const createReportHandler = () => setCreateReportOpen(true);
    window.addEventListener('incomeReportUploadExcel', uploadHandler);
    window.addEventListener('incomeReportCreateReport', createReportHandler);
    return () => {
      window.removeEventListener('incomeReportUploadExcel', uploadHandler);
      window.removeEventListener('incomeReportCreateReport', createReportHandler);
    };
  }, []);
  const today = new Date().toISOString().slice(0, 10);
  const [createPeriodFrom, setCreatePeriodFrom] = useState(today);
  const [createPeriodTo, setCreatePeriodTo] = useState(today);
  const [createManualAmount, setCreateManualAmount] = useState('');
  const [expandedStatementId, setExpandedStatementId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reconPeriodFrom, setReconPeriodFrom] = useState(today);
  const [reconPeriodTo, setReconPeriodTo] = useState(today);
  const [createDepartmentId, setCreateDepartmentId] = useState(departments[0]?.id || '');
  const [uploadDepartmentId, setUploadDepartmentId] = useState(departments[0]?.id || '');
  const [uploadPending, setUploadPending] = useState<{ result: ParseResult; stmtId: string } | null>(null);
  const printContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (departments.length && !uploadDepartmentId) setUploadDepartmentId(departments[0].id);
    if (departments.length && !createDepartmentId) setCreateDepartmentId(departments[0].id);
  }, [departments, uploadDepartmentId, createDepartmentId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.match(/\.(xlsx|xls)$/i)) {
      alert('Выберите Excel-файл (.xlsx, .xls)');
      return;
    }
    setUploading(true);
    try {
      const result = await parseBankStatementExcel(file, '');
      setUploadPending({ result, stmtId: '' });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка парсинга');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const lineStableId = (deptId: string, date: string, docNo: string | undefined, amount: number, desc: string) => {
    const key = docNo && docNo.trim() ? docNo.trim() : `h${(date + amount + (desc || '')).split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0).toString(36).slice(-10)}`;
    return `txn-${deptId}-${date}-${key}`;
  };

  const confirmUpload = () => {
    if (!uploadPending || !uploadDepartmentId) return;
    const { result } = uploadPending;
    const stmtId = `stmt-dept-${uploadDepartmentId}`;
    const existingStmt = bankStatements.find(s => s.id === stmtId);
    const existingLines = new Map<string, BankStatementLine>(
      (existingStmt?.lines || []).map(l => [l.id, l])
    );
    for (const l of result.lines) {
      const id = lineStableId(uploadDepartmentId, l.date, l.documentNumber, l.amount, l.description || '');
      existingLines.set(id, {
        ...l,
        id,
        statementId: stmtId,
      });
    }
    const mergedLines = Array.from(existingLines.values());
    let totalIncome = 0;
    let totalOutcome = 0;
    let minDate = '';
    let maxDate = '';
    mergedLines.forEach(l => {
      if (l.type === 'income') totalIncome += l.amount;
      else totalOutcome += Math.abs(l.amount);
      if (l.date && (!minDate || l.date < minDate)) minDate = l.date;
      if (l.date && (!maxDate || l.date > maxDate)) maxDate = l.date;
    });
    const deptName = departments.find(d => d.id === uploadDepartmentId)?.name || 'Подразделение';
    const fmtDate = (s: string) => {
      const [y, m, d] = s.split('-');
      return `${d}.${m}.${y}`;
    };
    const name = minDate && maxDate
      ? `Выписка — ${fmtDate(minDate)}–${fmtDate(maxDate)} · ${totalIncome.toLocaleString('ru-RU')} ${CURRENCY}`
      : `Выписка — ${deptName}`;
    const stmt: BankStatement = {
      id: stmtId,
      name,
      departmentId: uploadDepartmentId,
      periodFrom: minDate || result.periodFrom,
      periodTo: maxDate || result.periodTo,
      uploadedAt: new Date().toISOString(),
      uploadedByUserId: currentUser.id,
      totalIncome,
      totalOutcome,
      lines: mergedLines,
    };
    onSaveBankStatements(stmt);
    setUploadPending(null);
  };

  const linesInPeriod = (stmt: BankStatement, from: string, to: string) =>
    (stmt.lines || []).filter(l => l.date >= from && l.date <= to && l.type === 'income');

  const departmentStatementId = (deptId: string) => `stmt-dept-${deptId}`;

  const incomeFromDepartmentInRange = (from: string, to: string, deptId: string) => {
    const stmt = bankStatements.find(s => s.id === departmentStatementId(deptId));
    if (!stmt) return 0;
    return linesInPeriod(stmt, from, to).reduce((s, l) => s + l.amount, 0);
  };

  const handleCreateReport = () => {
    const periodFrom = createPeriodFrom;
    const periodTo = createPeriodTo;
    if (periodFrom > periodTo) {
      alert('Дата «с» не может быть позже даты «по»');
      return;
    }
    const fromBank = incomeFromDepartmentInRange(periodFrom, periodTo, createDepartmentId);
    const manual = parseFloat(createManualAmount) || 0;
    const amount = fromBank + manual;

    if (amount <= 0) {
      alert('Загрузите выписку для подразделения или введите сумму вручную');
      return;
    }

    const period = periodFrom.slice(0, 7);
    const report: IncomeReport = {
      id: `report-${Date.now()}`,
      period,
      periodFrom,
      periodTo,
      amount,
      departmentId: createDepartmentId || undefined,
      source: fromBank > 0 ? (manual > 0 ? 'mixed' : 'bank_statements') : 'manual',
      statementIds: [],
      manualAmount: manual || undefined,
      createdAt: new Date().toISOString(),
      createdByUserId: currentUser.id,
    };
    onSaveIncomeReports(report);

    financialPlannings.filter(p => p.period === period).forEach(planning => {
      onSaveFinancialPlanning({ ...planning, income: amount });
    });

    setCreateReportOpen(false);
    setCreatePeriodFrom(today);
    setCreatePeriodTo(today);
    setCreateManualAmount('');
    setSelectedReportId(report.id);
  };

  // Данные банка по датам (приходы)
  const bankByDate = React.useMemo(() => {
    const map: Record<string, number> = {};
    bankStatements.forEach(s => {
      (s.lines || []).filter(l => l.type === 'income').forEach(l => {
        map[l.date] = (map[l.date] || 0) + l.amount;
      });
    });
    return map;
  }, [bankStatements]);

  // Данные 1С по датам
  const oneCByDate = React.useMemo(() => {
    const map: Record<string, number> = {};
    incomeFrom1C.forEach(r => {
      map[r.date] = (map[r.date] || 0) + r.amount;
    });
    return map;
  }, [incomeFrom1C]);

  // Сверка за период
  const reconRows = React.useMemo((): ReconRow[] => {
    const from = reconPeriodFrom <= reconPeriodTo ? reconPeriodFrom : reconPeriodTo;
    const to = reconPeriodFrom <= reconPeriodTo ? reconPeriodTo : reconPeriodFrom;
    const start = new Date(from);
    const end = new Date(to);
    const rows: ReconRow[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const amt1c = oneCByDate[dateStr] ?? 0;
      const amtBank = bankByDate[dateStr] ?? 0;
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().slice(0, 10);
      const amtBankNext = bankByDate[nextDayStr] ?? 0;
      let status: ReconciliationStatus = 'ok';
      let daysMissing: number | undefined;
      if (amt1c === 0 && amtBank === 0) continue; // пропускаем пустые дни
      if (amt1c > 0 && amtBank === 0) {
        if (amtBankNext > 0 && Math.abs(amtBankNext - amt1c) / (amt1c || 1) < 0.02) status = 'next_day';
        else {
          status = 'missing_bank';
          const diff = Math.floor((today.getTime() - d.getTime()) / 864e5);
          if (diff > 10) daysMissing = diff;
        }
      } else if (amt1c === 0 && amtBank > 0) {
        status = 'missing_1c';
        const diff = Math.floor((today.getTime() - d.getTime()) / 864e5);
        if (diff > 10) daysMissing = diff;
      } else if (Math.abs(amt1c - amtBank) / (amt1c || 1) > 0.02) {
        status = 'mismatch';
      }
      rows.push({ date: dateStr, amount1C: amt1c, amountBank: amtBank, status, daysMissing });
    }
    return rows;
  }, [reconPeriodFrom, reconPeriodTo, bankByDate, oneCByDate]);

  const hasReconAlerts = reconRows.some(r => r.daysMissing !== undefined);

  return (
    <div className="space-y-6">
      {/* Переключатель режима: не вкладки, а кнопки-секции */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setViewMode('statements')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'statements' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-[#252525] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333]'
          }`}
        >
          Выписки
        </button>
        <button
          onClick={() => setViewMode('reports')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'reports' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-[#252525] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333]'
          }`}
        >
          Сформированные справки
        </button>
        <button
          onClick={() => setViewMode('reconciliation')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            viewMode === 'reconciliation' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-[#252525] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333]'
          }`}
        >
          <RefreshCw size={16} />
          Сверка
          {hasReconAlerts && <span className="w-2 h-2 rounded-full bg-red-500" />}
        </button>
      </div>

      {viewMode === 'statements' && (
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileSelect}
          />
          {uploading && <p className="text-sm text-gray-500 dark:text-gray-400">Загрузка выписки...</p>}
          {bankStatements.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">Нет выписок. Загрузите Excel-файл выписки из банка.</p>
              <p className="text-xs text-gray-400 mt-2">Поддерживаются колонки: дата, сумма, приход, расход, назначение, контрагент</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {bankStatements.map(stmt => (
                <Card key={stmt.id} padding="md" className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedStatementId(expandedStatementId === stmt.id ? null : stmt.id)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <FileText size={20} className="text-gray-500" />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{stmt.name}</div>
                        <div className="text-xs text-gray-500">
                          {stmt.periodFrom} — {stmt.periodTo} · Приход: {stmt.totalIncome?.toLocaleString()} {CURRENCY}
                          {stmt.departmentId && (
                            <> · {departments.find(d => d.id === stmt.departmentId)?.name || '—'}</>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={18} className={`text-gray-400 transition-transform ${expandedStatementId === stmt.id ? 'rotate-90' : ''}`} />
                  </button>
                  {expandedStatementId === stmt.id && stmt.lines && (
                    <div className="mt-4 border-t border-gray-100 dark:border-[#333] pt-4 max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="text-left py-1">Дата</th>
                            <th className="text-left py-1">Сумма</th>
                            <th className="text-left py-1">Назначение</th>
                          </tr>
                        </thead>
                        <tbody>
                            {(stmt.lines || []).slice(0, 50).map(line => (
                            <tr key={line.id} className="border-t border-gray-50 dark:border-[#333]">
                              <td className="py-1">{line.date}</td>
                              <td className={`py-1 ${line.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{line.amount.toLocaleString()}</td>
                              <td className="py-1 truncate max-w-[200px]">{line.description || line.counterparty || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {(stmt.lines || []).length > 50 && (
                        <p className="text-xs text-gray-400 mt-2">Показано 50 из {(stmt.lines || []).length}</p>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {viewMode === 'reconciliation' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <DateInput label="Дата с" value={reconPeriodFrom} onChange={setReconPeriodFrom} max={reconPeriodTo} />
            <DateInput label="Дата по" value={reconPeriodTo} onChange={setReconPeriodTo} min={reconPeriodFrom} />
          </div>
          {hasReconAlerts && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle size={18} />
              Есть дни без данных в банке или 1С более 10 дней. Обратите внимание на строки с пометкой.
            </div>
          )}
          <div className="overflow-x-auto border border-gray-200 dark:border-[#333] rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#202020]">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-600 dark:text-gray-400">Дата</th>
                  <th className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">1С</th>
                  <th className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">Банк</th>
                  <th className="px-4 py-3 text-left text-gray-600 dark:text-gray-400">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
                {reconRows.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">Нет данных за выбранный период</td></tr>
                ) : (
                  reconRows.map(row => (
                    <tr
                      key={row.date}
                      className={`${
                        row.status === 'mismatch' ? 'bg-red-50 dark:bg-red-900/20' :
                        row.status === 'next_day' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                        (row.daysMissing !== undefined ? 'bg-amber-50 dark:bg-amber-900/20' : '')
                      }`}
                    >
                      <td className="px-4 py-2 text-gray-900 dark:text-white">{row.date}</td>
                      <td className={`px-4 py-2 text-right ${row.status === 'missing_1c' ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                        {row.amount1C > 0 ? row.amount1C.toLocaleString() : '—'}
                      </td>
                      <td className={`px-4 py-2 text-right ${row.status === 'missing_bank' ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                        {row.amountBank > 0 ? row.amountBank.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2">
                        {row.status === 'mismatch' && <span className="text-red-600 dark:text-red-400 font-medium">Не сходится</span>}
                        {row.status === 'next_day' && <span className="text-yellow-700 dark:text-yellow-400">Поступление на след. день</span>}
                        {row.status === 'missing_bank' && (
                          <span className="text-amber-700 dark:text-amber-400">
                            Нет в банке
                            {row.daysMissing !== undefined && ` (${row.daysMissing} дн.)`}
                          </span>
                        )}
                        {row.status === 'missing_1c' && (
                          <span className="text-amber-700 dark:text-amber-400">
                            Нет в 1С
                            {row.daysMissing !== undefined && ` (${row.daysMissing} дн.)`}
                          </span>
                        )}
                        {row.status === 'ok' && <span className="text-green-600 dark:text-green-400">OK</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === 'reports' && (
        <div className="space-y-2">
          {incomeReports.length === 0 ? (
            <Card className="p-12 text-center">
              <DollarSign size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">Нет сформированных справок</p>
            </Card>
          ) : (
            incomeReports.map(r => (
              <Card
                key={r.id}
                padding="md"
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition-colors"
                onClick={() => setSelectedReportId(r.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Справка за {r.periodFrom} — {r.periodTo}</div>
                    <div className="text-sm text-gray-500">
                      {r.source === 'manual' ? 'Вручную' : 'По выпискам'}
                      {r.departmentId && (
                        <> · {departments.find(d => d.id === r.departmentId)?.name || '—'}</>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="font-bold text-gray-900 dark:text-white">{r.amount.toLocaleString()} {CURRENCY}</div>
                    <ChevronRight size={18} className="text-gray-400" />
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Детальный вид справки (печатная форма) */}
      {selectedReportId && (() => {
        const r = incomeReports.find(x => x.id === selectedReportId);
        if (!r) return null;
        const stmts = (r.statementIds || []).length > 0
          ? bankStatements.filter(s => (r.statementIds || []).includes(s.id))
          : (r.departmentId ? bankStatements.filter(s => s.id === departmentStatementId(r.departmentId!)) : []);
        let commissionAmount = 0;
        let totalOutcome = 0;
        stmts.forEach(s => {
          (s.lines || []).filter(l => l.date >= r.periodFrom && l.date <= r.periodTo).forEach(l => {
            if (l.type === 'outcome') {
              totalOutcome += Math.abs(l.amount);
              if ((l.description || '').toLowerCase().includes('комиссия')) commissionAmount += Math.abs(l.amount);
            }
          });
        });
        const available = r.amount - commissionAmount;
        const handlePrint = () => {
          const content = printContentRef.current;
          if (!content) return;
          const win = window.open('', '_blank');
          if (!win) return;
          win.document.write(`
            <!DOCTYPE html><html><head><title>Справка о доходах</title>
            <style>body{font-family:system-ui;padding:24px;max-width:600px;margin:0 auto}
            h1{font-size:18px;margin-bottom:16px}table{width:100%;border-collapse:collapse}
            td{padding:8px 0;border-bottom:1px solid #eee}.label{color:#666}.val{font-weight:600;text-align:right}
            .footer{margin-top:24px;font-size:12px;color:#999}</style></head><body>
            ${content.innerHTML}
            <div class="footer">Сформировано ${new Date().toLocaleString('ru-RU')}</div>
            </body></html>`);
          win.document.close();
          win.focus();
          win.print();
          win.close();
        };
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedReportId(null)}>
            <div className="bg-white dark:bg-[#252525] rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center">
                <h3 className="font-bold text-gray-900 dark:text-white">Справка о доходах</h3>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={handlePrint}>
                    <Printer size={16} /> Печать
                  </Button>
                  <button onClick={() => setSelectedReportId(null)} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>
              </div>
              <div ref={printContentRef} className="p-6 space-y-4">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Период</div>
                  <div className="font-medium text-gray-900 dark:text-white">{r.periodFrom} — {r.periodTo}</div>
                </div>
                {r.departmentId && (
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Подразделение</div>
                    <div className="font-medium text-gray-900 dark:text-white">{departments.find(d => d.id === r.departmentId)?.name || '—'}</div>
                  </div>
                )}
                <table className="w-full text-sm">
                  <tbody>
                    <tr><td className="label py-2">Доход (приход) за период</td><td className="val">{r.amount.toLocaleString()} {CURRENCY}</td></tr>
                    <tr><td className="label py-2">Комиссии за период</td><td className="val">{commissionAmount.toLocaleString()} {CURRENCY}</td></tr>
                    <tr><td className="label py-2 font-semibold text-gray-900 dark:text-white">Доступно к расходованию</td><td className="val font-bold text-green-600 dark:text-green-400">{available.toLocaleString()} {CURRENCY}</td></tr>
                  </tbody>
                </table>
                <div className="text-xs text-gray-500 dark:text-gray-400 pt-2">
                  Источник: {r.source === 'manual' ? 'Введено вручную' : r.source === 'mixed' ? 'Выписки + ручной ввод' : 'Банковские выписки'}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Модалка подтверждения загрузки — выбор подразделения */}
      {uploadPending && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setUploadPending(null)}>
          <div className="bg-white dark:bg-[#252525] rounded-xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center">
              <h3 className="font-bold text-gray-900 dark:text-white">Выписка загружена</h3>
              <button onClick={() => setUploadPending(null)} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {uploadPending.result.periodFrom} — {uploadPending.result.periodTo} · Приход: {uploadPending.result.totalIncome.toLocaleString('ru-RU')} {CURRENCY}
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Подразделение</label>
                <TaskSelect
                  value={uploadDepartmentId}
                  onChange={setUploadDepartmentId}
                  options={[
                    { value: '', label: 'Выберите подразделение' },
                    ...departments.map(d => ({ value: d.id, label: d.name }))
                  ]}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setUploadPending(null)} size="md">Отмена</Button>
                <Button onClick={confirmUpload} size="md" disabled={!uploadDepartmentId}>
                  <Check size={18} /> Сохранить выписку
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {createReportOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setCreateReportOpen(false)}>
          <div className="bg-white dark:bg-[#252525] rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center">
              <h3 className="font-bold text-gray-900 dark:text-white">Справка о доходах за период</h3>
              <button onClick={() => setCreateReportOpen(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Подразделение</label>
                <TaskSelect
                  value={createDepartmentId}
                  onChange={setCreateDepartmentId}
                  options={[
                    { value: '', label: 'Выберите подразделение' },
                    ...departments.map(d => ({ value: d.id, label: d.name }))
                  ]}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <DateInput label="Дата с" value={createPeriodFrom} onChange={setCreatePeriodFrom} max={createPeriodTo} />
                <DateInput label="Дата по" value={createPeriodTo} onChange={setCreatePeriodTo} min={createPeriodFrom} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Сумма вручную (опционально)</label>
                <input
                  type="number"
                  value={createManualAmount}
                  onChange={e => setCreateManualAmount(e.target.value)}
                  placeholder="0"
                  className="w-full border border-gray-300 dark:border-[#444] rounded-lg px-3 py-2 bg-white dark:bg-[#333] text-gray-900 dark:text-white [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <Button onClick={handleCreateReport} size="md" className="w-full">
                <Check size={18} /> Сформировать
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
