import ExcelJS from 'exceljs';
import { consolidateInventoryItems } from './consolidation';
import {
  CATEGORY_MAP,
  formatArameBoxes,
  formatMonthLabel,
  formatMonthShortLabel,
  formatNumber,
  getArameMetrics,
  type InventoryItem,
  resolveTelaPopByCode,
} from '../types/inventory';

export interface ExcelColumnDef {
  header: string;
  key: keyof ExcelRowData;
  width: number;
}

export interface ExcelRowData {
  categoria: string;
  material: string;
  tipo: string;
  quantidade: string;
  kgUnidade: number | string;
  peso: number | string;
  nf: string;
  responsavel: string;
  detalhes: string;
}

export interface MonthlyExcelData {
  fileName: string;
  sheetName: string;
  title: string;
  subtitle: string;
  metaLine: string;
  responsaveisLine: string;
  columns: ExcelColumnDef[];
  rows: ExcelRowData[];
  totalSemBalancaKg: number;
  totalBalancaKg: number;
}

export const EXCEL_COLUMNS: ExcelColumnDef[] = [
  { header: 'Cat.', key: 'categoria', width: 15 },
  { header: 'Material / Bit.', key: 'material', width: 24 },
  { header: 'Med. / Tipo', key: 'tipo', width: 19 },
  { header: 'Qtd.', key: 'quantidade', width: 16 },
  { header: 'Kg/un', key: 'kgUnidade', width: 11 },
  { header: 'Peso / Bal. (kg)', key: 'peso', width: 19 },
  { header: 'NF', key: 'nf', width: 13 },
  { header: 'Resp.', key: 'responsavel', width: 20 },
  { header: 'Obs. / Detalhes', key: 'detalhes', width: 34 },
];

export function buildMonthlyExcelData(
  monthKey: string,
  items: InventoryItem[],
  isTestMode = false
): MonthlyExcelData {
  const responsaveis = Array.from(
    new Set(items.flatMap((item) => item.conferentes ?? []))
  ).filter(Boolean);
  const missing = items.some((item) => !item.conferentes?.length || item.temConferenciaSemNome);

  const sorted = [...items].sort(
    (a, b) =>
      CATEGORY_MAP[a.category].label.localeCompare(CATEGORY_MAP[b.category].label, 'pt-BR') ||
      a.bitola.localeCompare(b.bitola, 'pt-BR', { numeric: true })
  );

  const rows: ExcelRowData[] = sorted.map((item) => {
    const material =
      item.category === 'outros_materiais' ? item.materialName || item.bitola : item.bitola;
    let type = item.medida || '';
    let quantity = '';
    let kgUnit: number | string = '';
    let weight: number | string = item.kg || '';
    let details = item.notes || '';

    if (item.category === 'estribo') {
      quantity = `${formatNumber(item.qtdPecas)} pçs · ${formatNumber(item.qtdPacotes)} pcts`;
    } else if (item.category === 'bobina') {
      quantity = `${formatNumber(item.unidades)} un`;
      if (item.hasScaleWeight) {
        weight = `${item.kg ? `${formatNumber(item.kg, 2)} kg etiq.; ` : ''}${formatNumber(item.scaleWeightKg, 2)} kg bal.`;
      }
      type =
        item.hasLabel && item.hasScaleWeight
          ? 'Etiq. + Bal.'
          : item.hasLabel
            ? `Etiq.${item.labelCode ? ` ${item.labelCode}` : ''}`
            : item.hasScaleWeight
              ? 'Bal.'
              : '';
    } else if (item.category === 'barra') {
      quantity = item.qtdBarras > 0 ? `${formatNumber(item.qtdBarras)} br` : 'Peso';
      type =
        item.hasLabel && item.hasScaleWeight
          ? `Etiq. + Bal.${item.labelCode ? ` (${item.labelCode})` : ''}`
          : item.hasLabel
            ? `Etiq.${item.labelCode ? ` (${item.labelCode})` : ''}`
            : item.hasScaleWeight
              ? 'Bal.'
              : '';
      if (item.hasScaleWeight) {
        weight = `${item.kg ? `${formatNumber(item.kg, 2)} kg etiq.; ` : ''}${formatNumber(item.scaleWeightKg, 2)} kg bal.`;
      }
    } else if (item.category === 'tela_pop') {
      quantity = `${formatNumber(item.unidades)} un`;
      const telaSpec = resolveTelaPopByCode(item.bitola);
      if (telaSpec) type = `${telaSpec.shortNome} · ${telaSpec.malha}`;
    } else if (item.category === 'arame') {
      const metrics = getArameMetrics(item.unidades, item.kg, item.measurementMode);
      type = `${item.wireType === 'liso' ? 'Liso' : 'Torc.'}${metrics.isVariedCoil ? ' · Bob. kg var.' : ` · ${formatArameBoxes(metrics.unidades)}`}`;
      quantity = `${formatNumber(metrics.unidades)} ${metrics.isVariedCoil ? 'bob.' : 'un'}`;
      weight = metrics.kg || '';
    } else if (item.category === 'outros_materiais') {
      quantity = item.unidades > 0 ? `${formatNumber(item.unidades)} un` : '';
      kgUnit = item.kgPorUnidade || '';
      weight = item.kg || '';
    }

    const itemNf = item.category === 'estribo' ? '' : (item.notaFiscal ?? '').trim();
    if (item.temConferenciaSemNome) {
      details = `${details}${details ? ' · ' : ''}Conf. s/ resp.`;
    }

    return {
      categoria: CATEGORY_MAP[item.category].shortLabel,
      material,
      tipo: type,
      quantidade: quantity,
      kgUnidade: kgUnit,
      peso: weight,
      nf: itemNf,
      responsavel: (item.conferentes ?? []).join(', '),
      detalhes: details,
    };
  });

  const totals = consolidateInventoryItems(items);

  return {
    fileName: `Arames-Brasil-Estoque-${monthKey}.xlsx`,
    sheetName: 'Estoque mensal',
    title: `ESTOQUE MENSAL — ${formatMonthLabel(monthKey).toUpperCase()}`,
    subtitle: isTestMode ? 'MODO TESTE LOCAL — NÃO REPRESENTA O ESTOQUE OFICIAL' : 'ARAMES BRASIL',
    metaLine: `Ref.: ${formatMonthShortLabel(monthKey)} · Emissão: ${new Intl.DateTimeFormat('pt-BR').format(new Date())}`,
    responsaveisLine: `Resp.: ${responsaveis.length ? responsaveis.join(', ') : '—'}${missing ? ' · Há itens s/ resp.' : ''}`,
    columns: EXCEL_COLUMNS,
    rows,
    totalSemBalancaKg: totals.totalSemBalancaKg,
    totalBalancaKg: totals.totalBalancaKg,
  };
}

export async function exportMonthlyExcel(monthKey: string, items: InventoryItem[], isTestMode = false): Promise<void> {
  const data = buildMonthlyExcelData(monthKey, items, isTestMode);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Arames Brasil';
  workbook.subject = 'Relatório de estoque mensal';
  workbook.title = `Estoque mensal - ${formatMonthLabel(monthKey)}`;
  const sheet = workbook.addWorksheet(data.sheetName, {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.15, footer: 0.15 } },
    views: [{ state: 'frozen', ySplit: 6 }],
  });
  sheet.columns = data.columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width,
  }));
  sheet.mergeCells('A1:I1');
  sheet.getCell('A1').value = data.title;
  sheet.getCell('A1').font = { name: 'Arial', bold: true, size: 16, color: { argb: 'FF9B1C1F' } };
  sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(1).height = 30;
  sheet.mergeCells('A2:I2');
  sheet.getCell('A2').value = data.subtitle;
  sheet.getCell('A2').font = { name: 'Arial', size: 9, color: { argb: 'FF555555' }, italic: true };
  sheet.mergeCells('A3:I3');
  sheet.getCell('A3').value = data.metaLine;
  sheet.getCell('A3').font = { name: 'Arial', size: 10, color: { argb: 'FF222222' } };
  sheet.mergeCells('A4:I4');
  sheet.getCell('A4').value = data.responsaveisLine;
  sheet.getCell('A4').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF222222' } };
  sheet.getRow(5).height = 7;
  const header = sheet.getRow(6);
  header.values = data.columns.map((c) => c.header);
  header.height = 28;
  header.eachCell((cell) => {
    cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF9B1C1F' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF761619' } } };
  });
  for (const rowData of data.rows) {
    const row = sheet.addRow(rowData);
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF222222' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: row.number % 2 === 0 ? 'FFF8F8F8' : 'FFFFFFFF' } };
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } } };
      if ([5, 6].includes(colNumber) && typeof cell.value === 'number') cell.numFmt = '#,##0.00';
    });
    row.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF9B1C1F' } };
    row.commit();
  }
  const lastDataRow = sheet.rowCount;
  sheet.autoFilter = { from: 'A6', to: `I${Math.max(6, lastDataRow)}` };
  sheet.addRow([]);
  const totalRow = sheet.addRow([
    'TOTAIS',
    '',
    '',
    '',
    '',
    `Etiq./lote: ${formatNumber(data.totalSemBalancaKg, 2)} kg`,
    '',
    '',
    `Bal.: ${formatNumber(data.totalBalancaKg, 2)} kg`,
  ]);
  totalRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF9B1C1F' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  sheet.pageSetup.printTitlesRow = '1:6';
  sheet.headerFooter.oddFooter = '&LArames Brasil&CRelatório de estoque&R&P de &N';
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}logo-arames-brasil.jpg`);
    if (response.ok) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const imageId = workbook.addImage({ base64: `data:image/jpeg;base64,${btoa(binary)}`, extension: 'jpeg' });
      sheet.addImage(imageId, {
        tl: { col: 7.35, row: 0.1 },
        br: { col: 8.95, row: 1.45 },
      } as unknown as Parameters<typeof sheet.addImage>[1]);
    }
  } catch { /* Logo is decorative; report remains complete without it. */ }
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Arames-Brasil-Estoque-${monthKey}.xlsx`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
