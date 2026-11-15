import {
  formatArameBoxes,
  formatKg,
  formatNumber,
  getArameMetrics,
  type InventoryItem,
} from '../types/inventory';

interface SummaryStripProps {
  items: InventoryItem[];
}

export function SummaryStrip({ items }: SummaryStripProps) {
  let estriboPecas = 0;
  let estriboPacotes = 0;
  let estriboKg = 0;
  const estriboMedidas = new Set<string>();

  let bobinaUnidades = 0;
  let bobinaKg = 0;

  let barraQtd = 0;
  let barraKg = 0;
  let barraBalancaKg = 0;
  let barraComEtiqueta = 0;
  let barraTotalItens = 0;

  let telaPopQtd = 0;
  let telaPopItens = 0;

  let arameBoxUnidades = 0;
  let arameCoilCount = 0;
  let arameTotalKg = 0;

  for (const item of items) {
    if (item.category === 'estribo') {
      estriboPecas += item.qtdPecas;
      estriboPacotes += item.qtdPacotes;
      estriboKg += item.kg;
      const normalizedMedida = item.medida.trim().replace(/\s+/g, ' ').toLowerCase();
      if (normalizedMedida) {
        estriboMedidas.add(normalizedMedida);
      }
    } else if (item.category === 'bobina') {
      bobinaUnidades += item.unidades;
      bobinaKg += item.kg;
    } else if (item.category === 'barra') {
      barraTotalItens += 1;
      barraQtd += item.qtdBarras;
      barraKg += item.kg;
      if (item.hasScaleWeight) {
        barraBalancaKg += item.scaleWeightKg;
      }
      if (item.hasLabel) {
        barraComEtiqueta += 1;
      }
    } else if (item.category === 'tela_pop') {
      telaPopItens += 1;
      telaPopQtd += item.unidades;
    } else if (item.category === 'arame') {
      const metrics = getArameMetrics(item.unidades, item.kg, item.measurementMode);
      arameTotalKg += metrics.kg;
      if (metrics.isVariedCoil) {
        arameCoilCount += metrics.unidades > 0 ? metrics.unidades : 1;
      } else {
        arameBoxUnidades += metrics.unidades;
      }
    }
  }

  return (
    <section
      aria-label="Resumo do estoque no mês"
      className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200"
    >

      <div className="p-4 sm:p-5">
        <div className="text-xs font-medium text-slate-500">Estribo</div>
        <div className="mt-1.5 font-mono-num text-xl font-semibold text-slate-900 tracking-tight">
          {formatKg(estriboKg)}
        </div>
        <div className="mt-1.5 text-xs text-slate-600 font-mono-num">
          {estriboMedidas.size > 0
            ? `${formatNumber(estriboMedidas.size)} ${estriboMedidas.size === 1 ? 'medida' : 'medidas'} · `
            : ''}
          {formatNumber(estriboPecas)} pçs · {formatNumber(estriboPacotes)} pcts
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="text-xs font-medium text-slate-500">Bobinas</div>
        <div className="mt-1.5 font-mono-num text-xl font-semibold text-slate-900 tracking-tight">
          {formatKg(bobinaKg)}
        </div>
        <div className="mt-1.5 text-xs text-slate-600 font-mono-num">
          {formatNumber(bobinaUnidades)} unidades
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="text-xs font-medium text-slate-500">Barras</div>
        <div className="mt-1.5 font-mono-num text-xl font-semibold text-slate-900 tracking-tight">
          {formatKg(barraKg > 0 ? barraKg : barraBalancaKg)}
        </div>
        <div className="mt-1.5 text-xs text-slate-600 font-mono-num">
          {formatNumber(barraQtd)} br · Balança {formatKg(barraBalancaKg)} · {barraComEtiqueta}/{barraTotalItens} etiq.
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="text-xs font-medium text-slate-500">Telas Pop &amp; Arames</div>
        <div className="mt-1.5 font-mono-num text-xl font-semibold text-slate-900 tracking-tight">
          {formatNumber(telaPopQtd)} <span className="text-sm font-normal text-slate-500">telas</span>
        </div>
        <div className="mt-1.5 text-xs text-slate-600 font-mono-num">
          {telaPopItens} bitolas · Arames {formatKg(arameTotalKg)}
          {arameBoxUnidades > 0 ? ` · ${formatArameBoxes(arameBoxUnidades)}` : ''}
          {arameCoilCount > 0 ? ` · ${formatNumber(arameCoilCount)} bob.` : ''}
        </div>
      </div>
    </section>
  );
}
