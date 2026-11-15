import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  type InventoryItem,
  type InventoryItemInput,
  MAX_BITOLA_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_MEDIDA_LENGTH,
  MAX_MONTH_NOTES_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_NUMERIC_VALUE,
} from '../types/inventory';

export function clampNonNegative(val: number): number {
  if (!Number.isFinite(val) || val < 0) return 0;
  if (val > MAX_NUMERIC_VALUE) return MAX_NUMERIC_VALUE;
  return Math.round(val * 1000) / 1000;
}

function sanitizeText(text: string, maxLen: number): string {
  return text.trim().slice(0, maxLen);
}

export function normalizeEstriboKey(bitola: string, medida: string): string {
  const normBitola = bitola.trim().replace(/\s+/g, ' ').toLowerCase();
  const normMedida = medida.trim().replace(/\s+/g, ' ').toLowerCase();
  return `${normBitola}::${normMedida}`;
}

export function mergeMergedNotes(existingNotes: string, incomingNotes: string): string {
  const a = existingNotes.trim();
  const b = incomingNotes.trim();
  if (!a) return b.slice(0, MAX_NOTES_LENGTH);
  if (!b || a === b) return a.slice(0, MAX_NOTES_LENGTH);
  return `${a} · ${b}`.slice(0, MAX_NOTES_LENGTH);
}

export function buildMonthDocId(uid: string, monthKey: string): string {
  return `${uid}_${monthKey}`;
}

export function sanitizeItemInput(input: InventoryItemInput): InventoryItemInput {
  const bitola = sanitizeText(input.bitola, MAX_BITOLA_LENGTH);
  const medida = input.category === 'estribo' ? sanitizeText(input.medida, MAX_MEDIDA_LENGTH) : '';
  const labelCode = input.hasLabel ? sanitizeText(input.labelCode, MAX_LABEL_LENGTH) : '';
  const notes = sanitizeText(input.notes, MAX_NOTES_LENGTH);

  return {
    category: input.category,
    bitola,
    medida,
    qtdPecas: clampNonNegative(input.qtdPecas),
    qtdPacotes: clampNonNegative(input.qtdPacotes),
    unidades: clampNonNegative(input.unidades),
    qtdBarras: clampNonNegative(input.qtdBarras),
    kg: clampNonNegative(input.kg),
    measurementMode: input.measurementMode,
    hasLabel: Boolean(input.hasLabel),
    labelCode,
    hasScaleWeight: Boolean(input.hasScaleWeight),
    scaleWeightKg: input.hasScaleWeight ? clampNonNegative(input.scaleWeightKg) : 0,
    wireType: input.category === 'arame' ? input.wireType : 'none',
    notes,
  };
}

export async function ensureMonthRecord(
  uid: string,
  monthKey: string,
  knownExists?: boolean
): Promise<string> {
  const monthDocId = buildMonthDocId(uid, monthKey);
  if (knownExists) {
    return monthDocId;
  }
  const monthRef = doc(db, 'months', monthDocId);
  try {
    const snap = await getDoc(monthRef);
    if (!snap.exists()) {
      await setDoc(monthRef, {
        ownerId: uid,
        monthKey,
        isLocked: false,
        notes: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return monthDocId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `months/${monthDocId}`);
  }
}

export async function setMonthLockState(
  monthDocId: string,
  isLocked: boolean
): Promise<void> {
  const monthRef = doc(db, 'months', monthDocId);
  try {
    await updateDoc(monthRef, {
      isLocked,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `months/${monthDocId}`);
  }
}

export async function updateMonthNotes(
  monthDocId: string,
  notes: string
): Promise<void> {
  const monthRef = doc(db, 'months', monthDocId);
  try {
    await updateDoc(monthRef, {
      notes: sanitizeText(notes, MAX_MONTH_NOTES_LENGTH),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `months/${monthDocId}`);
  }
}

function generateItemId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `item_${Date.now()}_${rand}`;
}

export async function createInventoryItem(
  uid: string,
  monthKey: string,
  rawInput: InventoryItemInput,
  knownMonthExists?: boolean,
  existingMonthItems: InventoryItem[] = []
): Promise<string> {
  const monthDocId = await ensureMonthRecord(uid, monthKey, knownMonthExists);
  const sanitized = sanitizeItemInput(rawInput);
  if (!sanitized.bitola) {
    throw new Error('A bitola é obrigatória.');
  }

  if (sanitized.category === 'estribo') {
    const targetKey = normalizeEstriboKey(sanitized.bitola, sanitized.medida);
    const existingMatch = existingMonthItems.find(
      (item) =>
        item.category === 'estribo' &&
        normalizeEstriboKey(item.bitola, item.medida) === targetKey
    );

    if (existingMatch) {
      const itemRef = doc(db, 'inventoryItems', existingMatch.id);
      try {
        await updateDoc(itemRef, {
          qtdPecas: clampNonNegative(existingMatch.qtdPecas + sanitized.qtdPecas),
          qtdPacotes: clampNonNegative(existingMatch.qtdPacotes + sanitized.qtdPacotes),
          kg: clampNonNegative(existingMatch.kg + sanitized.kg),
          notes: mergeMergedNotes(existingMatch.notes, sanitized.notes),
          updatedAt: serverTimestamp(),
        });
        return existingMatch.id;
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `inventoryItems/${existingMatch.id}`);
      }
    }
  }

  const itemId = generateItemId();
  const itemRef = doc(db, 'inventoryItems', itemId);

  try {
    await setDoc(itemRef, {
      ownerId: uid,
      monthDocId,
      monthKey,
      ...sanitized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return itemId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `inventoryItems/${itemId}`);
  }
}

export async function createInventoryItemsBatch(
  uid: string,
  monthKey: string,
  rawInputs: InventoryItemInput[],
  knownMonthExists?: boolean,
  existingMonthItems: InventoryItem[] = []
): Promise<number> {
  if (rawInputs.length === 0) return 0;

  const monthDocId = await ensureMonthRecord(uid, monthKey, knownMonthExists);
  const batch = writeBatch(db);

  const existingEstriboByKey = new Map<string, InventoryItem>();
  for (const item of existingMonthItems) {
    if (item.category === 'estribo') {
      const key = normalizeEstriboKey(item.bitola, item.medida);
      if (!existingEstriboByKey.has(key)) {
        existingEstriboByKey.set(key, item);
      }
    }
  }

  const aggregatedUpdates = new Map<
    string,
    { id: string; qtdPecas: number; qtdPacotes: number; kg: number; notes: string }
  >();
  const aggregatedCreates = new Map<string, InventoryItemInput>();
  const nonEstriboCreates: InventoryItemInput[] = [];

  for (const rawInput of rawInputs) {
    const sanitized = sanitizeItemInput(rawInput);
    if (!sanitized.bitola) {
      throw new Error('A bitola é obrigatória em todos os lançamentos.');
    }

    if (sanitized.category !== 'estribo') {
      nonEstriboCreates.push(sanitized);
      continue;
    }

    const key = normalizeEstriboKey(sanitized.bitola, sanitized.medida);
    const existing = existingEstriboByKey.get(key);
    if (existing) {
      const prev = aggregatedUpdates.get(existing.id) ?? {
        id: existing.id,
        qtdPecas: existing.qtdPecas,
        qtdPacotes: existing.qtdPacotes,
        kg: existing.kg,
        notes: existing.notes,
      };
      aggregatedUpdates.set(existing.id, {
        id: existing.id,
        qtdPecas: clampNonNegative(prev.qtdPecas + sanitized.qtdPecas),
        qtdPacotes: clampNonNegative(prev.qtdPacotes + sanitized.qtdPacotes),
        kg: clampNonNegative(prev.kg + sanitized.kg),
        notes: mergeMergedNotes(prev.notes, sanitized.notes),
      });
    } else {
      const prevCreate = aggregatedCreates.get(key);
      if (prevCreate) {
        aggregatedCreates.set(key, {
          ...prevCreate,
          qtdPecas: clampNonNegative(prevCreate.qtdPecas + sanitized.qtdPecas),
          qtdPacotes: clampNonNegative(prevCreate.qtdPacotes + sanitized.qtdPacotes),
          kg: clampNonNegative(prevCreate.kg + sanitized.kg),
          notes: mergeMergedNotes(prevCreate.notes, sanitized.notes),
        });
      } else {
        aggregatedCreates.set(key, sanitized);
      }
    }
  }

  for (const update of aggregatedUpdates.values()) {
    const itemRef = doc(db, 'inventoryItems', update.id);
    batch.update(itemRef, {
      qtdPecas: update.qtdPecas,
      qtdPacotes: update.qtdPacotes,
      kg: update.kg,
      notes: update.notes,
      updatedAt: serverTimestamp(),
    });
  }

  const allCreates = [...aggregatedCreates.values(), ...nonEstriboCreates];
  allCreates.forEach((sanitized, index) => {
    const itemId = `item_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`;
    const itemRef = doc(db, 'inventoryItems', itemId);
    batch.set(itemRef, {
      ownerId: uid,
      monthDocId,
      monthKey,
      ...sanitized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  try {
    await batch.commit();
    return rawInputs.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'inventoryItems');
  }
}

export async function updateInventoryItem(
  itemId: string,
  rawInput: InventoryItemInput,
  existingMonthItems: InventoryItem[] = []
): Promise<void> {
  const sanitized = sanitizeItemInput(rawInput);
  if (!sanitized.bitola) {
    throw new Error('A bitola é obrigatória.');
  }

  if (sanitized.category === 'estribo') {
    const targetKey = normalizeEstriboKey(sanitized.bitola, sanitized.medida);
    const otherMatch = existingMonthItems.find(
      (item) =>
        item.id !== itemId &&
        item.category === 'estribo' &&
        normalizeEstriboKey(item.bitola, item.medida) === targetKey
    );

    if (otherMatch) {
      const batch = writeBatch(db);
      const otherRef = doc(db, 'inventoryItems', otherMatch.id);
      const currentRef = doc(db, 'inventoryItems', itemId);

      batch.update(otherRef, {
        qtdPecas: clampNonNegative(otherMatch.qtdPecas + sanitized.qtdPecas),
        qtdPacotes: clampNonNegative(otherMatch.qtdPacotes + sanitized.qtdPacotes),
        kg: clampNonNegative(otherMatch.kg + sanitized.kg),
        notes: mergeMergedNotes(otherMatch.notes, sanitized.notes),
        updatedAt: serverTimestamp(),
      });
      batch.delete(currentRef);

      try {
        await batch.commit();
        return;
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `inventoryItems/${itemId}`);
      }
    }
  }

  const itemRef = doc(db, 'inventoryItems', itemId);

  try {
    await updateDoc(itemRef, {
      ...sanitized,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `inventoryItems/${itemId}`);
  }
}

export async function deleteInventoryItem(itemId: string): Promise<void> {
  const itemRef = doc(db, 'inventoryItems', itemId);
  try {
    await deleteDoc(itemRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `inventoryItems/${itemId}`);
  }
}

export async function copyMonthItems(
  uid: string,
  targetMonthKey: string,
  sourceItems: InventoryItem[],
  knownMonthExists?: boolean
): Promise<number> {
  if (sourceItems.length === 0) return 0;

  const targetMonthDocId = await ensureMonthRecord(uid, targetMonthKey, knownMonthExists);
  const batch = writeBatch(db);

  sourceItems.forEach((src, index) => {
    const itemId = `item_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`;
    const itemRef = doc(db, 'inventoryItems', itemId);
    const sanitized = sanitizeItemInput({
      category: src.category,
      bitola: src.bitola,
      medida: src.medida ?? '',
      qtdPecas: src.qtdPecas,
      qtdPacotes: src.qtdPacotes,
      unidades: src.unidades,
      qtdBarras: src.qtdBarras,
      kg: src.kg,
      measurementMode: src.measurementMode,
      hasLabel: src.hasLabel,
      labelCode: src.labelCode,
      hasScaleWeight: src.hasScaleWeight,
      scaleWeightKg: src.scaleWeightKg,
      wireType: src.wireType,
      notes: src.notes,
    });

    batch.set(itemRef, {
      ownerId: uid,
      monthDocId: targetMonthDocId,
      monthKey: targetMonthKey,
      ...sanitized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  try {
    await batch.commit();
    return sourceItems.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'inventoryItems');
  }
}
