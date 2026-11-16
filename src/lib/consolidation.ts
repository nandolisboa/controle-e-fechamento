import {
  getArameMetrics,
  type InventoryItem,
  resolveTelaPopByCode,
} from '../types/inventory';

const naturalCollator = new Intl.Collator('pt-BR', {
  numeric: true,
  sensitivity: 'base',
});

export function parseBitolaNumeric(bitola: string): number {
  const match = bitola.replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  if (!match) return Number.POSITIVE_INFINITY;
  const num = Number.parseFloat(match[1]);
  return Number.isNaN(num) ? Number.POSITIVE_INFINITY : num;
}

export function compareBitolaAsc(a: string, b: string): number {
  const numA = parseBitolaNumeric(a);
  const numB = parseBitolaNumeric(b);
  if (numA !== numB) return numA - numB;
  return naturalCollator.compare(a, b);
}

export function compareNaturalAsc(a: string, b: string): number {
  return naturalCollator.compare(a, b);
}

export interface ConsolidatedEstriboRow {
  key: string;
  bitola: string;
  medida: string;
  hasMedida: boolean;
  lancamentos: number;
  qtdPecas: number;
  qtdPacotes: number;
  kg: number;
}

export interface ConsolidatedBobinaRow {
  key: string;
  bitola: string;
  lancamentos: number;
  unidades: number;
  etiquetaKg: number;
  scaleWeightKg: number;
}

export interface ConsolidatedBarraRow {
  key: string;
  bitola: string;
  lancamentos: number;
  withLabelCount: number;
  qtdBarras: number;
  kg: number;
  scaleWeightKg: number;
}

export interface ConsolidatedTelaRow {
  key: string;
  bitola: string;
  code: string;
  specText: string;
  lancamentos: number;
  unidades: number;
}

export interface ConsolidatedArameRow {
  key: string;
  wireLabel: string;
  bitola: string;
  isVariedCoil: boolean;
  lancamentos: number;
  unidades: number;
  kg: number;
}

export interface ConsolidatedInventorySummary {
  estribos: ConsolidatedEstriboRow[];
  bobinas: ConsolidatedBobinaRow[];
  barras: ConsolidatedBarraRow[];
  telas: ConsolidatedTelaRow[];
  arames: ConsolidatedArameRow[];
  estriboTotalLancamentos: number;
  estriboTotalPecas: number;
  estriboTotalPacotes: number;
  estriboTotalKg: number;
  bobinaTotalLancamentos: number;
  bobinaTotalUn: number;
  bobinaTotalEtiquetaKg: number;
  bobinaTotalBalancaKg: number;
  barraTotalLancamentos: number;
  barraTotalWithLabel: number;
  barraTotalQtd: number;
  barraTotalKg: number;
  barraTotalBalanca: number;
  telaTotalLancamentos: number;
  telaTotalUn: number;
  arameTotalLancamentos: number;
  arameTotalKg: number;
  arameTotalBoxUn: number;
  arameTotalCoilUn: number;
  totalSemBalancaKg: number;
  totalBalancaKg: number;
}

export function consolidateInventoryItems(
  items: InventoryItem[]
): ConsolidatedInventorySummary {
  const estriboMap = new Map<string, ConsolidatedEstriboRow>();
  const bobinaMap = new Map<string, ConsolidatedBobinaRow>();
  const barraMap = new Map<string, ConsolidatedBarraRow>();
  const telaMap = new Map<string, ConsolidatedTelaRow>();
  const arameMap = new Map<string, ConsolidatedArameRow>();

  for (const item of items) {
    if (item.category === 'estribo') {
      const bitola = item.bitola.trim() || '—';
      const cleanedMedida = item.medida.trim().replace(/\s+/g, ' ');
      const hasMedida = cleanedMedida.length > 0;
      const medida = hasMedida ? cleanedMedida : 'S/ med.';
      const key = `${bitola.toLowerCase()}::${hasMedida ? cleanedMedida.toLowerCase() : '__sem_medida__'}`;
      const cur = estriboMap.get(key);
      if (cur) {
        cur.lancamentos += 1;
        cur.qtdPecas += item.qtdPecas;
        cur.qtdPacotes += item.qtdPacotes;
        cur.kg += item.kg;
      } else {
        estriboMap.set(key, {
          key,
          bitola,
          medida,
          hasMedida,
          lancamentos: 1,
          qtdPecas: item.qtdPecas,
          qtdPacotes: item.qtdPacotes,
          kg: item.kg,
        });
      }
    } else if (item.category === 'bobina') {
      const bitola = item.bitola.trim() || '—';
      const key = bitola.toLowerCase();
      const etiquetaKg = item.hasLabel || !item.hasScaleWeight ? item.kg : 0;
      const scaleKg = item.hasScaleWeight ? item.scaleWeightKg : 0;
      const cur = bobinaMap.get(key);
      if (cur) {
        cur.lancamentos += 1;
        cur.unidades += item.unidades;
        cur.etiquetaKg += etiquetaKg;
        cur.scaleWeightKg += scaleKg;
      } else {
        bobinaMap.set(key, {
          key,
          bitola,
          lancamentos: 1,
          unidades: item.unidades,
          etiquetaKg,
          scaleWeightKg: scaleKg,
        });
      }
    } else if (item.category === 'barra') {
      const bitola = item.bitola.trim() || '—';
      const key = bitola.toLowerCase();
      const etiquetaKg = item.hasLabel || !item.hasScaleWeight ? item.kg : 0;
      const scaleKg = item.hasScaleWeight ? item.scaleWeightKg : 0;
      const cur = barraMap.get(key);
      if (cur) {
        cur.lancamentos += 1;
        if (item.hasLabel) cur.withLabelCount += 1;
        cur.qtdBarras += item.qtdBarras;
        cur.kg += etiquetaKg;
        cur.scaleWeightKg += scaleKg;
      } else {
        barraMap.set(key, {
          key,
          bitola,
          lancamentos: 1,
          withLabelCount: item.hasLabel ? 1 : 0,
          qtdBarras: item.qtdBarras,
          kg: etiquetaKg,
          scaleWeightKg: scaleKg,
        });
      }
    } else if (item.category === 'tela_pop') {
      const bitola = item.bitola.trim() || '—';
      const spec = resolveTelaPopByCode(bitola);
      const key = spec ? spec.code : bitola.toLowerCase();
      const cur = telaMap.get(key);
      if (cur) {
        cur.lancamentos += 1;
        cur.unidades += item.unidades;
      } else {
        telaMap.set(key, {
          key,
          bitola,
          code: spec ? `${spec.code} (${spec.fio})` : bitola,
          specText: spec ? `${spec.shortNome} · ${spec.malha}` : 'Personalizada',
          lancamentos: 1,
          unidades: item.unidades,
        });
      }
    } else if (item.category === 'arame') {
      const m = getArameMetrics(item.unidades, item.kg, item.measurementMode);
      const wireLabel = item.wireType === 'liso' ? 'Liso' : 'Torcido';
      const bitola = item.bitola.trim() || '—';
      const key = `${wireLabel}::${bitola.toLowerCase()}::${m.isVariedCoil ? 'coil' : 'box'}`;
      const cur = arameMap.get(key);
      if (cur) {
        cur.lancamentos += 1;
        cur.unidades += m.unidades;
        cur.kg += m.kg;
      } else {
        arameMap.set(key, {
          key,
          wireLabel,
          bitola,
          isVariedCoil: m.isVariedCoil,
          lancamentos: 1,
          unidades: m.unidades,
          kg: m.kg,
        });
      }
    }
  }

  const estribos = Array.from(estriboMap.values()).sort((a, b) => {
    const c = compareBitolaAsc(a.bitola, b.bitola);
    if (c !== 0) return c;
    if (a.hasMedida !== b.hasMedida) return a.hasMedida ? -1 : 1;
    return naturalCollator.compare(a.medida, b.medida);
  });

  const bobinas = Array.from(bobinaMap.values()).sort((a, b) =>
    compareBitolaAsc(a.bitola, b.bitola)
  );

  const barras = Array.from(barraMap.values()).sort((a, b) =>
    compareBitolaAsc(a.bitola, b.bitola)
  );

  const telas = Array.from(telaMap.values()).sort((a, b) =>
    naturalCollator.compare(a.code, b.code)
  );

  const arames = Array.from(arameMap.values()).sort((a, b) => {
    const w = naturalCollator.compare(a.wireLabel, b.wireLabel);
    if (w !== 0) return w;
    const bCmp = compareBitolaAsc(a.bitola, b.bitola);
    if (bCmp !== 0) return bCmp;
    return Number(a.isVariedCoil) - Number(b.isVariedCoil);
  });

  const estriboTotalLancamentos = estribos.reduce((s, r) => s + r.lancamentos, 0);
  const estriboTotalPecas = estribos.reduce((s, r) => s + r.qtdPecas, 0);
  const estriboTotalPacotes = estribos.reduce((s, r) => s + r.qtdPacotes, 0);
  const estriboTotalKg = estribos.reduce((s, r) => s + r.kg, 0);

  const bobinaTotalLancamentos = bobinas.reduce((s, r) => s + r.lancamentos, 0);
  const bobinaTotalUn = bobinas.reduce((s, r) => s + r.unidades, 0);
  const bobinaTotalEtiquetaKg = bobinas.reduce((s, r) => s + r.etiquetaKg, 0);
  const bobinaTotalBalancaKg = bobinas.reduce((s, r) => s + r.scaleWeightKg, 0);

  const barraTotalLancamentos = barras.reduce((s, r) => s + r.lancamentos, 0);
  const barraTotalWithLabel = barras.reduce((s, r) => s + r.withLabelCount, 0);
  const barraTotalQtd = barras.reduce((s, r) => s + r.qtdBarras, 0);
  const barraTotalKg = barras.reduce((s, r) => s + r.kg, 0);
  const barraTotalBalanca = barras.reduce((s, r) => s + r.scaleWeightKg, 0);

  const telaTotalLancamentos = telas.reduce((s, r) => s + r.lancamentos, 0);
  const telaTotalUn = telas.reduce((s, r) => s + r.unidades, 0);

  const arameTotalLancamentos = arames.reduce((s, r) => s + r.lancamentos, 0);
  const arameTotalKg = arames.reduce((s, r) => s + r.kg, 0);
  const arameTotalBoxUn = arames
    .filter((r) => !r.isVariedCoil)
    .reduce((s, r) => s + r.unidades, 0);
  const arameTotalCoilUn = arames
    .filter((r) => r.isVariedCoil)
    .reduce((s, r) => s + r.unidades, 0);

  const outrosMateriaisTotalKg = items
    .filter((item) => item.category === 'outros_materiais')
    .reduce((sum, item) => sum + item.kg, 0);
  const totalSemBalancaKg =
    estriboTotalKg + bobinaTotalEtiquetaKg + barraTotalKg + arameTotalKg + outrosMateriaisTotalKg;
  const totalBalancaKg = bobinaTotalBalancaKg + barraTotalBalanca;

  return {
    estribos,
    bobinas,
    barras,
    telas,
    arames,
    estriboTotalLancamentos,
    estriboTotalPecas,
    estriboTotalPacotes,
    estriboTotalKg,
    bobinaTotalLancamentos,
    bobinaTotalUn,
    bobinaTotalEtiquetaKg,
    bobinaTotalBalancaKg,
    barraTotalLancamentos,
    barraTotalWithLabel,
    barraTotalQtd,
    barraTotalKg,
    barraTotalBalanca,
    telaTotalLancamentos,
    telaTotalUn,
    arameTotalLancamentos,
    arameTotalKg,
    arameTotalBoxUn,
    arameTotalCoilUn,
    totalSemBalancaKg,
    totalBalancaKg,
  };
}
