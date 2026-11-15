import {
  type InventoryItem,
  type InventoryItemInput,
  MAX_MONTH_NOTES_LENGTH,
  type MonthRecord,
} from '../types/inventory';
import {
  clampNonNegative,
  mergeMergedNotes,
  normalizeEstriboKey,
  sanitizeItemInput,
} from './inventoryService';

const MONTHS_STORAGE_KEY = 'acogestao_test_months_v1';
const ITEMS_STORAGE_KEY = 'acogestao_test_items_v1';

export function consolidateEstriboItems(items: InventoryItem[]): {
  items: InventoryItem[];
  changed: boolean;
} {
  const result: InventoryItem[] = [];
  const estriboIndexByKey = new Map<string, number>();
  let changed = false;

  for (const item of items) {
    if (item.category !== 'estribo') {
      result.push(item);
      continue;
    }

    const key = `${item.monthKey}::${normalizeEstriboKey(item.bitola, item.medida ?? '')}`;
    const existingIdx = estriboIndexByKey.get(key);

    if (existingIdx === undefined) {
      estriboIndexByKey.set(key, result.length);
      result.push(item);
    } else {
      const existing = result[existingIdx];
      result[existingIdx] = {
        ...existing,
        qtdPecas: clampNonNegative(existing.qtdPecas + item.qtdPecas),
        qtdPacotes: clampNonNegative(existing.qtdPacotes + item.qtdPacotes),
        kg: clampNonNegative(existing.kg + item.kg),
        notes: mergeMergedNotes(existing.notes, item.notes),
      };
      changed = true;
    }
  }

  return { items: result, changed };
}

export function loadLocalMonths(): Record<string, MonthRecord> {
  try {
    const raw = window.localStorage.getItem(MONTHS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, MonthRecord>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveLocalMonths(months: Record<string, MonthRecord>): void {
  try {
    window.localStorage.setItem(MONTHS_STORAGE_KEY, JSON.stringify(months));
  } catch {
    // Ignore quota errors in test storage
  }
}

export function loadLocalItems(): InventoryItem[] {
  try {
    const raw = window.localStorage.getItem(ITEMS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InventoryItem[];
    if (!Array.isArray(parsed)) return [];
    const { items: consolidated, changed } = consolidateEstriboItems(parsed);
    const sorted = sortInventoryItems(consolidated);
    if (changed) {
      saveLocalItems(sorted);
    }
    return sorted;
  } catch {
    return [];
  }
}

export function saveLocalItems(items: InventoryItem[]): void {
  try {
    window.localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore quota errors in test storage
  }
}

function parseBitolaNumeric(bitola: string): number {
  const match = bitola.replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  if (!match) return Number.POSITIVE_INFINITY;
  const num = Number.parseFloat(match[1]);
  return Number.isNaN(num) ? Number.POSITIVE_INFINITY : num;
}

export function sortInventoryItems(items: InventoryItem[]): InventoryItem[] {
  return [...items].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    const numA = parseBitolaNumeric(a.bitola);
    const numB = parseBitolaNumeric(b.bitola);
    if (numA !== numB) return numA - numB;
    const bitolaCmp = a.bitola.localeCompare(b.bitola, 'pt-BR', { numeric: true });
    if (bitolaCmp !== 0) return bitolaCmp;
    return (a.medida ?? '').localeCompare(b.medida ?? '', 'pt-BR', { numeric: true });
  });
}

export function createLocalItemRecord(
  monthKey: string,
  rawInput: InventoryItemInput
): InventoryItem {
  const sanitized = sanitizeItemInput(rawInput);
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    ownerId: 'local_test',
    monthDocId: `local_test_${monthKey}`,
    monthKey,
    ...sanitized,
  };
}

export function updateLocalItemRecord(
  existing: InventoryItem,
  rawInput: InventoryItemInput
): InventoryItem {
  const sanitized = sanitizeItemInput(rawInput);
  return {
    ...existing,
    ...sanitized,
  };
}

export function buildLocalMonthRecord(
  monthKey: string,
  overrides?: Partial<MonthRecord>
): MonthRecord {
  return {
    id: `local_test_${monthKey}`,
    ownerId: 'local_test',
    monthKey,
    isLocked: false,
    notes: '',
    ...overrides,
    ...(overrides?.notes !== undefined
      ? { notes: overrides.notes.trim().slice(0, MAX_MONTH_NOTES_LENGTH) }
      : {}),
  };
}
