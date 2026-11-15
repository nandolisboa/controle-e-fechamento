import { useMemo, useState } from 'react';
import { formatKg, formatNumber, type InventoryItem } from '../types/inventory';

type GroupMode = 'medida_bitola' | 'medida';

interface EstriboSummaryByMedidaProps {
  items: InventoryItem[];
}

interface EstriboGroupRow {
  key: string;
  medidaLabel: string;
  hasMedida: boolean;
  bitolas: string[];
  lancamentos: number;
  qtdPecas: number;
  qtdPacotes: number;
  kg: number;
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
  if (numA !== numB) {
    return numA - numB;
  }
  return naturalCollator.compare(a, b);
}

export function EstriboSummaryByMedida({ items }: EstriboSummaryByMedidaProps) {
  const [groupMode, setGroupMode] = useState<GroupMode>('medida_bitola');

  const estriboItems = useMemo(
    () => items.filter((item) => item.category === 'estribo'),
    [items]
  );

  const { rows, totalLancamentos, distinctMedidasCount, distinctBitolasCount } = useMemo(() => {
    const groupMap = new Map<string, EstriboGroupRow>();
    const bitolaSets = new Map<string, Set<string>>();
    const distinctMedidas = new Set<string>();
    const distinctBitolas = new Set<string>();

    for (const item of estriboItems) {
      const cleanedMedida = item.medida.trim().replace(/\s+/g, ' ');
      const hasMedida = cleanedMedida.length > 0;
      const medidaKey = hasMedida ? cleanedMedida.toLowerCase() : '__sem_medida__';
      const medidaLabel = hasMedida ? cleanedMedida : 'Sem medida';
      const cleanedBitola = item.bitola.trim() || '—';

      if (hasMedida) {
        distinctMedidas.add(medidaKey);
      }
      if (cleanedBitola !== '—') {
        distinctBitolas.add(cleanedBitola.toLowerCase());
      }

      const groupKey =
        groupMode === 'medida'
          ? medidaKey
          : `${cleanedBitola.toLowerCase()}__${medidaKey}`;

      let group = groupMap.get(groupKey);
      if (!group) {
        group = {
          key: groupKey,
          medidaLabel,
          hasMedida,
          bitolas: [],
          lancamentos: 0,
          qtdPecas: 0,
          qtdPacotes: 0,
          kg: 0,
        };
        groupMap.set(groupKey, group);
        bitolaSets.set(groupKey, new Set<string>());
      }

      const bSet = bitolaSets.get(groupKey)!;
      bSet.add(cleanedBitola);

      group.lancamentos += 1;
      group.qtdPecas += item.qtdPecas;
      group.qtdPacotes += item.qtdPacotes;
      group.kg += item.kg;
    }

    const assembledRows = Array.from(groupMap.values()).map((row) => ({
      ...row,
      bitolas: Array.from(bitolaSets.get(row.key) ?? []).sort(compareBitolaAsc),
    }));

    assembledRows.sort((a, b) => {
      if (groupMode === 'medida_bitola') {
        const bitolaCmp = compareBitolaAsc(a.bitolas[0] ?? '', b.bitolas[0] ?? '');
        if (bitolaCmp !== 0) return bitolaCmp;
        if (a.hasMedida !== b.hasMedida) {
          return a.hasMedida ? -1 : 1;
        }
        return naturalCollator.compare(a.medidaLabel, b.medidaLabel);
      }

      if (a.hasMedida !== b.hasMedida) {
        return a.hasMedida ? -1 : 1;
      }
      const medidaCmp = naturalCollator.compare(a.medidaLabel, b.medidaLabel);
      if (medidaCmp !== 0) return medidaCmp;
      return compareBitolaAsc(a.bitolas[0] ?? '', b.bitolas[0] ?? '');
    });

    return {
      rows: assembledRows,
      totalLancamentos: estriboItems.length,
      distinctMedidasCount: distinctMedidas.size,
      distinctBitolasCount: distinctBitolas.size,
    };
  }, [estriboItems, groupMode]);

  if (estriboItems.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Soma de estribos separada por bitola e medida"
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Soma de Estribos por Bitola e Medida
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-mono-num">
            {formatNumber(distinctBitolasCount)}{' '}
            {distinctBitolasCount === 1 ? 'bitola' : 'bitolas'} ·{' '}
            {formatNumber(distinctMedidasCount)}{' '}
            {distinctMedidasCount === 1 ? 'medida' : 'medidas'} ·{' '}
            {formatNumber(totalLancamentos)}{' '}
            {totalLancamentos === 1 ? 'lançamento' : 'lançamentos'}
          </p>
        </div>

        <div
          role="group"
          aria-label="Modo de agrupamento dos estribos"
          className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 no-print"
        >
          <button
            type="button"
            onClick={() => setGroupMode('medida_bitola')}
            className={`h-7 px-3 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
              groupMode === 'medida_bitola'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Por Bitola e Medida
          </button>
          <button
            type="button"
            onClick={() => setGroupMode('medida')}
            className={`h-7 px-3 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
              groupMode === 'medida'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Por Medida
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {groupMode === 'medida_bitola' ? (
                <>
                  <th className="py-2.5 px-4">Bitola</th>
                  <th className="py-2.5 px-4">Medida</th>
                </>
              ) : (
                <>
                  <th className="py-2.5 px-4">Medida</th>
                  <th className="py-2.5 px-4">Bitola(s)</th>
                </>
              )}
              <th className="py-2.5 px-4 text-right">Lançamentos</th>
              <th className="py-2.5 px-4 text-right">Qtd. Peças</th>
              <th className="py-2.5 px-4 text-right">Qtd. Pacotes</th>
              <th className="py-2.5 px-4 text-right">Peso (Kg)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {rows.map((row) => (
              <tr key={row.key} className="hover:bg-slate-50/70 transition-colors">
                {groupMode === 'medida_bitola' ? (
                  <>
                    <td className="py-2.5 px-4 font-semibold text-slate-900 font-mono-num whitespace-nowrap">
                      {row.bitolas[0]}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                      <span
                        className={
                          row.hasMedida ? 'font-mono-num text-slate-900' : 'text-slate-400 italic'
                        }
                      >
                        {row.medidaLabel}
                      </span>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                      <span
                        className={
                          row.hasMedida ? 'font-mono-num text-slate-900' : 'text-slate-400 italic'
                        }
                      >
                        {row.medidaLabel}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-600 font-mono-num whitespace-nowrap">
                      {row.bitolas.join(' · ')}
                    </td>
                  </>
                )}
                <td className="py-2.5 px-4 text-right font-mono-num text-slate-600 whitespace-nowrap">
                  {formatNumber(row.lancamentos)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono-num font-medium text-slate-900 whitespace-nowrap">
                  {formatNumber(row.qtdPecas)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono-num font-medium text-slate-900 whitespace-nowrap">
                  {formatNumber(row.qtdPacotes)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-slate-900 whitespace-nowrap">
                  {formatKg(row.kg)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
