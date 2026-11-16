export type MaterialCategory = 'estribo' | 'bobina' | 'barra' | 'tela_pop' | 'arame' | 'outros_materiais';
export type MeasurementMode = 'unidade' | 'kg' | 'barras' | 'ambos';
export type WireType = 'none' | 'liso' | 'torcido';

export const MAX_BITOLA_LENGTH = 60;
export const MAX_MEDIDA_LENGTH = 60;
export const MAX_LABEL_LENGTH = 60;
export const MAX_NOTA_FISCAL_LENGTH = 60;
export const MAX_NOTES_LENGTH = 300;
export const MAX_MONTH_NOTES_LENGTH = 500;
export const MAX_NUMERIC_VALUE = 100000000;

export interface MonthRecord {
  id: string;
  ownerId: string;
  monthKey: string; // YYYY-MM
  isLocked: boolean;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface InventoryItem {
  id: string;
  ownerId: string;
  monthDocId: string;
  monthKey: string;
  category: MaterialCategory;
  bitola: string;
  materialName?: string;
  kgPorUnidade?: number;
  medida: string;
  qtdPecas: number;
  qtdPacotes: number;
  unidades: number;
  qtdBarras: number;
  kg: number;
  measurementMode: MeasurementMode;
  hasLabel: boolean;
  labelCode: string;
  hasScaleWeight: boolean;
  scaleWeightKg: number;
  wireType: WireType;
  notaFiscal?: string;
  notes: string;
  conferentes?: string[];
  temConferenciaSemNome?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface InventoryItemInput {
  category: MaterialCategory;
  bitola: string;
  materialName?: string;
  kgPorUnidade?: number;
  medida: string;
  qtdPecas: number;
  qtdPacotes: number;
  unidades: number;
  qtdBarras: number;
  kg: number;
  measurementMode: MeasurementMode;
  hasLabel: boolean;
  labelCode: string;
  hasScaleWeight: boolean;
  scaleWeightKg: number;
  wireType: WireType;
  notaFiscal?: string;
  notes: string;
  conferentes?: string[];
}

export interface CategoryMeta {
  id: MaterialCategory;
  label: string;
  shortLabel: string;
  description: string;
  bitolaPresets: string[];
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: 'estribo',
    label: 'Estribo',
    shortLabel: 'Estribo',
    description: 'Bitola, med., pçs, pcts e kg',
    bitolaPresets: ['3.8 mm', '4.2 mm', '5.0 mm', '6.0 mm'],
  },
  {
    id: 'bobina',
    label: 'Bobinas',
    shortLabel: 'Bobinas',
    description: 'Bitola, un e etiq./bal. (kg)',
    bitolaPresets: ['3.8 mm', '4.2 mm', '5.0 mm', '6.0 mm'],
  },
  {
    id: 'barra',
    label: 'Barras',
    shortLabel: 'Barras',
    description: 'Bitola, br e etiq./bal. (kg)',
    bitolaPresets: ['4.2 mm', '5.0 mm', '6.3 mm', '8.0 mm', '10.0 mm'],
  },
  {
    id: 'tela_pop',
    label: 'Telas Pop',
    shortLabel: 'Telas Pop',
    description: 'Cód./bitola e qtd.',
    bitolaPresets: [
      'Q45 (3.4 mm)',
      'Q61 (3.4 mm)',
      'Q92 (4.2 mm)',
      'Q138 (4.2 mm)',
    ],
  },
  {
    id: 'arame',
    label: 'Arames',
    shortLabel: 'Arames',
    description: 'Liso/torc., bitola, un (1 kg) e cx (20 kg)',
    bitolaPresets: [
      'BWG 18 (1.24 mm)',
      'BWG 16 (1.65 mm)',
      'BWG 14 (2.11 mm)',
      'BWG 12 (2.77 mm)',
      'BWG 10 (3,40 mm)',
    ],
  },
  {
    id: 'outros_materiais',
    label: 'Outros materiais',
    shortLabel: 'Outros',
    description: 'Material, qtd. e kg/un',
    bitolaPresets: [],
  },
];

export const CATEGORY_MAP: Record<MaterialCategory, CategoryMeta> = {
  estribo: CATEGORIES[0],
  bobina: CATEGORIES[1],
  barra: CATEGORIES[2],
  tela_pop: CATEGORIES[3],
  arame: CATEGORIES[4],
  outros_materiais: CATEGORIES[5],
};

export interface TelaPopSpec {
  code: string;
  presetValue: string;
  nome: string;
  shortNome: string;
  fio: string;
  malha: string;
  painel: string;
  uso: string;
}

export const TELA_POP_CATALOG: TelaPopSpec[] = [
  {
    code: 'Q45',
    presetValue: 'Q45 (3.4 mm)',
    nome: 'Tela Pop Leve',
    shortNome: 'Leve',
    fio: '3,4 mm',
    malha: '20 × 20 cm',
    painel: '2,00 × 3,00 m',
    uso: 'Calçadas leves e revestimentos',
  },
  {
    code: 'Q61',
    presetValue: 'Q61 (3.4 mm)',
    nome: 'Tela Pop Média',
    shortNome: 'Média',
    fio: '3,4 mm',
    malha: '15 × 15 cm',
    painel: '2,00 × 3,00 m',
    uso: 'Contrapisos, calçadas e pisos leves',
  },
  {
    code: 'Q92',
    presetValue: 'Q92 (4.2 mm)',
    nome: 'Tela Pop Reforçada',
    shortNome: 'Reforçada',
    fio: '4,2 mm',
    malha: '15 × 15 cm',
    painel: '2,00 × 3,00 m',
    uso: 'Lajes leves, calçadas e garagens',
  },
  {
    code: 'Q138',
    presetValue: 'Q138 (4.2 mm)',
    nome: 'Tela Pop Pesada',
    shortNome: 'Pesada',
    fio: '4,2 mm',
    malha: '10 × 10 cm',
    painel: '2,00 × 3,00 m',
    uso: 'Pisos reforçados, garagens e lajes',
  },
];

export function resolveTelaPopByCode(input: string): TelaPopSpec | null {
  const cleaned = input.trim().toUpperCase();
  if (!cleaned) return null;

  const exactPreset = TELA_POP_CATALOG.find(
    (spec) => spec.presetValue.toUpperCase() === cleaned || spec.code === cleaned
  );
  if (exactPreset) return exactPreset;

  const codeMatch = cleaned.match(/\bE?(Q\d{2,3})\b/);
  if (codeMatch) {
    const matched = TELA_POP_CATALOG.find((spec) => spec.code === codeMatch[1]);
    if (matched) return matched;
  }

  const numericMatch = cleaned.match(/^(\d{2,3})$/);
  if (numericMatch) {
    const qCode = `Q${numericMatch[1]}`;
    const matched = TELA_POP_CATALOG.find((spec) => spec.code === qCode);
    if (matched) return matched;
  }

  return null;
}

export const ARAME_KG_PER_UNIT = 1;
export const ARAME_UNITS_PER_BOX = 20;

export function getArameMetrics(
  unidades: number,
  kg: number,
  measurementMode?: MeasurementMode
): {
  isVariedCoil: boolean;
  unidades: number;
  kg: number;
  caixas: number;
  avulsas: number;
} {
  if (measurementMode === 'kg') {
    return {
      isVariedCoil: true,
      unidades,
      kg,
      caixas: 0,
      avulsas: 0,
    };
  }
  const effectiveUnits = unidades > 0 ? unidades : kg > 0 ? kg / ARAME_KG_PER_UNIT : 0;
  const effectiveKg = kg > 0 ? kg : effectiveUnits * ARAME_KG_PER_UNIT;
  const caixas = Math.floor(effectiveUnits / ARAME_UNITS_PER_BOX);
  const avulsas = Math.max(0, effectiveUnits - caixas * ARAME_UNITS_PER_BOX);
  return {
    isVariedCoil: false,
    unidades: effectiveUnits,
    kg: effectiveKg,
    caixas,
    avulsas,
  };
}

export function formatArameBoxes(unidades: number): string {
  if (unidades <= 0) return '0 cx';
  const caixas = Math.floor(unidades / ARAME_UNITS_PER_BOX);
  const avulsas = Math.round((unidades - caixas * ARAME_UNITS_PER_BOX) * 100) / 100;
  if (caixas > 0 && avulsas > 0) {
    return `${formatNumber(caixas)} cx + ${formatNumber(avulsas, avulsas % 1 === 0 ? 0 : 2)} un`;
  }
  if (caixas > 0) {
    return `${formatNumber(caixas)} cx`;
  }
  return `${formatNumber(avulsas, avulsas % 1 === 0 ? 0 : 2)} un av.`;
}

const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const MONTH_SHORT_PT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

export function formatMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const monthIdx = Number(monthStr) - 1;
  if (!yearStr || Number.isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) {
    return monthKey;
  }
  return `${MONTH_NAMES_PT[monthIdx]} ${yearStr}`;
}

export function formatMonthShortLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const monthIdx = Number(monthStr) - 1;
  if (!yearStr || Number.isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) {
    return monthKey;
  }
  return `${MONTH_SHORT_PT[monthIdx]}/${yearStr}`;
}

export function getAdjacentMonthKey(monthKey: string, delta: number): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (Number.isNaN(year) || Number.isNaN(month)) {
    return getCurrentMonthKey();
  }
  const date = new Date(year, month - 1 + delta, 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function formatNumber(val: number, decimals = 0): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

export function formatKg(val: number): string {
  const hasDecimals = Math.abs(val % 1) > 0.001;
  return `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(val)} kg`;
}
