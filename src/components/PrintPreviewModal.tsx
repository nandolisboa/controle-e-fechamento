import { useEffect, useMemo, useState } from 'react';
import { Printer, X } from 'lucide-react';
import { consolidateInventoryItems } from '../lib/consolidation';
import {
  CATEGORY_MAP,
  formatArameBoxes,
  formatKg,
  formatMonthLabel,
  formatMonthShortLabel,
  formatNumber,
  getArameMetrics,
  type InventoryItem,
  type MaterialCategory,
  resolveTelaPopByCode,
} from '../types/inventory';

interface PrintPreviewModalProps {
  isOpen: boolean;
  isTestMode?: boolean;
  onClose: () => void;
  monthKey: string;
  isLocked: boolean;
  monthNotes: string;
  activeCategory: MaterialCategory | 'all';
  allMonthItems: InventoryItem[];
  filteredItems: InventoryItem[];
  hasActiveFilters: boolean;
}

type PrintDetailLevel = 'simplificado' | 'detalhado';

export function PrintPreviewModal({
  isOpen,
  isTestMode = false,
  onClose,
  monthKey,
  isLocked,
  monthNotes,
  activeCategory,
  allMonthItems,
  filteredItems,
  hasActiveFilters,
}: PrintPreviewModalProps) {
  const [detailLevel, setDetailLevel] = useState<PrintDetailLevel>('simplificado');
  const [scope, setScope] = useState<'current' | 'all'>('current');

  useEffect(() => {
    if (!isOpen) return;
    setDetailLevel('simplificado');
    setScope('current');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const canSwitchScope = activeCategory !== 'all' || hasActiveFilters;
  const effectiveCategory: MaterialCategory | 'all' =
    scope === 'all' ? 'all' : activeCategory;
  const itemsToPrint = scope === 'all' ? allMonthItems : filteredItems;
  const responsaveis = Array.from(new Set(itemsToPrint.flatMap((item) => item.conferentes ?? []))).filter(Boolean);
  const faltaResponsavel = itemsToPrint.some((item) => !item.conferentes?.length || item.temConferenciaSemNome);
  const outrosItems = itemsToPrint.filter((item) => item.category === 'outros_materiais');

  const scopeTitle =
    effectiveCategory === 'all'
      ? scope === 'current' && hasActiveFilters
        ? 'Geral (filtrado)'
        : 'Estoque Completo'
      : CATEGORY_MAP[effectiveCategory].label;

  const consolidated = useMemo(
    () => consolidateInventoryItems(itemsToPrint),
    [itemsToPrint]
  );

  if (!isOpen) return null;

  const generatedAt = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date());

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 flex flex-col print:static print:inset-auto print:bg-white print:block"
      role="dialog"
      aria-modal="true"
      aria-labelledby="print-preview-title"
    >
      {/* Top Preview Toolbar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 no-print">
        <div className="min-w-0">
          <h2 id="print-preview-title" className="font-display text-base font-semibold text-slate-900">
            Prévia PDF / Impressão
          </h2>
          <p className="text-xs text-slate-500">
            A4 · {formatMonthShortLabel(monthKey)} · {itemsToPrint.length} reg.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setDetailLevel('simplificado')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                detailLevel === 'simplificado'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Simplif.
            </button>
            <button
              type="button"
              onClick={() => setDetailLevel('detalhado')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                detailLevel === 'detalhado'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Detalhado
            </button>
          </div>

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
            disabled={itemsToPrint.length === 0}
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-medium cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {/* Scrollable A4 Preview Stage */}
      <div className="flex-1 overflow-y-auto bg-slate-200/90 p-4 sm:p-8 print:bg-white print:p-0 print:overflow-visible">
        <div className="print-sheet bg-white max-w-[210mm] min-h-[265mm] mx-auto shadow-lg border border-slate-300 p-7 sm:p-10 text-slate-900 flex flex-col justify-between print:shadow-none print:border-0 print:p-0 print:max-w-none print:min-h-0">
          <div className="space-y-5">
            {/* Clean Executive Header */}
            <header className="pb-3.5 border-b border-slate-900 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <img
                  src={`${import.meta.env.BASE_URL}logo-arames-brasil.jpg`}
                  alt="Arames Brasil"
                  className="h-10 w-auto max-w-[190px] object-contain object-left"
                />
                <h1 className="font-display text-xl font-bold text-slate-900 mt-0.5">
                  {formatMonthLabel(monthKey)} — {scopeTitle}
                </h1>
              </div>
              <div className="text-left sm:text-right text-[11px] text-slate-600 font-mono-num">
                <div>
                  Status: <span className="font-medium text-slate-900">{isLocked ? 'Fechado' : 'Em aberto'}</span>
                </div>
                <div>Emissão: {generatedAt}</div>
              </div>
            </header>

            {isTestMode && <div className="p-2 border border-amber-600 text-center font-bold text-amber-900 text-xs">MODO TESTE LOCAL — NÃO REPRESENTA O ESTOQUE OFICIAL</div>}
            {monthNotes.trim() && (
              <div className="px-3 py-2 border-l-2 border-slate-400 bg-slate-50 text-xs text-slate-700">
                <span className="font-semibold text-slate-900">Obs.:</span> {monthNotes}
              </div>
            )}

            {itemsToPrint.length === 0 ? (
              <div className="py-12 border border-slate-200 text-center text-xs text-slate-500">
                Nenhum material lançado neste escopo.
              </div>
            ) : detailLevel === 'simplificado' ? (
              <div className="space-y-5">
                {/* 1. Estribos */}
                {consolidated.estribos.length > 0 && (
                  <section className="space-y-1.5 break-inside-avoid">
                    <div className="flex items-baseline justify-between border-b border-slate-300 pb-1">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
                        Estribo
                      </h2>
                      <span className="text-[11px] font-mono-num text-slate-500">
                        {consolidated.estribos.length} med.
                      </span>
                    </div>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-300 text-[11px] text-slate-500">
                          <th className="py-1.5 pr-3 font-medium">Bitola</th>
                          <th className="py-1.5 px-3 font-medium">Medida</th>
                          <th className="py-1.5 px-3 text-right font-medium">Peças</th>
                          <th className="py-1.5 px-3 text-right font-medium">Pacotes</th>
                          <th className="py-1.5 pl-3 text-right font-medium">Peso (kg)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {consolidated.estribos.map((row) => (
                          <tr key={row.key}>
                            <td className="py-1.5 pr-3 font-mono-num font-medium text-slate-900">
                              {row.bitola}
                            </td>
                            <td className="py-1.5 px-3 font-mono-num text-slate-800">
                              {row.medida}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono-num text-slate-700">
                              {formatNumber(row.qtdPecas)}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono-num text-slate-700">
                              {formatNumber(row.qtdPacotes)}
                            </td>
                            <td className="py-1.5 pl-3 text-right font-mono-num font-medium text-slate-900">
                              {formatKg(row.kg)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-400 bg-slate-50/70 font-semibold text-slate-900">
                          <td colSpan={2} className="py-1.5 pr-3">
                            Subtotal
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono-num">
                            {formatNumber(consolidated.estriboTotalPecas)}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono-num">
                            {formatNumber(consolidated.estriboTotalPacotes)}
                          </td>
                          <td className="py-1.5 pl-3 text-right font-mono-num">
                            {formatKg(consolidated.estriboTotalKg)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </section>
                )}

                {/* 2. Bobinas */}
                {consolidated.bobinas.length > 0 && (
                  <section className="space-y-1.5 break-inside-avoid">
                    <div className="flex items-baseline justify-between border-b border-slate-300 pb-1">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
                        Bobinas
                      </h2>
                      <span className="text-[11px] font-mono-num text-slate-500">
                        {formatNumber(consolidated.bobinaTotalUn)} un
                      </span>
                    </div>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-300 text-[11px] text-slate-500">
                          <th className="py-1.5 pr-3 font-medium">Bitola</th>
                          <th className="py-1.5 px-3 text-right font-medium">Qtd.</th>
                          <th className="py-1.5 px-3 text-right font-medium">Etiq. (kg)</th>
                          <th className="py-1.5 pl-3 text-right font-medium">Bal. (kg)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {consolidated.bobinas.map((row) => (
                          <tr key={row.key}>
                            <td className="py-1.5 pr-3 font-mono-num font-medium text-slate-900">
                              {row.bitola}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono-num text-slate-700">
                              {formatNumber(row.unidades)} un
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono-num font-medium text-slate-900">
                              {row.etiquetaKg > 0 ? formatKg(row.etiquetaKg) : '—'}
                            </td>
                            <td className="py-1.5 pl-3 text-right font-mono-num text-slate-700">
                              {row.scaleWeightKg > 0 ? formatKg(row.scaleWeightKg) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-400 bg-slate-50/70 font-semibold text-slate-900">
                          <td className="py-1.5 pr-3">Subtotal</td>
                          <td className="py-1.5 px-3 text-right font-mono-num">
                            {formatNumber(consolidated.bobinaTotalUn)} un
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono-num">
                            {consolidated.bobinaTotalEtiquetaKg > 0
                              ? formatKg(consolidated.bobinaTotalEtiquetaKg)
                              : '—'}
                          </td>
                          <td className="py-1.5 pl-3 text-right font-mono-num">
                            {consolidated.bobinaTotalBalancaKg > 0
                              ? formatKg(consolidated.bobinaTotalBalancaKg)
                              : '—'}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </section>
                )}

                {/* 3. Barras */}
                {consolidated.barras.length > 0 && (
                  <section className="space-y-1.5 break-inside-avoid">
                    <div className="flex items-baseline justify-between border-b border-slate-300 pb-1">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
                        Barras
                      </h2>
                      <span className="text-[11px] font-mono-num text-slate-500">
                        {formatNumber(consolidated.barraTotalQtd)} br
                      </span>
                    </div>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-300 text-[11px] text-slate-500">
                          <th className="py-1.5 pr-3 font-medium">Bitola</th>
                          <th className="py-1.5 px-3 text-right font-medium">Barras</th>
                          <th className="py-1.5 px-3 text-right font-medium">Etiq. (kg)</th>
                          <th className="py-1.5 pl-3 text-right font-medium">Bal. (kg)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {consolidated.barras.map((row) => (
                          <tr key={row.key}>
                            <td className="py-1.5 pr-3 font-mono-num font-medium text-slate-900">
                              {row.bitola}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono-num text-slate-700">
                              {row.qtdBarras > 0 ? formatNumber(row.qtdBarras) : '—'}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono-num font-medium text-slate-900">
                              {row.kg > 0 ? formatKg(row.kg) : '—'}
                            </td>
                            <td className="py-1.5 pl-3 text-right font-mono-num text-slate-700">
                              {row.scaleWeightKg > 0 ? formatKg(row.scaleWeightKg) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-400 bg-slate-50/70 font-semibold text-slate-900">
                          <td className="py-1.5 pr-3">Subtotal</td>
                          <td className="py-1.5 px-3 text-right font-mono-num">
                            {consolidated.barraTotalQtd > 0
                              ? formatNumber(consolidated.barraTotalQtd)
                              : '—'}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono-num">
                            {consolidated.barraTotalKg > 0
                              ? formatKg(consolidated.barraTotalKg)
                              : '—'}
                          </td>
                          <td className="py-1.5 pl-3 text-right font-mono-num">
                            {consolidated.barraTotalBalanca > 0
                              ? formatKg(consolidated.barraTotalBalanca)
                              : '—'}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </section>
                )}

                {/* 4. Telas Pop */}
                {consolidated.telas.length > 0 && (
                  <section className="space-y-1.5 break-inside-avoid">
                    <div className="flex items-baseline justify-between border-b border-slate-300 pb-1">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
                        Telas Pop
                      </h2>
                      <span className="text-[11px] font-mono-num text-slate-500">
                        {formatNumber(consolidated.telaTotalUn)} un
                      </span>
                    </div>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-300 text-[11px] text-slate-500">
                          <th className="py-1.5 pr-3 font-medium">Cód. / Fio</th>
                          <th className="py-1.5 px-3 font-medium">Espec.</th>
                          <th className="py-1.5 pl-3 text-right font-medium">Qtd.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {consolidated.telas.map((row) => (
                          <tr key={row.key}>
                            <td className="py-1.5 pr-3 font-mono-num font-medium text-slate-900">
                              {row.code}
                            </td>
                            <td className="py-1.5 px-3 text-slate-700">{row.specText}</td>
                            <td className="py-1.5 pl-3 text-right font-mono-num font-medium text-slate-900">
                              {formatNumber(row.unidades)} un
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-400 bg-slate-50/70 font-semibold text-slate-900">
                          <td colSpan={2} className="py-1.5 pr-3">
                            Subtotal
                          </td>
                          <td className="py-1.5 pl-3 text-right font-mono-num">
                            {formatNumber(consolidated.telaTotalUn)} un
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </section>
                )}

                {/* 5. Arames */}
                {consolidated.arames.length > 0 && (
                  <section className="space-y-1.5 break-inside-avoid">
                    <div className="flex items-baseline justify-between border-b border-slate-300 pb-1">
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
                        Arames
                      </h2>
                      <span className="text-[11px] font-mono-num text-slate-500">
                        {formatKg(consolidated.arameTotalKg)}
                      </span>
                    </div>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-300 text-[11px] text-slate-500">
                          <th className="py-1.5 pr-3 font-medium">Tipo / Bitola</th>
                          <th className="py-1.5 px-3 font-medium">Emb.</th>
                          <th className="py-1.5 px-3 text-right font-medium">Qtd.</th>
                          <th className="py-1.5 pl-3 text-right font-medium">Peso (kg)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {consolidated.arames.map((row) => (
                          <tr key={row.key}>
                            <td className="py-1.5 pr-3 font-medium text-slate-900">
                              {row.wireLabel} · <span className="font-mono-num">{row.bitola}</span>
                            </td>
                            <td className="py-1.5 px-3 font-mono-num text-slate-700">
                              {row.isVariedCoil
                                ? 'Bob. kg var.'
                                : formatArameBoxes(row.unidades)}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono-num text-slate-700">
                              {formatNumber(row.unidades)}{' '}
                              {row.isVariedCoil ? 'bob.' : 'un'}
                            </td>
                            <td className="py-1.5 pl-3 text-right font-mono-num font-medium text-slate-900">
                              {formatKg(row.kg)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-400 bg-slate-50/70 font-semibold text-slate-900">
                          <td colSpan={3} className="py-1.5 pr-3">
                            Subtotal
                          </td>
                          <td className="py-1.5 pl-3 text-right font-mono-num">
                            {formatKg(consolidated.arameTotalKg)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </section>
                )}

                {outrosItems.length > 0 && (
                  <section className="space-y-1.5 break-inside-avoid">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1">Outros</h2>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead><tr className="border-b border-slate-300 text-[11px] text-slate-500"><th className="py-1.5 pr-3">Material</th><th className="py-1.5 pr-3">Qtd.</th><th className="py-1.5 pr-3">Kg/un</th><th className="py-1.5 pr-3">NF</th><th className="py-1.5 text-right">Peso</th></tr></thead>
                      <tbody>{outrosItems.map((item) => <tr key={item.id} className="border-b border-slate-200"><td className="py-1.5 pr-3">{item.materialName || item.bitola}</td><td className="py-1.5 pr-3 font-mono-num">{item.unidades > 0 ? formatNumber(item.unidades) : '—'}</td><td className="py-1.5 pr-3 font-mono-num">{(item.kgPorUnidade ?? 0) > 0 ? `${formatNumber(item.kgPorUnidade ?? 0, 3)} kg` : '—'}</td><td className="py-1.5 pr-3 font-mono-num">{item.notaFiscal || '—'}</td><td className="py-1.5 text-right font-mono-num">{item.kg > 0 ? formatKg(item.kg) : '—'}</td></tr>)}</tbody>
                    </table>
                  </section>
                )}

                {/* Separated Grand Totals */}
                {(consolidated.totalSemBalancaKg > 0 || consolidated.totalBalancaKg > 0) && (
                  <div className="pt-2.5 border-t-2 border-slate-900 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-slate-900">
                    <span className="uppercase tracking-wider">Totais</span>
                    <div className="flex flex-wrap items-center gap-5 font-mono-num">
                      {consolidated.totalSemBalancaKg > 0 && (
                        <span>
                          Etiq./Lote:{' '}
                          <span className="text-sm font-bold">
                            {formatKg(consolidated.totalSemBalancaKg)}
                          </span>
                        </span>
                      )}
                      {consolidated.totalBalancaKg > 0 && (
                        <span>
                          Bal.:{' '}
                          <span className="text-sm font-bold">
                            {formatKg(consolidated.totalBalancaKg)}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Detalhado View */
              <div className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Lançamentos detalhados
                </h2>
                <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-700">
                      <th className="px-2.5 py-2 border-r border-slate-300">Cat.</th>
                      <th className="px-2.5 py-2 border-r border-slate-300">Bitola / Cód.</th>
                      <th className="px-2.5 py-2 border-r border-slate-300">Qtd.</th>
                      <th className="px-2.5 py-2 text-right border-r border-slate-300">Peso / Bal.</th>
                      <th className="px-2.5 py-2">Detalhes / Obs.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {itemsToPrint.map((item) => {
                      const catMeta = CATEGORY_MAP[item.category];
                      let qtySummary = '—';
                      let weightDisplay = item.kg > 0 ? formatKg(item.kg) : '—';
                      let detailText = item.notes || '';

                      if (item.category === 'estribo') {
                        qtySummary = `${formatNumber(item.qtdPecas)} pçs · ${formatNumber(item.qtdPacotes)} pcts`;
                        if (item.medida) {
                          const med = `Med.: ${item.medida}`;
                          detailText = detailText ? `${med} · ${detailText}` : med;
                        }
                      } else if (item.category === 'bobina') {
                        qtySummary = `${formatNumber(item.unidades)} un`;
                        const etiquetaKg =
                          item.hasLabel || !item.hasScaleWeight ? item.kg : 0;
                        const scaleKg = item.hasScaleWeight ? item.scaleWeightKg : 0;
                        if (etiquetaKg > 0 && scaleKg > 0) {
                          weightDisplay = `${formatKg(etiquetaKg)} (Bal.: ${formatKg(scaleKg)})`;
                        } else if (scaleKg > 0) {
                          weightDisplay = formatKg(scaleKg);
                        } else {
                          weightDisplay = etiquetaKg > 0 ? formatKg(etiquetaKg) : '—';
                        }
                        const sourceText =
                          item.hasLabel && item.hasScaleWeight
                            ? 'Etiq. + Bal.'
                            : item.hasScaleWeight
                              ? 'Bal. (kg)'
                              : item.hasLabel
                                ? 'Etiq.'
                                : '';
                        if (sourceText) {
                          detailText = detailText ? `${sourceText} · ${detailText}` : sourceText;
                        }
                      } else if (item.category === 'barra') {
                        qtySummary =
                          item.qtdBarras > 0 ? `${formatNumber(item.qtdBarras)} br` : 'Peso';
                        const etiquetaKg =
                          item.hasLabel || !item.hasScaleWeight ? item.kg : 0;
                        const scaleKg = item.hasScaleWeight ? item.scaleWeightKg : 0;
                        if (etiquetaKg > 0 && scaleKg > 0) {
                          weightDisplay = `${formatKg(etiquetaKg)} (Bal.: ${formatKg(scaleKg)})`;
                        } else if (scaleKg > 0) {
                          weightDisplay = formatKg(scaleKg);
                        } else {
                          weightDisplay = etiquetaKg > 0 ? formatKg(etiquetaKg) : '—';
                        }
                        const barraParts: string[] = [];
                        if (etiquetaKg > 0 && scaleKg > 0) {
                          barraParts.push('Etiq. + Bal.');
                        } else if (scaleKg > 0) {
                          barraParts.push('Bal. (kg)');
                        } else if (item.hasLabel || etiquetaKg > 0) {
                          barraParts.push('Etiq.');
                        }
                        if (item.labelCode) {
                          barraParts.push(`Cód.: ${item.labelCode}`);
                        }
                        const barraInfo = barraParts.join(' · ');
                        if (barraInfo) {
                          detailText = detailText ? `${barraInfo} · ${detailText}` : barraInfo;
                        }
                      } else if (item.category === 'tela_pop') {
                        qtySummary = `${formatNumber(item.unidades)} un`;
                        weightDisplay = '—';
                        const telaSpec = resolveTelaPopByCode(item.bitola);
                        if (telaSpec) {
                          const telaInfo = `${telaSpec.shortNome} · ${telaSpec.malha}`;
                          detailText = detailText ? `${telaInfo} · ${detailText}` : telaInfo;
                        }
                      } else if (item.category === 'outros_materiais') {
                        qtySummary = item.unidades > 0 ? `${formatNumber(item.unidades)} un` : '—';
                        if ((item.kgPorUnidade ?? 0) > 0) {
                          const unitText = `${formatNumber(item.kgPorUnidade ?? 0, 3)} kg/un`;
                          detailText = detailText ? `${unitText} · ${detailText}` : unitText;
                        }
                      } else if (item.category === 'arame') {
                        const m = getArameMetrics(item.unidades, item.kg, item.measurementMode);
                        weightDisplay = m.kg > 0 ? formatKg(m.kg) : '—';
                        if (m.isVariedCoil) {
                          qtySummary =
                            m.unidades > 0
                              ? `${formatNumber(m.unidades)} bob.`
                              : 'Bob.';
                          const wireInfo = `${item.wireType === 'liso' ? 'Liso' : 'Torc.'} · Bob. kg var.`;
                          detailText = detailText ? `${wireInfo} · ${detailText}` : wireInfo;
                        } else {
                          qtySummary =
                            m.unidades > 0
                              ? `${formatNumber(m.unidades)} un · ${formatArameBoxes(m.unidades)}`
                              : '—';
                          const wireInfo = item.wireType === 'liso' ? 'Liso' : 'Torc.';
                          detailText = detailText ? `${wireInfo} · ${detailText}` : wireInfo;
                        }
                      }

                      if (item.conferentes?.length) {
                        const info = `Conf.: ${item.conferentes.join(', ')}`;
                        detailText = detailText ? `${info} · ${detailText}` : info;
                      }
                      if (item.temConferenciaSemNome) detailText = `${detailText}${detailText ? ' · ' : ''}S/ resp.`;
                      if (item.category !== 'estribo' && item.notaFiscal?.trim()) {
                        const nfText = `NF ${item.notaFiscal.trim()}`;
                        detailText = detailText ? `${nfText} · ${detailText}` : nfText;
                      }

                      return (
                        <tr key={item.id} className="break-inside-avoid">
                          <td className="px-2.5 py-1.5 font-medium text-slate-900 border-r border-slate-200 whitespace-nowrap">
                            {catMeta.shortLabel}
                          </td>
                          <td className="px-2.5 py-1.5 font-mono-num text-slate-800 border-r border-slate-200 whitespace-nowrap">
                            {item.category === 'outros_materiais' ? (item.materialName || item.bitola) : item.bitola}
                          </td>
                          <td className="px-2.5 py-1.5 font-mono-num text-slate-700 border-r border-slate-200 whitespace-nowrap">
                            {qtySummary}
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-mono-num font-medium text-slate-900 border-r border-slate-200 whitespace-nowrap">
                            {weightDisplay}
                          </td>
                          <td className="px-2.5 py-1.5 text-slate-600">{detailText || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Minimal Sign-off Footer */}
          <footer className="pt-8 mt-8 border-t border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[11px] text-slate-600">
            <div>Resp.: {responsaveis.length ? responsaveis.join(', ') : '—'}{faltaResponsavel ? ' · Há itens s/ resp.' : ''}</div>
            <div>Data: ____ / ____ / ________</div>
          </footer>
        </div>
      </div>
    </div>
  );
}
