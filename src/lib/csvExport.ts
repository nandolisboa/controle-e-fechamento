import {
  CATEGORY_MAP,
  formatMonthLabel,
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
    'Mês Referência',
    'Categoria',
    'Tipo Arame',
    'Bitola',
    'Medida (Estribo)',
    'Qtd. Peças (Estribo)',
    'Qtd. Pacotes (Estribo)',
    'Unidades / Quantidade',
    'Qtd. Barras',
    'Kg',
    'Etiqueta',
    'Código Etiqueta',
    'Pesado na Balança',
    'Peso Balança (Kg)',
    'Nota Fiscal',
    'Observações',
  ];

  const rows = items.map((item) => {
    const categoryLabel = CATEGORY_MAP[item.category].label;
    const wireLabel =
      item.category === 'arame'
        ? item.wireType === 'liso'
          ? 'Liso'
          : item.wireType === 'torcido'
            ? 'Torcido'
            : '-'
        : '-';

    return [
      formatMonthLabel(monthKey),
      categoryLabel,
      wireLabel,
      item.bitola,
      item.category === 'estribo' ? item.medida : '',
      item.category === 'estribo' ? item.qtdPecas : '',
      item.category === 'estribo' ? item.qtdPacotes : '',
      item.category === 'bobina' || item.category === 'tela_pop'
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
      item.notaFiscal ?? '',
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
