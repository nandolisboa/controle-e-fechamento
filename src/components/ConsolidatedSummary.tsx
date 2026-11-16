import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  compareBitolaAsc,
  compareNaturalAsc,
  consolidateInventoryItems,
} from '../lib/consolidation';
import {
  formatArameBoxes,
  formatKg,
  formatNumber,
  type InventoryItem,
  type MaterialCategory,
} from '../types/inventory';

type EstriboGroupMode = 'medida_bitola' | 'medida';

interface ConsolidatedSummaryProps {
  items: InventoryItem[];
  activeCategory: MaterialCategory | 'all';
}

export function ConsolidatedSummary({
  items,
  activeCategory,
}: ConsolidatedSummaryProps) {
  const [estriboMode, setEstriboMode] = useState<EstriboGroupMode>('medida_bitola');
  const [expanded, setExpanded] = useState(true);

  const summary = useMemo(() => consolidateInventoryItems(items), [items]);
  const outrosMateriais = useMemo(
    () => items.filter((item) => item.category === 'outros_materiais'),
    [items]
  );
  const outrosMateriaisTotalUn = outrosMateriais.reduce((sum, item) => sum + item.unidades, 0);
  const outrosMateriaisTotalKg = outrosMateriais.reduce((sum, item) => sum + item.kg, 0);

  const estriboByMedidaOnly = useMemo(() => {
    if (estriboMode !== 'medida') return [];
    const map = new Map<
      string,
      {
        key: string;
        medida: string;
        hasMedida: boolean;
        bitolas: Set<string>;
        lancamentos: number;
        qtdPecas: number;
        qtdPacotes: number;
        kg: number;
      }
    >();

    for (const row of summary.estribos) {
      const key = row.hasMedida ? row.medida.toLowerCase() : '__sem_medida__';
      let cur = map.get(key);
      if (!cur) {
        cur = {
          key,
          medida: row.medida,
          hasMedida: row.hasMedida,
          bitolas: new Set<string>(),
          lancamentos: 0,
          qtdPecas: 0,
          qtdPacotes: 0,
          kg: 0,
        };
        map.set(key, cur);
      }
      cur.bitolas.add(row.bitola);
      cur.lancamentos += row.lancamentos;
      cur.qtdPecas += row.qtdPecas;
      cur.qtdPacotes += row.qtdPacotes;
      cur.kg += row.kg;
    }

    return Array.from(map.values())
      .map((r) => ({
        ...r,
        bitolasList: Array.from(r.bitolas).sort(compareBitolaAsc),
      }))
      .sort((a, b) => {
        if (a.hasMedida !== b.hasMedida) return a.hasMedida ? -1 : 1;
        const mCmp = compareNaturalAsc(a.medida, b.medida);
        if (mCmp !== 0) return mCmp;
        return compareBitolaAsc(a.bitolasList[0] ?? '', b.bitolasList[0] ?? '');
      });
  }, [summary.estribos, estriboMode]);

  const showEstribo =
    (activeCategory === 'all' || activeCategory === 'estribo') &&
    summary.estribos.length > 0;
  const showBobina =
    (activeCategory === 'all' || activeCategory === 'bobina') &&
    summary.bobinas.length > 0;
  const showBarra =
    (activeCategory === 'all' || activeCategory === 'barra') &&
    summary.barras.length > 0;
  const showTela =
    (activeCategory === 'all' || activeCategory === 'tela_pop') &&
    summary.telas.length > 0;
  const showArame =
    (activeCategory === 'all' || activeCategory === 'arame') &&
    summary.arames.length > 0;
  const showOutrosMateriais =
    (activeCategory === 'all' || activeCategory === 'outros_materiais') &&
    outrosMateriais.length > 0;

  if (!showEstribo && !showBobina && !showBarra && !showTela && !showArame && !showOutrosMateriais) {
    return null;
  }

  const headerTitle =
    activeCategory === 'estribo'
      ? 'Resumo — Estribos'
      : activeCategory === 'bobina'
        ? 'Resumo — Bobinas'
        : activeCategory === 'barra'
          ? 'Resumo — Barras'
          : activeCategory === 'tela_pop'
            ? 'Resumo — Telas Pop'
            : activeCategory === 'arame'
              ? 'Resumo — Arames'
              : activeCategory === 'outros_materiais'
                ? 'Resumo — Outros'
                : 'Resumo Consolidado';

  const headerSubtitle =
    activeCategory === 'all'
      ? [
          summary.totalSemBalancaKg > 0
            ? `Peso: ${formatKg(summary.totalSemBalancaKg)}`
            : null,
          summary.totalBalancaKg > 0
            ? `Bal.: ${formatKg(summary.totalBalancaKg)}`
            : null,
          summary.telaTotalUn > 0 ? `${formatNumber(summary.telaTotalUn)} telas` : null,
          `${formatNumber(items.length)} lanç.`,
        ]
          .filter(Boolean)
          .join(' · ')
      : activeCategory === 'estribo'
        ? `${formatNumber(summary.estriboTotalPecas)} pçs · ${formatNumber(summary.estriboTotalPacotes)} pcts · ${formatKg(summary.estriboTotalKg)}`
        : activeCategory === 'bobina'
          ? [
              `${formatNumber(summary.bobinaTotalUn)} un`,
              summary.bobinaTotalEtiquetaKg > 0
                ? `Etiq.: ${formatKg(summary.bobinaTotalEtiquetaKg)}`
                : null,
              summary.bobinaTotalBalancaKg > 0
                ? `Bal.: ${formatKg(summary.bobinaTotalBalancaKg)}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')
          : activeCategory === 'barra'
            ? [
                summary.barraTotalQtd > 0 ? `${formatNumber(summary.barraTotalQtd)} br` : null,
                summary.barraTotalKg > 0 ? `Etiq.: ${formatKg(summary.barraTotalKg)}` : null,
                summary.barraTotalBalanca > 0
                  ? `Bal.: ${formatKg(summary.barraTotalBalanca)}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : activeCategory === 'tela_pop'
              ? `${formatNumber(summary.telaTotalUn)} un (${summary.telas.length} tipos)`
              : activeCategory === 'arame'
                ? `${formatKg(summary.arameTotalKg)} · ${formatNumber(summary.arameTotalLancamentos)} lanç.`
                : `${outrosMateriais.length} mat.${outrosMateriaisTotalUn > 0 ? ` · ${formatNumber(outrosMateriaisTotalUn)} un` : ''}${outrosMateriaisTotalKg > 0 ? ` · ${formatKg(outrosMateriaisTotalKg)}` : ''}`;

  return (
    <section
      aria-label={headerTitle}
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            {headerTitle}
          </h2>
          {headerSubtitle && (
            <p className="text-xs text-slate-500 mt-0.5 font-mono-num">
              {headerSubtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 no-print">
          {showEstribo && activeCategory === 'estribo' && (
            <div
              role="group"
              aria-label="Modo de agrupamento dos estribos"
              className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
            >
              <button
                type="button"
                onClick={() => setEstriboMode('medida_bitola')}
                className={`h-7 px-3 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  estriboMode === 'medida_bitola'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bitola + Med.
              </button>
              <button
                type="button"
                onClick={() => setEstriboMode('medida')}
                className={`h-7 px-3 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  estriboMode === 'medida'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Por Med.
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-600 cursor-pointer whitespace-nowrap"
          >
            <span>{expanded ? 'Recolher' : 'Expandir'}</span>
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="divide-y divide-slate-200">
          {/* 1. Estribos */}
          {showEstribo && (
            <div>
              {activeCategory === 'all' && (
                <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Estribo
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-mono-num">
                      {formatNumber(summary.estriboTotalPecas)} pçs ·{' '}
                      {formatNumber(summary.estriboTotalPacotes)} pcts ·{' '}
                      {formatKg(summary.estriboTotalKg)}
                    </span>
                    <div
                      role="group"
                      aria-label="Modo de agrupamento dos estribos"
                      className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 no-print"
                    >
                      <button
                        type="button"
                        onClick={() => setEstriboMode('medida_bitola')}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                          estriboMode === 'medida_bitola'
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Bitola + Med.
                      </button>
                      <button
                        type="button"
                        onClick={() => setEstriboMode('medida')}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                          estriboMode === 'medida'
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Só Med.
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {estriboMode === 'medida_bitola' ? (
                        <>
                          <th className="py-2 px-4">Bitola</th>
                          <th className="py-2 px-4">Medida</th>
                        </>
                      ) : (
                        <>
                          <th className="py-2 px-4">Medida</th>
                          <th className="py-2 px-4">Bitola(s)</th>
                        </>
                      )}
                      <th className="py-2 px-4 text-right">Lanç.</th>
                      <th className="py-2 px-4 text-right">Peças</th>
                      <th className="py-2 px-4 text-right">Pacotes</th>
                      <th className="py-2 px-4 text-right">Peso (kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {estriboMode === 'medida_bitola'
                      ? summary.estribos.map((row) => (
                          <tr key={row.key} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2 px-4 font-semibold text-slate-900 font-mono-num whitespace-nowrap">
                              {row.bitola}
                            </td>
                            <td className="py-2 px-4 font-medium whitespace-nowrap">
                              <span
                                className={
                                  row.hasMedida
                                    ? 'font-mono-num text-slate-900'
                                    : 'text-slate-400 italic'
                                }
                              >
                                {row.medida}
                              </span>
                            </td>
                            <td className="py-2 px-4 text-right font-mono-num text-slate-600 whitespace-nowrap">
                              {formatNumber(row.lancamentos)}
                            </td>
                            <td className="py-2 px-4 text-right font-mono-num font-medium text-slate-900 whitespace-nowrap">
                              {formatNumber(row.qtdPecas)}
                            </td>
                            <td className="py-2 px-4 text-right font-mono-num font-medium text-slate-900 whitespace-nowrap">
                              {formatNumber(row.qtdPacotes)}
                            </td>
                            <td className="py-2 px-4 text-right font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                              {formatKg(row.kg)}
                            </td>
                          </tr>
                        ))
                      : estriboByMedidaOnly.map((row) => (
                          <tr key={row.key} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2 px-4 font-medium whitespace-nowrap">
                              <span
                                className={
                                  row.hasMedida
                                    ? 'font-mono-num text-slate-900'
                                    : 'text-slate-400 italic'
                                }
                              >
                                {row.medida}
                              </span>
                            </td>
                            <td className="py-2 px-4 text-xs text-slate-600 font-mono-num whitespace-nowrap">
                              {row.bitolasList.join(' · ')}
                            </td>
                            <td className="py-2 px-4 text-right font-mono-num text-slate-600 whitespace-nowrap">
                              {formatNumber(row.lancamentos)}
                            </td>
                            <td className="py-2 px-4 text-right font-mono-num font-medium text-slate-900 whitespace-nowrap">
                              {formatNumber(row.qtdPecas)}
                            </td>
                            <td className="py-2 px-4 text-right font-mono-num font-medium text-slate-900 whitespace-nowrap">
                              {formatNumber(row.qtdPacotes)}
                            </td>
                            <td className="py-2 px-4 text-right font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                              {formatKg(row.kg)}
                            </td>
                          </tr>
                        ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-300 bg-slate-50/80 text-xs font-semibold text-slate-900">
                      <td colSpan={2} className="py-2 px-4">
                        Total
                      </td>
                      <td className="py-2 px-4 text-right font-mono-num">
                        {formatNumber(summary.estriboTotalLancamentos)}
                      </td>
                      <td className="py-2 px-4 text-right font-mono-num">
                        {formatNumber(summary.estriboTotalPecas)}
                      </td>
                      <td className="py-2 px-4 text-right font-mono-num">
                        {formatNumber(summary.estriboTotalPacotes)}
                      </td>
                      <td className="py-2 px-4 text-right font-mono-num">
                        {formatKg(summary.estriboTotalKg)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 2. Bobinas */}
          {showBobina && (
            <div>
              {activeCategory === 'all' && (
                <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Bobinas
                  </span>
                  <span className="text-xs text-slate-500 font-mono-num">
                    {[
                      `${formatNumber(summary.bobinaTotalUn)} un`,
                      summary.bobinaTotalEtiquetaKg > 0
                        ? `Etiq.: ${formatKg(summary.bobinaTotalEtiquetaKg)}`
                        : null,
                      summary.bobinaTotalBalancaKg > 0
                        ? `Bal.: ${formatKg(summary.bobinaTotalBalancaKg)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-2 px-4">Bitola</th>
                      <th className="py-2 px-4 text-right">Lanç.</th>
                      <th className="py-2 px-4 text-right">Un.</th>
                      <th className="py-2 px-4 text-right">Etiq. (kg)</th>
                      <th className="py-2 px-4 text-right">Bal. (kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {summary.bobinas.map((row) => (
                      <tr key={row.key} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-4 font-semibold text-slate-900 font-mono-num whitespace-nowrap">
                          {row.bitola}
                        </td>
                        <td className="py-2 px-4 text-right font-mono-num text-slate-600 whitespace-nowrap">
                          {formatNumber(row.lancamentos)}
                        </td>
                        <td className="py-2 px-4 text-right font-mono-num font-medium text-slate-900 whitespace-nowrap">
                          {formatNumber(row.unidades)} un
                        </td>
                        <td className="py-2 px-4 text-right font-mono-num font-semibold text-emerald-700 whitespace-nowrap">
                          {row.etiquetaKg > 0 ? formatKg(row.etiquetaKg) : '—'}
                        </td>
                        <td className="py-2 px-4 text-right font-mono-num font-semibold text-orange-700 whitespace-nowrap">
                          {row.scaleWeightKg > 0 ? formatKg(row.scaleWeightKg) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-300 bg-slate-50/80 text-xs font-semibold text-slate-900">
                      <td className="py-2 px-4">Total</td>
                      <td className="py-2 px-4 text-right font-mono-num">
                        {formatNumber(summary.bobinaTotalLancamentos)}
                      </td>
                      <td className="py-2 px-4 text-right font-mono-num">
                        {formatNumber(summary.bobinaTotalUn)} un
                      </td>
                      <td className="py-2 px-4 text-right font-mono-num text-emerald-700">
                        {summary.bobinaTotalEtiquetaKg > 0
                          ? formatKg(summary.bobinaTotalEtiquetaKg)
                          : '—'}
                      </td>
                      <td className="py-2 px-4 text-right font-mono-num text-orange-700">
                        {summary.bobinaTotalBalancaKg > 0
                          ? formatKg(summary.bobinaTotalBalancaKg)
                          : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 3. Barras */}
          {showBarra && (
            <div>
              {activeCategory === 'all' && (
                <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Barras
                  </span>
                  <span className="text-xs text-slate-500 font-mono-num">
                    {[
                      summary.barraTotalQtd > 0 ? `${formatNumber(summary.barraTotalQtd)} br` : null,
                      summary.barraTotalKg > 0 ? `Etiq.: ${formatKg(summary.barraTotalKg)}` : null,
                      summary.barraTotalBalanca > 0
                        ? `Bal.: ${formatKg(summary.barraTotalBalanca)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-2 px-4">Bitola</th>
                      <th className="py-2 px-4 text-right">Lanç.</th>
                      <th className="py-2 px-4 text-right">Barras</th>
                      <th className="py-2 px-4 text-right">Etiq. (kg)</th>
                      <th className="py-2 px-4 text-right">Bal. (kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {summary.barras.map((row) => (
                      <tr key={row.key} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-4 font-semibold text-slate-900 font-mono-num whitespace-nowrap">
                          {row.bitola}
                        </td>
                        <td className="py-2 px-4 text-right font-mono-num text-slate-600 whitespace-nowrap">
                          {formatNumber(row.lancamentos)}
                        </td>
                        <td className="py-2 px-4 text-right font-mono-num font-medium text-slate-900 whitespace-nowrap">
                          {row.qtdBarras > 0 ? formatNumber(row.qtdBarras) : '—'}
                        </td>
                        <td className="py-2 px-4 text-right font-mono-num font-semibold text-emerald-700 whitespace-nowrap">
                          {row.kg > 0 ? formatKg(row.kg) : '—'}
                        </td>
                        <td className="py-2 px-4 text-right font-mono-num font-semibold text-orange-700 whitespace-nowrap">
                          {row.scaleWeightKg > 0 ? formatKg(row.scaleWeightKg) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-300 bg-slate-50/80 text-xs font-semibold text-slate-900">
                      <td className="py-2 px-4">Total</td>
                      <td className="py-2 px-4 text-right font-mono-num">
                        {formatNumber(summary.barraTotalLancamentos)}
                      </td>
                      <td className="py-2 px-4 text-right font-mono-num">
                        {summary.barraTotalQtd > 0 ? formatNumber(summary.barraTotalQtd) : '—'}
                      </td>
                      <td className="py-2 px-4 text-right font-mono-num text-emerald-700">
                        {summary.barraTotalKg > 0 ? formatKg(summary.barraTotalKg) : '—'}
                      </td>
                      <td className="py-2 px-4 text-right font-mono-num text-orange-700">
                        {summary.barraTotalBalanca > 0 ? formatKg(summary.barraTotalBalanca) : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 4. Telas Pop */}
          {showTela && (
            <div>
              {activeCategory === 'all' && (
                <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Telas Pop
                  </span>
                  <span className="text-xs text-slate-500 font-mono-num">
                    {formatNumber(summary.telaTotalUn)} un
                  </span>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-2 px-4">Cód. / Fio</th>
                      <th className="py-2 px-4">Espec.</th>
                      <th className="py-2 px-4 text-right">Lanç.</th>
                      <th className="py-2 px-4 text-right">Qtd.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {summary.telas.map((row) => (
                      <tr key={row.key} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-4 font-semibold text-slate-900 font-mono-num whitespace-nowrap">
                          {row.code}
                        </td>
                        <td className="py-2 px-4 text-slate-700 whitespace-nowrap">
                          {row.specText}
                        </td>
                        <td className="py-2 px-4 text-right font-mono-num text-slate-600 whitespace-nowrap">
                          {formatNumber(row.lancamentos)}
                        </td>
                        <td className="py-2 px-4 text-right font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                          {formatNumber(row.unidades)} un
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-300 bg-slate-50/80 text-xs font-semibold text-slate-900">
                      <td colSpan={2} className="py-2 px-4">
                        Total
                      </td>
                      <td className="py-2 px-4 text-right font-mono-num">
                        {formatNumber(summary.telaTotalLancamentos)}
                      </td>
                      <td className="py-2 px-4 text-right font-mono-num">
                        {formatNumber(summary.telaTotalUn)} un
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 5. Arames */}
          {showArame && (
            <div>
              {activeCategory === 'all' && (
                <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Arames
                  </span>
                  <span className="text-xs text-slate-500 font-mono-num">
                    {formatKg(summary.arameTotalKg)}
                  </span>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-2 px-4">Tipo / Bitola</th>
                      <th className="py-2 px-4">Emb.</th>
                      <th className="py-2 px-4 text-right">Lanç.</th>
                      <th className="py-2 px-4 text-right">Qtd.</th>
                      <th className="py-2 px-4 text-right">Peso (kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {summary.arames.map((row) => (
                      <tr key={row.key} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          {row.wireLabel} · <span className="font-mono-num">{row.bitola}</span>
                        </td>
                        <td className="py-2 px-4 font-mono-num text-slate-700 whitespace-nowrap">
                          {row.isVariedCoil
                            ? 'Bob. kg var.'
                            : formatArameBoxes(row.unidades)}
                        </td>
                        <td className="py-2 px-4 text-right font-mono-num text-slate-600 whitespace-nowrap">
                          {formatNumber(row.lancamentos)}
                        </td>
                        <td className="py-2 px-4 text-right font-mono-num font-medium text-slate-900 whitespace-nowrap">
                          {formatNumber(row.unidades)}{' '}
                          {row.isVariedCoil ? 'bob.' : 'un'}
                        </td>
                        <td className="py-2 px-4 text-right font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                          {formatKg(row.kg)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-300 bg-slate-50/80 text-xs font-semibold text-slate-900">
                      <td colSpan={2} className="py-2 px-4">
                        Total
                      </td>
                      <td className="py-2 px-4 text-right font-mono-num">
                        {formatNumber(summary.arameTotalLancamentos)}
                      </td>
                      <td className="py-2 px-4 text-right font-mono-num">
                        {[
                          summary.arameTotalBoxUn > 0
                            ? `${formatNumber(summary.arameTotalBoxUn)} un`
                            : null,
                          summary.arameTotalCoilUn > 0
                            ? `${formatNumber(summary.arameTotalCoilUn)} bob.`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' + ') || '—'}
                      </td>
                      <td className="py-2 px-4 text-right font-mono-num">
                        {formatKg(summary.arameTotalKg)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Outros materiais */}
          {showOutrosMateriais && (
            <div>
              {activeCategory === 'all' && (
                <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">Outros</span>
                  <span className="text-xs text-slate-500 font-mono-num">
                    {outrosMateriais.length} mat.
                    {outrosMateriaisTotalUn > 0 ? ` · ${formatNumber(outrosMateriaisTotalUn)} un` : ''}
                    {outrosMateriaisTotalKg > 0 ? ` · ${formatKg(outrosMateriaisTotalKg)}` : ''}
                  </span>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead><tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-2 px-4">Material</th><th className="py-2 px-4 text-right">Lanç.</th><th className="py-2 px-4 text-right">Qtd.</th><th className="py-2 px-4 text-right">Kg/un</th><th className="py-2 px-4 text-right">Peso (kg)</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {outrosMateriais.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-4 font-semibold text-slate-900">{item.materialName || item.bitola}</td>
                        <td className="py-2 px-4 text-right font-mono-num text-slate-600">1</td>
                        <td className="py-2 px-4 text-right font-mono-num">{item.unidades > 0 ? formatNumber(item.unidades) : '—'}</td>
                        <td className="py-2 px-4 text-right font-mono-num">{(item.kgPorUnidade ?? 0) > 0 ? `${formatNumber(item.kgPorUnidade ?? 0, 3)} kg` : '—'}</td>
                        <td className="py-2 px-4 text-right font-mono-num font-semibold">{item.kg > 0 ? formatKg(item.kg) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="border-t border-slate-300 bg-slate-50/80 text-xs font-semibold text-slate-900">
                    <td className="py-2 px-4">Total</td><td className="py-2 px-4 text-right font-mono-num">{outrosMateriais.length}</td><td className="py-2 px-4 text-right font-mono-num">{outrosMateriaisTotalUn > 0 ? formatNumber(outrosMateriaisTotalUn) : '—'}</td><td /><td className="py-2 px-4 text-right font-mono-num">{outrosMateriaisTotalKg > 0 ? formatKg(outrosMateriaisTotalKg) : '—'}</td>
                  </tr></tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Separated Grand Totals Bar when viewing all categories */}
          {activeCategory === 'all' &&
            (summary.totalSemBalancaKg > 0 || summary.totalBalancaKg > 0) && (
              <div className="px-4 sm:px-5 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4 text-xs">
                <span className="font-semibold uppercase tracking-wider">
                  Totais
                </span>
                <div className="flex flex-wrap items-center gap-5 font-mono-num">
                  {summary.totalSemBalancaKg > 0 && (
                    <div>
                      <span className="text-slate-400 mr-1.5">
                        Etiq./Lote:
                      </span>
                      <span className="text-sm font-bold text-white">
                        {formatKg(summary.totalSemBalancaKg)}
                      </span>
                    </div>
                  )}
                  {summary.totalBalancaKg > 0 && (
                    <div>
                      <span className="text-orange-300 mr-1.5">
                        Bal.:
                      </span>
                      <span className="text-sm font-bold text-orange-300">
                        {formatKg(summary.totalBalancaKg)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>
      )}
    </section>
  );
}
