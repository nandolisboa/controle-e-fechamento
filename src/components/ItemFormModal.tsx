import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import {
  ARAME_KG_PER_UNIT,
  ARAME_UNITS_PER_BOX,
  CATEGORIES,
  CATEGORY_MAP,
  formatArameBoxes,
  formatKg,
  formatNumber,
  getArameMetrics,
  type InventoryItem,
  type InventoryItemInput,
  MAX_BITOLA_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_MEDIDA_LENGTH,
  MAX_NOTES_LENGTH,
  type MaterialCategory,
  type MeasurementMode,
  resolveTelaPopByCode,
  TELA_POP_CATALOG,
  type WireType,
} from '../types/inventory';

interface EstriboRowDraft {
  id: string;
  qtdPecas: string;
  qtdPacotes: string;
  kg: string;
}

const ESTRIBO_DEFAULTS_KEY = 'acogestao_estribo_qty_defaults_v1';

function loadEstriboQtyDefaults(): { qtdPecas: string; qtdPacotes: string } {
  try {
    const raw = window.localStorage.getItem(ESTRIBO_DEFAULTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { qtdPecas?: unknown; qtdPacotes?: unknown };
      return {
        qtdPecas: typeof parsed.qtdPecas === 'string' ? parsed.qtdPecas : '500',
        qtdPacotes: typeof parsed.qtdPacotes === 'string' ? parsed.qtdPacotes : '10',
      };
    }
  } catch {
    // Ignore storage read errors
  }
  return { qtdPecas: '500', qtdPacotes: '10' };
}

function saveEstriboQtyDefaults(qtdPecas: string, qtdPacotes: string): void {
  try {
    window.localStorage.setItem(
      ESTRIBO_DEFAULTS_KEY,
      JSON.stringify({ qtdPecas, qtdPacotes })
    );
  } catch {
    // Ignore storage write errors
  }
}

function createEmptyEstriboRow(defaults?: {
  qtdPecas: string;
  qtdPacotes: string;
}): EstriboRowDraft {
  const qty = defaults ?? loadEstriboQtyDefaults();
  return {
    id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    qtdPecas: qty.qtdPecas,
    qtdPacotes: qty.qtdPacotes,
    kg: '',
  };
}

interface BobinaRowDraft {
  id: string;
  kg: string;
}

const BOBINA_BITOLA_KEY = 'acogestao_bobina_bitola_v1';

function loadBobinaBitolaDefault(): string {
  try {
    const raw = window.localStorage.getItem(BOBINA_BITOLA_KEY);
    if (raw && CATEGORY_MAP.bobina.bitolaPresets.includes(raw)) {
      return raw;
    }
  } catch {
    // Ignore storage read errors
  }
  return '';
}

function saveBobinaBitolaDefault(bitola: string): void {
  try {
    window.localStorage.setItem(BOBINA_BITOLA_KEY, bitola);
  } catch {
    // Ignore storage write errors
  }
}

function createEmptyBobinaRow(): BobinaRowDraft {
  return {
    id: `bobina_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    kg: '',
  };
}

interface ItemFormModalProps {
  isOpen: boolean;
  editingItem: InventoryItem | null;
  defaultCategory: MaterialCategory;
  onClose: () => void;
  onSubmit: (payload: InventoryItemInput, editingId?: string) => Promise<void>;
  onSubmitBatch?: (payloads: InventoryItemInput[]) => Promise<void>;
}

function parseNumericInput(val: string): number {
  if (!val.trim()) return 0;
  const normalized = val.replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

export function ItemFormModal({
  isOpen,
  editingItem,
  defaultCategory,
  onClose,
  onSubmit,
  onSubmitBatch,
}: ItemFormModalProps) {
  const [category, setCategory] = useState<MaterialCategory>(defaultCategory);
  const [bitola, setBitola] = useState('');
  const [medida, setMedida] = useState('');
  const [qtdPecas, setQtdPecas] = useState('');
  const [qtdPacotes, setQtdPacotes] = useState('');
  const [unidades, setUnidades] = useState('');
  const [qtdBarras, setQtdBarras] = useState('');
  const [kg, setKg] = useState('');
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>('ambos');
  const [hasLabel, setHasLabel] = useState(false);
  const [labelCode, setLabelCode] = useState('');
  const [hasScaleWeight, setHasScaleWeight] = useState(false);
  const [scaleWeightKg, setScaleWeightKg] = useState('');
  const [wireType, setWireType] = useState<WireType>('liso');
  const [arameCaixas, setArameCaixas] = useState('');
  const [arameAvulsas, setArameAvulsas] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessionAdded, setSessionAdded] = useState<string[]>([]);
  const [estriboRows, setEstriboRows] = useState<EstriboRowDraft[]>(() => [
    createEmptyEstriboRow(),
  ]);
  const estriboListRef = useRef<HTMLDivElement | null>(null);
  const [bobinaRows, setBobinaRows] = useState<BobinaRowDraft[]>(() => [
    createEmptyBobinaRow(),
  ]);
  const bobinaListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setSessionAdded([]);
    if (editingItem) {
      setCategory(editingItem.category);
      setBitola(editingItem.bitola);
      setMedida(editingItem.medida ?? '');
      setQtdPecas(editingItem.qtdPecas > 0 ? String(editingItem.qtdPecas) : '');
      setQtdPacotes(editingItem.qtdPacotes > 0 ? String(editingItem.qtdPacotes) : '');
      setUnidades(editingItem.unidades > 0 ? String(editingItem.unidades) : '');
      setQtdBarras(editingItem.qtdBarras > 0 ? String(editingItem.qtdBarras) : '');
      setKg(editingItem.kg > 0 ? String(editingItem.kg) : '');
      setMeasurementMode(editingItem.measurementMode);
      setHasLabel(editingItem.hasLabel);
      setLabelCode(editingItem.labelCode);
      setHasScaleWeight(editingItem.hasScaleWeight);
      setScaleWeightKg(editingItem.scaleWeightKg > 0 ? String(editingItem.scaleWeightKg) : '');
      setWireType(editingItem.wireType === 'none' ? 'liso' : editingItem.wireType);
      if (editingItem.category === 'arame') {
        const metrics = getArameMetrics(
          editingItem.unidades,
          editingItem.kg,
          editingItem.measurementMode
        );
        if (metrics.isVariedCoil) {
          setMeasurementMode('kg');
          setUnidades(metrics.unidades > 0 ? String(metrics.unidades) : '1');
          setKg(metrics.kg > 0 ? String(metrics.kg) : '');
          setArameCaixas('');
          setArameAvulsas('');
        } else {
          setMeasurementMode('ambos');
          setUnidades(metrics.unidades > 0 ? String(metrics.unidades) : '');
          setKg(metrics.kg > 0 ? String(metrics.kg) : '');
          setArameCaixas(metrics.caixas > 0 ? String(metrics.caixas) : '');
          setArameAvulsas(metrics.avulsas > 0 ? String(metrics.avulsas) : '');
        }
      } else {
        setArameCaixas('');
        setArameAvulsas('');
      }
      setNotes(editingItem.notes);
      setEstriboRows([createEmptyEstriboRow()]);
      setBobinaRows([createEmptyBobinaRow()]);
    } else {
      setCategory(defaultCategory);
      setBitola(defaultCategory === 'bobina' ? loadBobinaBitolaDefault() : '');
      setMedida('');
      setQtdPecas('');
      setQtdPacotes('');
      setUnidades('');
      setQtdBarras('');
      setKg('');
      setMeasurementMode(
        defaultCategory === 'barra'
          ? 'barras'
          : 'ambos'
      );
      setHasLabel(false);
      setLabelCode('');
      setHasScaleWeight(false);
      setScaleWeightKg('');
      setWireType('liso');
      setArameCaixas('');
      setArameAvulsas('');
      setNotes('');
      setEstriboRows([createEmptyEstriboRow()]);
      setBobinaRows([createEmptyBobinaRow()]);
    }
  }, [isOpen, editingItem, defaultCategory]);

  if (!isOpen) return null;

  const activeCategoryMeta = CATEGORY_MAP[category];

  function handleCategoryChange(nextCat: MaterialCategory) {
    setCategory(nextCat);
    setErrorMsg(null);
    if (nextCat === 'bobina') {
      const savedBitola = loadBobinaBitolaDefault();
      if (savedBitola) {
        setBitola(savedBitola);
      } else if (!CATEGORY_MAP.bobina.bitolaPresets.includes(bitola)) {
        setBitola('');
      }
    } else if (!CATEGORY_MAP[nextCat].bitolaPresets.includes(bitola)) {
      setBitola('');
    }
    if (nextCat === 'barra') {
      setMeasurementMode('barras');
    } else if (nextCat === 'arame') {
      setMeasurementMode('ambos');
      if (wireType === 'none') setWireType('liso');
    } else {
      setMeasurementMode('ambos');
    }
  }

  function buildValidatedPayload(): InventoryItemInput | null {
    if (!bitola.trim()) {
      setErrorMsg(
        category === 'tela_pop'
          ? 'Selecione o código da tela.'
          : 'Selecione a bitola do material.'
      );
      return null;
    }

    const parsedPecas = category === 'estribo' ? parseNumericInput(qtdPecas) : 0;
    const parsedPacotes = category === 'estribo' ? parseNumericInput(qtdPacotes) : 0;
    const parsedUnidades =
      category === 'bobina' || category === 'tela_pop' || category === 'arame'
        ? parseNumericInput(unidades)
        : 0;
    const parsedBarras = category === 'barra' ? parseNumericInput(qtdBarras) : 0;
    const parsedKg = category !== 'tela_pop' ? parseNumericInput(kg) : 0;
    const parsedScaleKg =
      category === 'barra' && hasScaleWeight ? parseNumericInput(scaleWeightKg) : 0;

    if (category === 'estribo') {
      if (!medida.trim()) {
        setErrorMsg('Informe a medida do estribo.');
        return null;
      }
      if (parsedPecas <= 0) {
        setErrorMsg('Informe a Qtd. Peças do estribo.');
        return null;
      }
      if (parsedPacotes <= 0) {
        setErrorMsg('Informe a Qtd. Pacotes do estribo.');
        return null;
      }
      if (parsedKg <= 0) {
        setErrorMsg('Informe o peso (Kg) do estribo.');
        return null;
      }
    }

    if (category === 'bobina') {
      if (parsedUnidades <= 0) {
        setErrorMsg('Informe a quantidade de unidades da bobina.');
        return null;
      }
      if (parsedKg <= 0) {
        setErrorMsg('Informe o peso (Kg) da bobina.');
        return null;
      }
    }

    if (category === 'barra') {
      if ((measurementMode === 'barras' || measurementMode === 'ambos') && parsedBarras <= 0) {
        setErrorMsg('Informe a Qtd. Barras.');
        return null;
      }
      if ((measurementMode === 'kg' || measurementMode === 'ambos') && parsedKg <= 0) {
        setErrorMsg('Informe o peso (Kg) das barras.');
        return null;
      }
      if (hasLabel && !labelCode.trim()) {
        setErrorMsg('Informe o número ou código da etiqueta.');
        return null;
      }
      if (hasScaleWeight && parsedScaleKg <= 0) {
        setErrorMsg('Informe o peso da balança em Kg.');
        return null;
      }
    }

    if (category === 'tela_pop' && parsedUnidades <= 0) {
      setErrorMsg('Informe a quantidade de telas.');
      return null;
    }

    const isArameVariedCoil = category === 'arame' && measurementMode === 'kg';
    const arameTotalUnits =
      category === 'arame' && !isArameVariedCoil
        ? parsedUnidades > 0
          ? parsedUnidades
          : parsedKg
        : 0;

    if (category === 'arame') {
      if (isArameVariedCoil) {
        if (parsedUnidades <= 0) {
          setErrorMsg('Informe a quantidade de bobinas de arame.');
          return null;
        }
        if (parsedKg <= 0) {
          setErrorMsg('Informe o peso (Kg) da bobina de arame.');
          return null;
        }
      } else if (arameTotalUnits <= 0) {
        setErrorMsg('Informe a quantidade de caixas ou unidades do arame.');
        return null;
      }
    }

    return {
      category,
      bitola: bitola.trim().slice(0, MAX_BITOLA_LENGTH),
      medida: category === 'estribo' ? medida.trim().slice(0, MAX_MEDIDA_LENGTH) : '',
      qtdPecas: parsedPecas,
      qtdPacotes: parsedPacotes,
      unidades:
        category === 'arame'
          ? isArameVariedCoil
            ? parsedUnidades
            : arameTotalUnits
          : parsedUnidades,
      qtdBarras:
        category === 'barra' && measurementMode === 'kg' ? 0 : parsedBarras,
      kg:
        category === 'arame'
          ? isArameVariedCoil
            ? parsedKg
            : arameTotalUnits * ARAME_KG_PER_UNIT
          : category === 'barra' && measurementMode === 'barras'
            ? 0
            : parsedKg,
      measurementMode: category === 'arame' ? (isArameVariedCoil ? 'kg' : 'ambos') : measurementMode,
      hasLabel: category === 'barra' ? hasLabel : false,
      labelCode: category === 'barra' && hasLabel ? labelCode.trim().slice(0, MAX_LABEL_LENGTH) : '',
      hasScaleWeight: category === 'barra' ? hasScaleWeight : false,
      scaleWeightKg: parsedScaleKg,
      wireType: category === 'arame' ? (wireType === 'none' ? 'liso' : wireType) : 'none',
      notes: notes.trim().slice(0, MAX_NOTES_LENGTH),
    };
  }

  function formatAddedSummary(payload: InventoryItemInput): string {
    const label = CATEGORY_MAP[payload.category].label;
    if (payload.category === 'estribo') {
      const parts = [label, payload.bitola];
      if (payload.medida) parts.push(payload.medida);
      parts.push(`${formatNumber(payload.qtdPecas)} pçs`, `${formatNumber(payload.qtdPacotes)} pcts`, formatKg(payload.kg));
      return parts.join(' · ');
    }
    if (payload.category === 'bobina') {
      return `${label} · ${payload.bitola} · ${formatNumber(payload.unidades)} un · ${formatKg(payload.kg)}`;
    }
    if (payload.category === 'barra') {
      const parts = [label, payload.bitola];
      if (payload.qtdBarras > 0) parts.push(`${formatNumber(payload.qtdBarras)} barras`);
      if (payload.kg > 0) parts.push(formatKg(payload.kg));
      if (payload.hasScaleWeight) parts.push(`Balança ${formatKg(payload.scaleWeightKg)}`);
      return parts.join(' · ');
    }
    if (payload.category === 'tela_pop') {
      const resolvedTela = resolveTelaPopByCode(payload.bitola);
      const telaLabel = resolvedTela
        ? `${resolvedTela.code} · ${resolvedTela.nome}`
        : payload.bitola;
      return `${label} · ${telaLabel} · ${formatNumber(payload.unidades)} un`;
    }
    const wire = payload.wireType === 'liso' ? 'Liso' : 'Torcido';
    const arameParts =
      payload.measurementMode === 'kg'
        ? [
            `${label} ${wire}`,
            payload.bitola,
            `Bobina (${formatNumber(payload.unidades)} un)`,
            formatKg(payload.kg),
          ]
        : [
            `${label} ${wire}`,
            payload.bitola,
            formatArameBoxes(payload.unidades),
            `${formatNumber(payload.unidades)} un`,
            formatKg(payload.kg),
          ];
    return arameParts.join(' · ');
  }

  function resetFieldsForNextEntry() {
    setMedida('');
    setQtdPecas('');
    setQtdPacotes('');
    setUnidades(category === 'arame' && measurementMode === 'kg' ? '1' : '');
    setQtdBarras('');
    setKg('');
    setArameCaixas('');
    setArameAvulsas('');
    setHasLabel(false);
    setLabelCode('');
    setHasScaleWeight(false);
    setScaleWeightKg('');
    setNotes('');
  }

  async function handleAddAnother() {
    setErrorMsg(null);
    const payload = buildValidatedPayload();
    if (!payload) return;

    setSubmitting(true);
    try {
      await onSubmit(payload);
      setSessionAdded((prev) => [...prev, formatAddedSummary(payload)]);
      resetFieldsForNextEntry();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao adicionar lançamento.');
    } finally {
      setSubmitting(false);
    }
  }

  const isEstriboMultiMode = category === 'estribo' && !editingItem;
  const isBobinaMultiMode = category === 'bobina' && !editingItem;

  function handleSelectBitolaPreset(preset: string) {
    setBitola(preset);
    if (category === 'bobina' && !editingItem) {
      saveBobinaBitolaDefault(preset);
    }
  }

  function handleAddEstriboRow() {
    setErrorMsg(null);
    const lastRow = estriboRows[estriboRows.length - 1];
    const defaults = lastRow
      ? { qtdPecas: lastRow.qtdPecas, qtdPacotes: lastRow.qtdPacotes }
      : loadEstriboQtyDefaults();
    saveEstriboQtyDefaults(defaults.qtdPecas, defaults.qtdPacotes);
    setEstriboRows((prev) => [...prev, createEmptyEstriboRow(defaults)]);
    window.requestAnimationFrame(() => {
      if (estriboListRef.current) {
        estriboListRef.current.scrollTop = estriboListRef.current.scrollHeight;
      }
    });
  }

  function handleUpdateEstriboRow(
    rowId: string,
    field: keyof Omit<EstriboRowDraft, 'id'>,
    value: string
  ) {
    setEstriboRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const nextRow = { ...row, [field]: value };
        if (field === 'qtdPecas' || field === 'qtdPacotes') {
          saveEstriboQtyDefaults(nextRow.qtdPecas, nextRow.qtdPacotes);
        }
        return nextRow;
      })
    );
  }

  function handleRemoveEstriboRow(rowId: string) {
    setEstriboRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== rowId) : prev));
  }

  function handleAddBobinaRow() {
    setErrorMsg(null);
    setBobinaRows((prev) => [...prev, createEmptyBobinaRow()]);
    window.requestAnimationFrame(() => {
      if (bobinaListRef.current) {
        bobinaListRef.current.scrollTop = bobinaListRef.current.scrollHeight;
      }
    });
  }

  function handleUpdateBobinaRow(rowId: string, value: string) {
    setBobinaRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, kg: value } : row))
    );
  }

  function handleRemoveBobinaRow(rowId: string) {
    setBobinaRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== rowId) : prev));
  }

  function handleArameCaixasChange(nextCaixas: string) {
    setArameCaixas(nextCaixas);
    const caixasNum = parseNumericInput(nextCaixas);
    const avulsasNum = parseNumericInput(arameAvulsas);
    const total = caixasNum * ARAME_UNITS_PER_BOX + avulsasNum;
    setUnidades(total > 0 ? String(total) : '');
    setKg(total > 0 ? String(total * ARAME_KG_PER_UNIT) : '');
  }

  function handleArameAvulsasChange(nextAvulsas: string) {
    setArameAvulsas(nextAvulsas);
    const caixasNum = parseNumericInput(arameCaixas);
    const avulsasNum = parseNumericInput(nextAvulsas);
    const total = caixasNum * ARAME_UNITS_PER_BOX + avulsasNum;
    setUnidades(total > 0 ? String(total) : '');
    setKg(total > 0 ? String(total * ARAME_KG_PER_UNIT) : '');
  }

  function handleArameTotalChange(nextTotal: string) {
    setUnidades(nextTotal);
    setKg(nextTotal);
    const total = parseNumericInput(nextTotal);
    if (total <= 0) {
      setArameCaixas('');
      setArameAvulsas('');
      return;
    }
    const caixasNum = Math.floor(total / ARAME_UNITS_PER_BOX);
    const avulsasNum = Math.round((total - caixasNum * ARAME_UNITS_PER_BOX) * 100) / 100;
    setArameCaixas(caixasNum > 0 ? String(caixasNum) : '');
    setArameAvulsas(avulsasNum > 0 ? String(avulsasNum) : '');
  }

  const hasCurrentEntryValues =
    bitola.trim().length > 0 ||
    medida.trim().length > 0 ||
    qtdPecas.trim().length > 0 ||
    qtdPacotes.trim().length > 0 ||
    unidades.trim().length > 0 ||
    arameCaixas.trim().length > 0 ||
    arameAvulsas.trim().length > 0 ||
    qtdBarras.trim().length > 0 ||
    kg.trim().length > 0 ||
    scaleWeightKg.trim().length > 0;

  async function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (isBobinaMultiMode) {
      const selectedBitola = bitola.trim().slice(0, MAX_BITOLA_LENGTH);
      if (!selectedBitola) {
        setErrorMsg('Selecione a bitola da bobina.');
        return;
      }

      const payloads: InventoryItemInput[] = [];
      for (let i = 0; i < bobinaRows.length; i += 1) {
        const rowKg = parseNumericInput(bobinaRows[i].kg);
        if (rowKg <= 0) {
          setErrorMsg(`Informe o peso (Kg) da bobina #${i + 1}.`);
          return;
        }
        payloads.push({
          category: 'bobina',
          bitola: selectedBitola,
          medida: '',
          qtdPecas: 0,
          qtdPacotes: 0,
          unidades: 1,
          qtdBarras: 0,
          kg: rowKg,
          measurementMode: 'ambos',
          hasLabel: false,
          labelCode: '',
          hasScaleWeight: false,
          scaleWeightKg: 0,
          wireType: 'none',
          notes: notes.trim().slice(0, MAX_NOTES_LENGTH),
        });
      }

      setSubmitting(true);
      try {
        if (onSubmitBatch) {
          await onSubmitBatch(payloads);
        } else {
          for (const p of payloads) {
            await onSubmit(p);
          }
        }
        onClose();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar bobinas.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (isEstriboMultiMode) {
      const selectedBitola = bitola.trim().slice(0, MAX_BITOLA_LENGTH);
      if (!selectedBitola) {
        setErrorMsg('Selecione a bitola do material.');
        return;
      }

      const selectedMedida = medida.trim().slice(0, MAX_MEDIDA_LENGTH);
      if (!selectedMedida) {
        setErrorMsg('Informe a medida do estribo.');
        return;
      }

      const payloads: InventoryItemInput[] = [];
      for (let i = 0; i < estriboRows.length; i += 1) {
        const row = estriboRows[i];
        const rowPecas = parseNumericInput(row.qtdPecas);
        const rowPacotes = parseNumericInput(row.qtdPacotes);
        const rowKg = parseNumericInput(row.kg);

        if (rowPecas <= 0) {
          setErrorMsg(`Informe a Qtd. Peças no lançamento #${i + 1}.`);
          return;
        }
        if (rowPacotes <= 0) {
          setErrorMsg(`Informe a Qtd. Pacotes no lançamento #${i + 1}.`);
          return;
        }
        if (rowKg <= 0) {
          setErrorMsg(`Informe o peso (Kg) no lançamento #${i + 1}.`);
          return;
        }

        payloads.push({
          category: 'estribo',
          bitola: selectedBitola,
          medida: selectedMedida,
          qtdPecas: rowPecas,
          qtdPacotes: rowPacotes,
          unidades: 0,
          qtdBarras: 0,
          kg: rowKg,
          measurementMode: 'ambos',
          hasLabel: false,
          labelCode: '',
          hasScaleWeight: false,
          scaleWeightKg: 0,
          wireType: 'none',
          notes: notes.trim().slice(0, MAX_NOTES_LENGTH),
        });
      }

      setSubmitting(true);
      try {
        if (onSubmitBatch) {
          await onSubmitBatch(payloads);
        } else {
          for (const p of payloads) {
            await onSubmit(p);
          }
        }
        onClose();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar lançamentos.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!editingItem && sessionAdded.length > 0 && !hasCurrentEntryValues) {
      onClose();
      return;
    }

    const payload = buildValidatedPayload();
    if (!payload) return;

    setSubmitting(true);
    try {
      await onSubmit(payload, editingItem?.id);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar lançamento.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-item-title"
    >
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden my-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 id="modal-item-title" className="font-display text-lg font-semibold text-slate-900">
              {editingItem ? `Editar ${activeCategoryMeta.label}` : 'Novo lançamento no estoque'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeCategoryMeta.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} noValidate className="p-6 space-y-5">
          {!editingItem && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                Categoria do material
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 bg-slate-100 rounded-lg">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryChange(cat.id)}
                    className={`px-2.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      category === cat.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat.shortLabel}
                  </button>
                ))}
              </div>
            </div>
          )}

          {category === 'arame' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                Tipo de arame
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setWireType('liso')}
                  className={`py-2 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    wireType === 'liso'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Liso
                </button>
                <button
                  type="button"
                  onClick={() => setWireType('torcido')}
                  className={`py-2 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    wireType === 'torcido'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Torcido
                </button>
              </div>
            </div>
          )}

          {category === 'tela_pop' ? (() => {
            const identifiedTela = resolveTelaPopByCode(bitola);
            const hasCustomEditingBitola =
              Boolean(editingItem?.bitola) &&
              !TELA_POP_CATALOG.some((spec) => spec.presetValue === editingItem?.bitola);

            return (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-2">
                    Bitola / Código da tela *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {hasCustomEditingBitola && editingItem && (
                      <button
                        key={editingItem.bitola}
                        type="button"
                        onClick={() => handleSelectBitolaPreset(editingItem.bitola)}
                        className={`px-3 py-2 text-left rounded-lg border transition-colors cursor-pointer ${
                          bitola === editingItem.bitola
                            ? 'border-orange-600 bg-orange-50 text-orange-900'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-xs font-semibold font-mono-num">
                          {editingItem.bitola}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Código personalizado
                        </div>
                      </button>
                    )}
                    {TELA_POP_CATALOG.map((spec) => {
                      const isSelected =
                        bitola === spec.presetValue || identifiedTela?.code === spec.code;
                      return (
                        <button
                          key={spec.code}
                          type="button"
                          onClick={() => handleSelectBitolaPreset(spec.presetValue)}
                          className={`px-3 py-2 text-left rounded-lg border transition-colors cursor-pointer ${
                            isSelected
                              ? 'border-orange-600 bg-orange-50 text-orange-900'
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold font-mono-num">
                              {spec.presetValue}
                            </span>
                            <span
                              className={`text-[11px] font-medium ${
                                isSelected ? 'text-orange-700' : 'text-slate-500'
                              }`}
                            >
                              {spec.shortNome}
                            </span>
                          </div>
                          <div
                            className={`text-[11px] mt-0.5 font-mono-num ${
                              isSelected ? 'text-orange-800/80' : 'text-slate-500'
                            }`}
                          >
                            {spec.nome} · Malha {spec.malha}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {identifiedTela && (
                  <div className="px-3.5 py-2.5 rounded-lg border border-orange-200 bg-orange-50/60">
                    <div className="text-xs font-semibold text-slate-900">
                      {identifiedTela.nome} ({identifiedTela.code})
                    </div>
                    <div className="text-xs text-slate-600 font-mono-num mt-0.5">
                      Fio {identifiedTela.fio} · Malha {identifiedTela.malha} · Painel {identifiedTela.painel}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Aplicação: {identifiedTela.uso}
                    </div>
                  </div>
                )}
              </div>
            );
          })() : (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                Bitola *
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(editingItem &&
                editingItem.bitola &&
                !activeCategoryMeta.bitolaPresets.includes(editingItem.bitola)
                  ? [editingItem.bitola, ...activeCategoryMeta.bitolaPresets]
                  : activeCategoryMeta.bitolaPresets
                ).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSelectBitolaPreset(preset)}
                    className={`px-2.5 py-1.5 text-xs font-mono-num rounded-md border transition-colors cursor-pointer whitespace-nowrap ${
                      bitola === preset
                        ? 'border-orange-600 bg-orange-50 text-orange-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          )}

          {category === 'estribo' && (
            <div>
              <label htmlFor="field-medida-estribo" className="block text-xs font-medium text-slate-700 mb-1.5">
                Medida do estribo *
              </label>
              <input
                id="field-medida-estribo"
                type="text"
                maxLength={MAX_MEDIDA_LENGTH}
                value={medida}
                onChange={(e) => setMedida(e.target.value)}
                placeholder="Ex: 7x17, 9x15, 12x25 cm"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
              />
            </div>
          )}

          {category === 'estribo' && !editingItem && (() => {
            const totalPecasPreview = estriboRows.reduce(
              (acc, r) => acc + parseNumericInput(r.qtdPecas),
              0
            );
            const totalPacotesPreview = estriboRows.reduce(
              (acc, r) => acc + parseNumericInput(r.qtdPacotes),
              0
            );
            const totalKgPreview = estriboRows.reduce(
              (acc, r) => acc + parseNumericInput(r.kg),
              0
            );

            return (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-medium text-slate-700">
                      Lançamentos ({estriboRows.length})
                    </span>
                    {(totalPecasPreview > 0 || totalPacotesPreview > 0 || totalKgPreview > 0) && (
                      <span className="ml-2 text-xs text-slate-500 font-mono-num">
                        {formatNumber(totalPecasPreview)} pçs · {formatNumber(totalPacotesPreview)} pcts · {formatKg(totalKgPreview)}
                      </span>
                    )}
                  </div>
                </div>

                <div ref={estriboListRef} className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {estriboRows.map((row, index) => (
                    <div
                      key={row.id}
                      className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2.5"
                    >
                      {estriboRows.length > 1 && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveEstriboRow(row.id)}
                            aria-label={`Remover lançamento ${index + 1}`}
                            className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label
                            htmlFor={`row-pecas-${row.id}`}
                            className="block text-[11px] font-medium text-slate-600 mb-1"
                          >
                            Qtd. Peças *
                          </label>
                          <input
                            id={`row-pecas-${row.id}`}
                            type="number"
                            min="0"
                            step="1"
                            value={row.qtdPecas}
                            onChange={(e) =>
                              handleUpdateEstriboRow(row.id, 'qtdPecas', e.target.value)
                            }
                            placeholder="0"
                            className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`row-pacotes-${row.id}`}
                            className="block text-[11px] font-medium text-slate-600 mb-1"
                          >
                            Qtd. Pacotes *
                          </label>
                          <input
                            id={`row-pacotes-${row.id}`}
                            type="number"
                            min="0"
                            step="1"
                            value={row.qtdPacotes}
                            onChange={(e) =>
                              handleUpdateEstriboRow(row.id, 'qtdPacotes', e.target.value)
                            }
                            placeholder="0"
                            className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`row-kg-${row.id}`}
                            className="block text-[11px] font-medium text-slate-600 mb-1"
                          >
                            Kg *
                          </label>
                          <input
                            id={`row-kg-${row.id}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.kg}
                            onChange={(e) =>
                              handleUpdateEstriboRow(row.id, 'kg', e.target.value)
                            }
                            placeholder="0.00"
                            className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleAddEstriboRow}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-orange-600 bg-orange-50 hover:bg-orange-100 disabled:opacity-50 text-xs font-semibold text-orange-800 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>Adicionar</span>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })()}

          {category === 'estribo' && editingItem && (
            <div className="space-y-4">

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="field-pecas" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Qtd. Peças *
                  </label>
                  <input
                    id="field-pecas"
                    type="number"
                    min="0"
                    step="1"
                    value={qtdPecas}
                    onChange={(e) => setQtdPecas(e.target.value)}
                    placeholder="0"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                  />
                </div>
                <div>
                  <label htmlFor="field-pacotes" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Qtd. Pacotes *
                  </label>
                  <input
                    id="field-pacotes"
                    type="number"
                    min="0"
                    step="1"
                    value={qtdPacotes}
                    onChange={(e) => setQtdPacotes(e.target.value)}
                    placeholder="0"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                  />
                </div>
                <div>
                  <label htmlFor="field-kg-estribo" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Kg *
                  </label>
                  <input
                    id="field-kg-estribo"
                    type="number"
                    min="0"
                    step="0.01"
                    value={kg}
                    onChange={(e) => setKg(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                  />
                </div>
              </div>
            </div>
          )}

          {category === 'bobina' && !editingItem && (() => {
            const totalBobinaKgPreview = bobinaRows.reduce(
              (acc, r) => acc + parseNumericInput(r.kg),
              0
            );

            return (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-medium text-slate-700">
                      Bobinas por unidade ({bobinaRows.length})
                    </span>
                    {totalBobinaKgPreview > 0 && (
                      <span className="ml-2 text-xs text-slate-500 font-mono-num">
                        {formatNumber(bobinaRows.length)} un · {formatKg(totalBobinaKgPreview)}
                      </span>
                    )}
                  </div>
                </div>

                <div ref={bobinaListRef} className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {bobinaRows.map((row, index) => (
                    <div
                      key={row.id}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 flex items-end gap-3"
                    >
                      <div className="pb-2 text-xs font-medium text-slate-600 font-mono-num whitespace-nowrap">
                        #{index + 1} · 1 un
                      </div>
                      <div className="flex-1">
                        <label
                          htmlFor={`bobina-kg-${row.id}`}
                          className="block text-[11px] font-medium text-slate-600 mb-1"
                        >
                          Peso (Kg) *
                        </label>
                        <input
                          id={`bobina-kg-${row.id}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.kg}
                          onChange={(e) => handleUpdateBobinaRow(row.id, e.target.value)}
                          placeholder="0.00"
                          className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                        />
                      </div>
                      {bobinaRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBobinaRow(row.id)}
                          aria-label={`Remover bobina ${index + 1}`}
                          className="mb-1 p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleAddBobinaRow}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-orange-600 bg-orange-50 hover:bg-orange-100 disabled:opacity-50 text-xs font-semibold text-orange-800 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>Adicionar</span>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })()}

          {category === 'bobina' && editingItem && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="field-unid-bobina" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Unidade (qtd.) *
                </label>
                <input
                  id="field-unid-bobina"
                  type="number"
                  min="0"
                  step="1"
                  value={unidades}
                  onChange={(e) => setUnidades(e.target.value)}
                  placeholder="0"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                />
              </div>
              <div>
                <label htmlFor="field-kg-bobina" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Peso (Kg) *
                </label>
                <input
                  id="field-kg-bobina"
                  type="number"
                  min="0"
                  step="0.01"
                  value={kg}
                  onChange={(e) => setKg(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                />
              </div>
            </div>
          )}

          {category === 'barra' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Forma de medição principal
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setMeasurementMode('barras')}
                    className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      measurementMode === 'barras'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Qtd. Barras
                  </button>
                  <button
                    type="button"
                    onClick={() => setMeasurementMode('kg')}
                    className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      measurementMode === 'kg'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Kg
                  </button>
                  <button
                    type="button"
                    onClick={() => setMeasurementMode('ambos')}
                    className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      measurementMode === 'ambos'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Ambos
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(measurementMode === 'barras' || measurementMode === 'ambos') && (
                  <div>
                    <label htmlFor="field-barras" className="block text-xs font-medium text-slate-700 mb-1.5">
                      Qtd. Barras *
                    </label>
                    <input
                      id="field-barras"
                      type="number"
                      min="0"
                      step="1"
                      value={qtdBarras}
                      onChange={(e) => setQtdBarras(e.target.value)}
                      placeholder="0"
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                    />
                  </div>
                )}

                {(measurementMode === 'kg' || measurementMode === 'ambos') && (
                  <div>
                    <label htmlFor="field-kg-barra" className="block text-xs font-medium text-slate-700 mb-1.5">
                      Peso (Kg) *
                    </label>
                    <input
                      id="field-kg-barra"
                      type="number"
                      min="0"
                      step="0.01"
                      value={kg}
                      onChange={(e) => setKg(e.target.value)}
                      placeholder="0.00"
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                    />
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 text-sm font-medium text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasLabel}
                      onChange={(e) => setHasLabel(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-600"
                    />
                    <span>Possui etiqueta</span>
                  </label>
                  {hasLabel && (
                    <input
                      type="text"
                      maxLength={MAX_LABEL_LENGTH}
                      value={labelCode}
                      onChange={(e) => setLabelCode(e.target.value)}
                      placeholder="Nº / Código da etiqueta (opcional)"
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 text-sm font-medium text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasScaleWeight}
                      onChange={(e) => setHasScaleWeight(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-600"
                    />
                    <span>Pesado na balança</span>
                  </label>
                  {hasScaleWeight && (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={scaleWeightKg}
                      onChange={(e) => setScaleWeightKg(e.target.value)}
                      placeholder="Peso da balança (Kg)"
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {category === 'tela_pop' && (
            <div>
              <label htmlFor="field-tela-qtd" className="block text-xs font-medium text-slate-700 mb-1.5">
                Quantidade (telas / painéis) *
              </label>
              <input
                id="field-tela-qtd"
                type="number"
                min="0"
                step="1"
                value={unidades}
                onChange={(e) => setUnidades(e.target.value)}
                placeholder="0"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
              />
            </div>
          )}

          {category === 'arame' && (() => {
            const isVariedCoil = measurementMode === 'kg';
            const totalUnits = parseNumericInput(unidades);
            const totalKg = totalUnits * ARAME_KG_PER_UNIT;

            return (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Formato do arame
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setMeasurementMode('ambos');
                        setUnidades('');
                        setKg('');
                        setArameCaixas('');
                        setArameAvulsas('');
                        setErrorMsg(null);
                      }}
                      className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        !isVariedCoil
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Caixa / Unidade (1 kg)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMeasurementMode('kg');
                        setUnidades('1');
                        setKg('');
                        setArameCaixas('');
                        setArameAvulsas('');
                        setErrorMsg(null);
                      }}
                      className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        isVariedCoil
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Bobina (Kg variado)
                    </button>
                  </div>
                </div>

                {isVariedCoil ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="field-arame-bobinas" className="block text-xs font-medium text-slate-700 mb-1.5">
                          Qtd. Bobinas *
                        </label>
                        <input
                          id="field-arame-bobinas"
                          type="number"
                          min="1"
                          step="1"
                          value={unidades}
                          onChange={(e) => setUnidades(e.target.value)}
                          placeholder="1"
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                        />
                      </div>

                      <div>
                        <label htmlFor="field-arame-bobina-kg" className="block text-xs font-medium text-slate-700 mb-1.5">
                          Peso (Kg) *
                        </label>
                        <input
                          id="field-arame-bobina-kg"
                          type="number"
                          min="0"
                          step="0.01"
                          value={kg}
                          onChange={(e) => setKg(e.target.value)}
                          placeholder="0.00"
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                        />
                      </div>
                    </div>

                    <div className="px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-600">
                      Bobina de arame com peso livre (não segue o padrão de 1 kg/un em caixa de 20 kg).
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="field-arame-caixas" className="block text-xs font-medium text-slate-700 mb-1.5">
                          Caixas fechadas (20 kg)
                        </label>
                        <input
                          id="field-arame-caixas"
                          type="number"
                          min="0"
                          step="1"
                          value={arameCaixas}
                          onChange={(e) => handleArameCaixasChange(e.target.value)}
                          placeholder="0"
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                        />
                      </div>

                      <div>
                        <label htmlFor="field-arame-avulsas" className="block text-xs font-medium text-slate-700 mb-1.5">
                          Unidades avulsas (1 kg)
                        </label>
                        <input
                          id="field-arame-avulsas"
                          type="number"
                          min="0"
                          step="1"
                          value={arameAvulsas}
                          onChange={(e) => handleArameAvulsasChange(e.target.value)}
                          placeholder="0"
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                        />
                      </div>

                      <div>
                        <label htmlFor="field-arame-total" className="block text-xs font-medium text-slate-700 mb-1.5">
                          Total (Unidades / Kg) *
                        </label>
                        <input
                          id="field-arame-total"
                          type="number"
                          min="0"
                          step="1"
                          value={unidades}
                          onChange={(e) => handleArameTotalChange(e.target.value)}
                          placeholder="0"
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                        />
                      </div>
                    </div>

                    <div className="px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-600 space-y-0.5">
                      <div>
                        Padrão: <span className="font-mono-num font-medium text-slate-800">1 unidade = 1 kg</span> ·{' '}
                        <span className="font-mono-num font-medium text-slate-800">20 unidades = 1 caixa (20 kg)</span>
                      </div>
                      {totalUnits > 0 && (
                        <div className="font-mono-num font-medium text-orange-800">
                          Equivalente: {formatArameBoxes(totalUnits)} · {formatNumber(totalUnits)} un · {formatKg(totalKg)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {!editingItem && category !== 'estribo' && category !== 'bobina' && (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={submitting}
                onClick={handleAddAnother}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-orange-600 bg-orange-50 hover:bg-orange-100 disabled:opacity-50 text-xs font-semibold text-orange-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>Adicionar</span>
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {sessionAdded.length > 0 && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="text-xs font-medium text-slate-700">
                Adicionados nesta sessão ({sessionAdded.length})
              </div>
              <ul className="space-y-1 max-h-28 overflow-y-auto">
                {sessionAdded.map((entry, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 text-xs text-slate-600 font-mono-num"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">{entry}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label htmlFor="field-notes" className="block text-xs font-medium text-slate-700 mb-1.5">
              Observações (opcional)
            </label>
            <input
              id="field-notes"
              type="text"
              maxLength={MAX_NOTES_LENGTH}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Lote, local no pátio ou observação da contagem"
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
            />
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"
            >
              {errorMsg}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {sessionAdded.length > 0 ? 'Fechar' : 'Cancelar'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 px-5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              {submitting
                ? 'Salvando...'
                : editingItem
                  ? 'Salvar alterações'
                  : isEstriboMultiMode
                    ? `Finalizar e salvar (${estriboRows.length})`
                    : isBobinaMultiMode
                      ? `Finalizar e salvar (${bobinaRows.length})`
                      : sessionAdded.length > 0 && !hasCurrentEntryValues
                        ? 'Finalizar'
                        : 'Adicionar ao estoque'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
