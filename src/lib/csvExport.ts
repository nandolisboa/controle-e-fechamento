import {
  CATEGORY_MAP,
  formatMonthShortLabel,
  getArameMetrics,
  type InventoryItem,
} from '../types/inventory';

function escapeCsvCell(value: string | number | boolean): string {
  const str = String(value ?? '');
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportMonthlyCsv(monthKey: string, items: InventoryItem[]): void {
  const headers = [
    'Mês',
    'Cat.',
    'Material',
    'Kg/un',
    'Arame',
    'Bitola',
    'Med. (Estribo)',
    'Pçs (Estribo)',
    'Pcts (Estribo)',
    'Un.',
    'Barras',
    'Kg',
    'Etiq.',
    'Cód. Etiq.',
    'Bal.',
    'Peso Bal. (kg)',
    'NF',
    'Obs.',
  ];

  const rows = items.map((item) => {
    const categoryLabel = CATEGORY_MAP[item.category].shortLabel;
    const wireLabel =
      item.category === 'arame'
        ? item.wireType === 'liso'
          ? 'Liso'
          : item.wireType === 'torcido'
            ? 'Torc.'
            : '-'
        : '-';

    return [
      formatMonthShortLabel(monthKey),
      categoryLabel,
      item.category === 'outros_materiais' ? item.materialName || item.bitola : '',
      item.category === 'outros_materiais' && (item.kgPorUnidade ?? 0) > 0 ? item.kgPorUnidade ?? 0 : '',
      wireLabel,
      item.bitola,
      item.category === 'estribo' ? item.medida : '',
      item.category === 'estribo' ? item.qtdPecas : '',
      item.category === 'estribo' ? item.qtdPacotes : '',
      item.category === 'bobina' || item.category === 'tela_pop' || item.category === 'outros_materiais'
        ? item.unidades
        : item.category === 'arame'
          ? getArameMetrics(item.unidades, item.kg, item.measurementMode).unidades
          : '',
      item.category === 'barra' && item.qtdBarras > 0 ? item.qtdBarras : '',
      item.category === 'arame'
        ? getArameMetrics(item.unidades, item.kg, item.measurementMode).kg
        : item.category === 'bobina' || item.category === 'barra'
          ? item.hasLabel || !item.hasScaleWeight
            ? item.kg > 0
              ? item.kg
              : ''
            : ''
          : item.category !== 'tela_pop'
            ? item.kg
            : '',
      item.category === 'barra' || item.category === 'bobina'
        ? item.hasLabel
          ? 'Sim'
          : 'Não'
        : '',
      item.category === 'barra' && item.hasLabel ? item.labelCode : '',
      item.category === 'barra' || item.category === 'bobina'
        ? item.hasScaleWeight
          ? 'Sim'
          : 'Não'
        : '',
      (item.category === 'barra' || item.category === 'bobina') && item.hasScaleWeight
        ? item.scaleWeightKg
        : '',
      item.category === 'estribo' ? '' : (item.notaFiscal ?? ''),
      item.notes,
    ].map(escapeCsvCell);
  });

  const csvContent =
    '\uFEFF' + [headers.map(escapeCsvCell).join(';'), ...rows.map((r) => r.join(';'))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `estoque-${monthKey}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
