import { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, X } from 'lucide-react';
import { buildMonthlyExcelData, exportMonthlyExcel } from '../lib/excelExport';
import {
  formatMonthShortLabel,
  formatNumber,
  type InventoryItem,
  type MaterialCategory,
} from '../types/inventory';

interface ExcelPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthKey: string;
  activeCategory: MaterialCategory | 'all';
  allMonthItems: InventoryItem[];
  filteredItems: InventoryItem[];
  hasActiveFilters: boolean;
  onExportError?: (message: string) => void;
}

const EXCEL_COL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

export function ExcelPreviewModal({
  isOpen,
  onClose,
  monthKey,
  activeCategory,
  allMonthItems,
  filteredItems,
  hasActiveFilters,
  onExportError,
}: ExcelPreviewModalProps) {
  const [scope, setScope] = useState<'current' | 'all'>('all');
  const [downloading, setDownloading] = useState(false);

  const canSwitchScope = activeCategory !== 'all' || hasActiveFilters;

  useEffect(() => {
    if (!isOpen) return;
    setScope(canSwitchScope ? 'current' : 'all');
  }, [isOpen, canSwitchScope]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const itemsToExport = useMemo(
    () => (scope === 'all' || !canSwitchScope ? allMonthItems : filteredItems),
    [scope, canSwitchScope, allMonthItems, filteredItems]
  );

  const excelData = useMemo(
    () => buildMonthlyExcelData(monthKey, itemsToExport),
    [monthKey, itemsToExport]
  );

  if (!isOpen) return null;

  async function handleDownload() {
    if (itemsToExport.length === 0 || downloading) return;
    setDownloading(true);
    try {
      await exportMonthlyExcel(monthKey, itemsToExport);
    } catch {
      onExportError?.('Não foi possível exportar o arquivo Excel.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="excel-preview-title"
    >
      {/* Top Preview Toolbar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="min-w-0 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 id="excel-preview-title" className="font-display text-base font-semibold text-slate-900">
              Prévia Excel (.xlsx)
            </h2>
            <p className="text-xs text-slate-500 truncate">
              {formatMonthShortLabel(monthKey)} · {excelData.rows.length} reg. ·{' '}
              <span className="font-mono-num">{excelData.fileName}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canSwitchScope && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setScope('current')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  scope === 'current'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Filtro ({filteredItems.length})
              </button>
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  scope === 'all'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mês ({allMonthItems.length})
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" />
            <span>Fechar</span>
          </button>

          <button
            type="button"
            disabled={itemsToExport.length === 0 || downloading}
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#9B1C1F] hover:bg-[#761619] disabled:opacity-40 text-white text-xs font-medium cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading ? 'Gerando...' : 'Baixar .xlsx'}</span>
          </button>
        </div>
      </div>

      {/* Scrollable Spreadsheet Stage */}
      <div className="flex-1 overflow-auto bg-slate-200/90 p-3 sm:p-6">
        <div className="max-w-[1440px] mx-auto bg-white border border-slate-300 shadow-lg rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
              {/* Spreadsheet Column Letters */}
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-[11px] font-mono-num text-slate-500">
                  <th className="w-10 px-2 py-1 text-center border-r border-slate-300 bg-slate-200/70" />
                  {EXCEL_COL_LETTERS.map((letter) => (
                    <th
                      key={letter}
                      className="px-3 py-1 text-center font-medium border-r border-slate-200 last:border-r-0"
                    >
                      {letter}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {/* Row 1: Report Title + Logo */}
                <tr className="border-b border-slate-100 bg-white">
                  <td className="px-2 py-2 text-center text-[11px] font-mono-num text-slate-400 bg-slate-100 border-r border-slate-300">
                    1
                  </td>
                  <td colSpan={7} className="px-3 py-2.5 align-middle">
                    <div className="text-base sm:text-lg font-bold tracking-tight text-[#9B1C1F]">
                      {excelData.title}
                    </div>
                  </td>
                  <td colSpan={2} className="px-3 py-2 text-right align-middle">
                    <img
                      src={`${import.meta.env.BASE_URL}logo-arames-brasil.jpg`}
                      alt="Arames Brasil"
                      className="h-9 w-auto max-w-[140px] object-contain ml-auto"
                    />
                  </td>
                </tr>

                {/* Row 2: Subtitle */}
                <tr className="border-b border-slate-100 bg-white">
                  <td className="px-2 py-1 text-center text-[11px] font-mono-num text-slate-400 bg-slate-100 border-r border-slate-300">
                    2
                  </td>
                  <td colSpan={9} className="px-3 py-1 text-[11px] italic text-slate-600">
                    {excelData.subtitle}
                  </td>
                </tr>

                {/* Row 3: Month & Emission */}
                <tr className="border-b border-slate-100 bg-white">
                  <td className="px-2 py-1 text-center text-[11px] font-mono-num text-slate-400 bg-slate-100 border-r border-slate-300">
                    3
                  </td>
                  <td colSpan={9} className="px-3 py-1 text-xs text-slate-800">
                    {excelData.metaLine}
                  </td>
                </tr>

                {/* Row 4: Responsaveis */}
                <tr className="border-b border-slate-100 bg-white">
                  <td className="px-2 py-1 text-center text-[11px] font-mono-num text-slate-400 bg-slate-100 border-r border-slate-300">
                    4
                  </td>
                  <td colSpan={9} className="px-3 py-1.5 text-xs font-bold text-slate-800">
                    {excelData.responsaveisLine}
                  </td>
                </tr>

                {/* Row 5: Spacer */}
                <tr className="h-2 bg-white border-b border-slate-200">
                  <td className="px-2 text-center text-[10px] font-mono-num text-slate-400 bg-slate-100 border-r border-slate-300">
                    5
                  </td>
                  <td colSpan={9} />
                </tr>

                {/* Row 6: Table Header */}
                <tr className="bg-[#9B1C1F] text-white border-b-2 border-[#761619]">
                  <td className="px-2 py-2.5 text-center text-[11px] font-mono-num text-slate-500 bg-slate-100 border-r border-slate-300">
                    6
                  </td>
                  {excelData.columns.map((col) => (
                    <th
                      key={col.key}
                      className="px-3 py-2.5 font-bold text-xs align-middle border-r border-white/15 last:border-r-0"
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>

                {/* Data Rows */}
                {excelData.rows.length === 0 ? (
                  <tr>
                    <td className="px-2 py-8 text-center text-[11px] font-mono-num text-slate-400 bg-slate-100 border-r border-slate-300">
                      7
                    </td>
                    <td colSpan={9} className="px-4 py-8 text-center text-xs text-slate-500">
                      Nenhum lançamento para exportar neste escopo.
                    </td>
                  </tr>
                ) : (
                  excelData.rows.map((rowData, idx) => {
                    const sheetRowNumber = idx + 7;
                    const isEven = sheetRowNumber % 2 === 0;
                    return (
                      <tr
                        key={`${rowData.categoria}-${rowData.material}-${idx}`}
                        className={`border-b border-slate-200 ${
                          isEven ? 'bg-[#F8F8F8]' : 'bg-white'
                        } hover:bg-amber-50/40`}
                      >
                        <td className="px-2 py-2 text-center text-[11px] font-mono-num text-slate-400 bg-slate-100 border-r border-slate-300">
                          {sheetRowNumber}
                        </td>
                        <td className="px-3 py-2 font-bold text-[#9B1C1F] border-r border-slate-200 whitespace-nowrap align-top">
                          {rowData.categoria}
                        </td>
                        <td className="px-3 py-2 text-slate-800 border-r border-slate-200 align-top">
                          {rowData.material}
                        </td>
                        <td className="px-3 py-2 text-slate-800 border-r border-slate-200 align-top">
                          {rowData.tipo}
                        </td>
                        <td className="px-3 py-2 text-slate-800 font-mono-num border-r border-slate-200 align-top">
                          {rowData.quantidade}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-800 font-mono-num border-r border-slate-200 whitespace-nowrap align-top">
                          {typeof rowData.kgUnidade === 'number'
                            ? formatNumber(rowData.kgUnidade, 2)
                            : rowData.kgUnidade}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-800 font-mono-num border-r border-slate-200 whitespace-nowrap align-top">
                          {typeof rowData.peso === 'number'
                            ? formatNumber(rowData.peso, 2)
                            : rowData.peso}
                        </td>
                        <td className="px-3 py-2 text-slate-800 font-mono-num border-r border-slate-200 whitespace-nowrap align-top">
                          {rowData.nf}
                        </td>
                        <td className="px-3 py-2 text-slate-700 border-r border-slate-200 align-top">
                          {rowData.responsavel}
                        </td>
                        <td className="px-3 py-2 text-slate-700 align-top">
                          {rowData.detalhes}
                        </td>
                      </tr>
                    );
                  })
                )}

                {/* Blank separator row + Totals Row */}
                {excelData.rows.length > 0 && (
                  <>
                    <tr className="h-3 bg-white border-b border-slate-200">
                      <td className="px-2 text-center text-[10px] font-mono-num text-slate-400 bg-slate-100 border-r border-slate-300">
                        {excelData.rows.length + 7}
                      </td>
                      <td colSpan={9} />
                    </tr>
                    <tr className="bg-slate-50 font-bold text-[#9B1C1F] border-t border-slate-300">
                      <td className="px-2 py-2.5 text-center text-[11px] font-mono-num text-slate-400 bg-slate-100 border-r border-slate-300">
                        {excelData.rows.length + 8}
                      </td>
                      <td className="px-3 py-2.5 border-r border-slate-200 whitespace-nowrap">
                        TOTAIS
                      </td>
                      <td className="px-3 py-2.5 border-r border-slate-200" />
                      <td className="px-3 py-2.5 border-r border-slate-200" />
                      <td className="px-3 py-2.5 border-r border-slate-200" />
                      <td className="px-3 py-2.5 border-r border-slate-200" />
                      <td className="px-3 py-2.5 text-right font-mono-num border-r border-slate-200 whitespace-nowrap">
                        Etiq./lote: {formatNumber(excelData.totalSemBalancaKg, 2)} kg
                      </td>
                      <td className="px-3 py-2.5 border-r border-slate-200" />
                      <td className="px-3 py-2.5 border-r border-slate-200" />
                      <td className="px-3 py-2.5 font-mono-num whitespace-nowrap">
                        Bal.: {formatNumber(excelData.totalBalancaKg, 2)} kg
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Sheet Tab Bar (Excel-like) */}
          <div className="px-3 py-1.5 bg-slate-100 border-t border-slate-300 flex items-center justify-between text-[11px] text-slate-600">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-white border border-slate-300 border-b-2 border-b-[#9B1C1F] rounded-t text-xs font-medium text-slate-900">
                {excelData.sheetName}
              </span>
            </div>
            <span className="font-mono-num text-slate-500">
              {excelData.rows.length} reg.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
