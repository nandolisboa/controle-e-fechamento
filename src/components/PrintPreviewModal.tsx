import { useEffect, useMemo, useState } from 'react';
import { Printer, X } from 'lucide-react';
import {
  CATEGORY_MAP,
  formatArameBoxes,
  formatKg,
  formatMonthLabel,
  formatNumber,
  getArameMetrics,
  type InventoryItem,
  type MaterialCategory,
  resolveTelaPopByCode,
} from '../types/inventory';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthKey: string;
  isLocked: boolean;
  monthNotes: string;
  activeCategory: MaterialCategory | 'all';
  allMonthItems: InventoryItem[];
  filteredItems: InventoryItem[];
  hasActiveFilters: boolean;
}

const naturalCollator = new Intl.Collator('pt-BR', {
  numeric: true,
  sensitivity: 'base',
});

function parseBitolaNumeric(bitola: string): number {
  const match = bitola.replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  if (!match) return Number.POSITIVE_INFINITY;
  const num = Number.parseFloat(match[1]);
  return Number.isNaN(num) ? Number.POSITIVE_INFINITY : num;
}

function compareBitolaAsc(a: string, b: string): number {
  const numA = parseBitolaNumeric(a);
  const numB = parseBitolaNumeric(b);
  if (numA !== numB) return numA - numB;
  return naturalCollator.compare(a, b);
}

export function PrintPreviewModal({
  isOpen,
  onClose,
  monthKey,
  isLocked,
  monthNotes,
  activeCategory,
  allMonthItems,
  filteredItems,
  hasActiveFilters,
}: PrintPreviewModalProps) {
  const [scope, setScope] = useState<'current' | 'all'>('current');
  const [showEstriboSummary, setShowEstriboSummary] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setScope('current');
    setShowEstriboSummary(true);
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

  const scopeTitle =
    effectiveCategory === 'all'
      ? scope === 'current' && hasActiveFilters
        ? 'Visão Geral (filtrada)'
        : 'Mês completo (todas as categorias)'
      : CATEGORY_MAP[effectiveCategory].label;

  const estriboRows = useMemo(() => {
    const estribos = itemsToPrint.filter((item) => item.category === 'estribo');
    const map = new Map<
      string,
      {
        key: string;
        bitola: string;
        medida: string;
        qtdPecas: number;
        qtdPacotes: number;
        kg: number;
      }
    >();

    for (const item of estribos) {
      const bitola = item.bitola.trim() || '—';
      const medida = item.medida.trim().replace(/\s+/g, ' ') || 'Sem medida';
      const key = `${bitola.toLowerCase()}::${medida.toLowerCase()}`;
      const existing = map.get(key);
      if (existing) {
        existing.qtdPecas += item.qtdPecas;
        existing.qtdPacotes += item.qtdPacotes;
        existing.kg += item.kg;
      } else {
        map.set(key, {
          key,
          bitola,
          medida,
          qtdPecas: item.qtdPecas,
          qtdPacotes: item.qtdPacotes,
          kg: item.kg,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const bitolaCmp = compareBitolaAsc(a.bitola, b.bitola);
      if (bitolaCmp !== 0) return bitolaCmp;
      return naturalCollator.compare(a.medida, b.medida);
    });
  }, [itemsToPrint]);

  const totals = useMemo(() => {
    let estriboKg = 0;
    let estriboPecas = 0;
    let estriboPacotes = 0;
    let bobinaUn = 0;
    let bobinaKg = 0;
    let barraQtd = 0;
    let barraKg = 0;
    let barraBalancaKg = 0;
    let telaUn = 0;
    let arameBoxUn = 0;
    let arameCoilUn = 0;
    let arameKg = 0;

    for (const item of itemsToPrint) {
      if (item.category === 'estribo') {
        estriboKg += item.kg;
        estriboPecas += item.qtdPecas;
        estriboPacotes += item.qtdPacotes;
      } else if (item.category === 'bobina') {
        bobinaUn += item.unidades;
        bobinaKg += item.kg;
      } else if (item.category === 'barra') {
        barraQtd += item.qtdBarras;
        barraKg += item.kg;
        if (item.hasScaleWeight) barraBalancaKg += item.scaleWeightKg;
      } else if (item.category === 'tela_pop') {
        telaUn += item.unidades;
      } else if (item.category === 'arame') {
        const m = getArameMetrics(item.unidades, item.kg, item.measurementMode);
        arameKg += m.kg;
        if (m.isVariedCoil) {
          arameCoilUn += m.unidades > 0 ? m.unidades : 1;
        } else {
          arameBoxUn += m.unidades;
        }
      }
    }

    return {
      estriboKg,
      estriboPecas,
      estriboPacotes,
      bobinaUn,
      bobinaKg,
      barraQtd,
      barraKg,
      barraBalancaKg,
      telaUn,
      arameBoxUn,
      arameCoilUn,
      arameKg,
    };
  }, [itemsToPrint]);

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
            Visualização antes da impressão
          </h2>
          <p className="text-xs text-slate-500">
            Confira o documento abaixo antes de enviar para a impressora ({itemsToPrint.length}{' '}
            {itemsToPrint.length === 1 ? 'registro' : 'registros'})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
                Filtro atual ({filteredItems.length})
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
                Mês completo ({allMonthItems.length})
              </button>
            </div>
          )}

          {estriboRows.length > 0 && (
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={showEstriboSummary}
                onChange={(e) => setShowEstriboSummary(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-orange-600 focus:ring-orange-600"
              />
              <span>Incluir resumo de estribos</span>
            </label>
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
            <span>Imprimir agora</span>
          </button>
        </div>
      </div>

      {/* Scrollable A4 Preview Stage */}
      <div className="flex-1 overflow-y-auto bg-slate-200/90 p-4 sm:p-8 print:bg-white print:p-0 print:overflow-visible">
        <div className="print-sheet bg-white max-w-[210mm] min-h-[260mm] mx-auto shadow-lg border border-slate-300 p-6 sm:p-10 text-slate-900 space-y-6 print:shadow-none print:border-0 print:p-0 print:max-w-none print:min-h-0">
          {/* Document Header */}
          <div className="pb-4 border-b-2 border-slate-900 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                AçoGestão · Controle de Estoque Mensal
              </div>
              <h1 className="font-display text-2xl font-bold text-slate-900 mt-0.5">
                {formatMonthLabel(monthKey)}
              </h1>
              <div className="text-xs text-slate-600 mt-1">
                Escopo: <span className="font-medium text-slate-900">{scopeTitle}</span>
              </div>
            </div>
            <div className="text-left sm:text-right text-xs text-slate-600 font-mono-num space-y-0.5">
              <div>Situação: {isLocked ? 'Mês fechado' : 'Em aberto'}</div>
              <div>Emitido em: {generatedAt}</div>
              <div>Total de lançamentos: {formatNumber(itemsToPrint.length)}</div>
            </div>
          </div>

          {monthNotes.trim() && (
            <div className="px-3.5 py-2.5 border border-slate-200 bg-slate-50 text-xs text-slate-700">
              <span className="font-semibold text-slate-900">Observações do mês:</span>{' '}
              {monthNotes}
            </div>
          )}

          {/* Compact Totals Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border border-slate-300 p-3 bg-slate-50/60">
            <div>
              <div className="text-[11px] text-slate-500">Estribos</div>
              <div className="font-mono-num text-sm font-semibold text-slate-900">
                {formatKg(totals.estriboKg)}
              </div>
              <div className="font-mono-num text-[11px] text-slate-600">
                {formatNumber(totals.estriboPecas)} pçs · {formatNumber(totals.estriboPacotes)} pcts
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Bobinas</div>
              <div className="font-mono-num text-sm font-semibold text-slate-900">
                {formatKg(totals.bobinaKg)}
              </div>
              <div className="font-mono-num text-[11px] text-slate-600">
                {formatNumber(totals.bobinaUn)} un
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Barras</div>
              <div className="font-mono-num text-sm font-semibold text-slate-900">
                {formatKg(totals.barraKg > 0 ? totals.barraKg : totals.barraBalancaKg)}
              </div>
              <div className="font-mono-num text-[11px] text-slate-600">
                {formatNumber(totals.barraQtd)} br · Bal. {formatKg(totals.barraBalancaKg)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Telas Pop &amp; Arames</div>
              <div className="font-mono-num text-sm font-semibold text-slate-900">
                {formatNumber(totals.telaUn)} telas · {formatKg(totals.arameKg)}
              </div>
              <div className="font-mono-num text-[11px] text-slate-600">
                {totals.arameBoxUn > 0 ? formatArameBoxes(totals.arameBoxUn) : '0 cx'}
                {totals.arameCoilUn > 0 ? ` · ${formatNumber(totals.arameCoilUn)} bob.` : ''}
              </div>
            </div>
          </div>

          {/* Estribo Summary by Bitola & Medida */}
          {showEstriboSummary && estriboRows.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Resumo de Estribos por Bitola e Medida
              </h3>
              <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-700">
                    <th className="px-3 py-2 border-r border-slate-300">Bitola</th>
                    <th className="px-3 py-2 border-r border-slate-300">Medida</th>
                    <th className="px-3 py-2 text-right border-r border-slate-300">Qtd. Peças</th>
                    <th className="px-3 py-2 text-right border-r border-slate-300">Qtd. Pacotes</th>
                    <th className="px-3 py-2 text-right">Peso Total (Kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {estriboRows.map((row) => (
                    <tr key={row.key} className="break-inside-avoid">
                      <td className="px-3 py-1.5 font-mono-num font-medium border-r border-slate-200">
                        {row.bitola}
                      </td>
                      <td className="px-3 py-1.5 font-mono-num border-r border-slate-200">
                        {row.medida}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono-num border-r border-slate-200">
                        {formatNumber(row.qtdPecas)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono-num border-r border-slate-200">
                        {formatNumber(row.qtdPacotes)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono-num font-medium">
                        {formatKg(row.kg)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Main Items Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              {effectiveCategory === 'all'
                ? 'Relação completa de materiais'
                : `Relação de ${CATEGORY_MAP[effectiveCategory].label}`}
            </h3>

            {itemsToPrint.length === 0 ? (
              <div className="p-6 border border-slate-200 text-center text-xs text-slate-500">
                Nenhum item para exibir neste escopo.
              </div>
            ) : (
              <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-700">
                    <th className="px-2.5 py-2 border-r border-slate-300">Categoria</th>
                    <th className="px-2.5 py-2 border-r border-slate-300">Bitola / Código</th>
                    <th className="px-2.5 py-2 border-r border-slate-300">Quantidades</th>
                    <th className="px-2.5 py-2 text-right border-r border-slate-300">Peso / Balança</th>
                    <th className="px-2.5 py-2">Detalhes / Observações</th>
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
                        const med = `Medida: ${item.medida}`;
                        detailText = detailText ? `${med} · ${detailText}` : med;
                      }
                    } else if (item.category === 'bobina') {
                      qtySummary = `${formatNumber(item.unidades)} un`;
                    } else if (item.category === 'barra') {
                      qtySummary =
                        item.qtdBarras > 0 ? `${formatNumber(item.qtdBarras)} barras` : 'Por peso';
                      if (item.hasScaleWeight) {
                        weightDisplay =
                          item.kg > 0
                            ? `${formatKg(item.kg)} (Bal.: ${formatKg(item.scaleWeightKg)})`
                            : `Bal.: ${formatKg(item.scaleWeightKg)}`;
                      }
                      const labelText = item.hasLabel
                        ? `Etiqueta${item.labelCode ? `: ${item.labelCode}` : ''}`
                        : 'Sem etiqueta';
                      detailText = detailText ? `${labelText} · ${detailText}` : labelText;
                    } else if (item.category === 'tela_pop') {
                      qtySummary = `${formatNumber(item.unidades)} un`;
                      weightDisplay = '—';
                      const telaSpec = resolveTelaPopByCode(item.bitola);
                      if (telaSpec) {
                        const telaInfo = `${telaSpec.nome} · Malha ${telaSpec.malha}`;
                        detailText = detailText ? `${telaInfo} · ${detailText}` : telaInfo;
                      }
                    } else if (item.category === 'arame') {
                      const m = getArameMetrics(item.unidades, item.kg, item.measurementMode);
                      weightDisplay = m.kg > 0 ? formatKg(m.kg) : '—';
                      if (m.isVariedCoil) {
                        qtySummary =
                          m.unidades > 0
                            ? `${formatNumber(m.unidades)} ${m.unidades === 1 ? 'bobina' : 'bobinas'}`
                            : 'Bobina';
                        const wireInfo = `${item.wireType === 'liso' ? 'Liso' : 'Torcido'} · Bobina (Kg variado)`;
                        detailText = detailText ? `${wireInfo} · ${detailText}` : wireInfo;
                      } else {
                        qtySummary =
                          m.unidades > 0
                            ? `${formatNumber(m.unidades)} un · ${formatArameBoxes(m.unidades)}`
                            : '—';
                        const wireInfo = item.wireType === 'liso' ? 'Arame Liso' : 'Arame Torcido';
                        detailText = detailText ? `${wireInfo} · ${detailText}` : wireInfo;
                      }
                    }

                    return (
                      <tr key={item.id} className="break-inside-avoid">
                        <td className="px-2.5 py-1.5 font-medium text-slate-900 border-r border-slate-200 whitespace-nowrap">
                          {catMeta.label}
                        </td>
                        <td className="px-2.5 py-1.5 font-mono-num text-slate-800 border-r border-slate-200 whitespace-nowrap">
                          {item.bitola}
                        </td>
                        <td className="px-2.5 py-1.5 font-mono-num text-slate-700 border-r border-slate-200 whitespace-nowrap">
                          {qtySummary}
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-mono-num font-medium text-slate-900 border-r border-slate-200 whitespace-nowrap">
                          {weightDisplay}
                        </td>
                        <td className="px-2.5 py-1.5 text-slate-600">
                          {detailText || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Printable Sign-off Footer */}
          <div className="pt-8 mt-6 border-t border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-600">
            <div>
              Conferido por: ________________________________________
            </div>
            <div>Data da conferência: ____ / ____ / ________</div>
          </div>
        </div>
      </div>
    </div>
  );
}
