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
  MAX_NOTA_FISCAL_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_NUMERIC_VALUE,
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

type BobinaWeightSource = 'etiqueta' | 'balanca' | 'ambos';
type BarraWeightSource = 'etiqueta' | 'balanca' | 'ambos' | 'none';

interface BobinaRowDraft {
  id: string;
  source: BobinaWeightSource;
  kg: string;
  scaleWeightKg: string;
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

function createEmptyBobinaRow(source: BobinaWeightSource = 'etiqueta'): BobinaRowDraft {
  return {
    id: `bobina_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    source,
    kg: '',
    scaleWeightKg: '',
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
  const [materialName, setMaterialName] = useState('');
  const [materialQty, setMaterialQty] = useState('');
  const [kgPorUnidade, setKgPorUnidade] = useState('');
  const [bitola, setBitola] = useState('');
  const [medida, setMedida] = useState('');
  const [qtdPecas, setQtdPecas] = useState('');
  const [qtdPacotes, setQtdPacotes] = useState('');
  const [unidades, setUnidades] = useState('');
  const [qtdBarras, setQtdBarras] = useState('');
  const [kg, setKg] = useState('');
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>('ambos');
  const [labelCode, setLabelCode] = useState('');
  const [scaleWeightKg, setScaleWeightKg] = useState('');
  const [wireType, setWireType] = useState<WireType>('liso');
  const [bobinaSource, setBobinaSource] = useState<BobinaWeightSource>('etiqueta');
  const [barraSource, setBarraSource] = useState<BarraWeightSource>('etiqueta');
  const [arameCaixas, setArameCaixas] = useState('');
  const [arameAvulsas, setArameAvulsas] = useState('');
  const [notaFiscal, setNotaFiscal] = useState('');
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
      setMaterialName(editingItem.materialName ?? '');
      setMaterialQty(editingItem.category === 'outros_materiais' && editingItem.unidades > 0 ? String(editingItem.unidades) : '');
      setKgPorUnidade(editingItem.category === 'outros_materiais' && (editingItem.kgPorUnidade ?? 0) > 0 ? String(editingItem.kgPorUnidade) : '');
      setBitola(editingItem.bitola);
      setMedida(editingItem.medida ?? '');
      setQtdPecas(editingItem.qtdPecas > 0 ? String(editingItem.qtdPecas) : '');
      setQtdPacotes(editingItem.qtdPacotes > 0 ? String(editingItem.qtdPacotes) : '');
      setUnidades(editingItem.unidades > 0 ? String(editingItem.unidades) : '');
      setQtdBarras(editingItem.qtdBarras > 0 ? String(editingItem.qtdBarras) : '');
      setKg(editingItem.kg > 0 ? String(editingItem.kg) : '');
      setMeasurementMode(editingItem.measurementMode);
      setLabelCode(editingItem.labelCode);
      setScaleWeightKg(editingItem.scaleWeightKg > 0 ? String(editingItem.scaleWeightKg) : '');
      if (editingItem.category === 'bobina') {
        const nextSource: BobinaWeightSource =
          editingItem.hasLabel && editingItem.hasScaleWeight
            ? 'ambos'
            : editingItem.hasScaleWeight
              ? 'balanca'
              : 'etiqueta';
        setBobinaSource(nextSource);
        setBarraSource('etiqueta');
        setKg(
          nextSource === 'balanca'
            ? ''
            : editingItem.kg > 0
              ? String(editingItem.kg)
              : ''
        );
        setScaleWeightKg(
          editingItem.scaleWeightKg > 0
            ? String(editingItem.scaleWeightKg)
            : nextSource === 'balanca' && editingItem.kg > 0
              ? String(editingItem.kg)
              : ''
        );
      } else if (editingItem.category === 'barra') {
        const hasEtiquetaWeight = editingItem.hasLabel || editingItem.kg > 0;
        const nextBarraSource: BarraWeightSource =
          hasEtiquetaWeight && editingItem.hasScaleWeight
            ? 'ambos'
            : editingItem.hasScaleWeight
              ? 'balanca'
              : hasEtiquetaWeight
                ? 'etiqueta'
                : 'none';
        setBarraSource(nextBarraSource);
        setBobinaSource('etiqueta');
        setKg(
          nextBarraSource === 'balanca' || nextBarraSource === 'none'
            ? ''
            : editingItem.kg > 0
              ? String(editingItem.kg)
              : ''
        );
        setScaleWeightKg(
          editingItem.scaleWeightKg > 0
            ? String(editingItem.scaleWeightKg)
            : ''
        );
      } else {
        setBobinaSource('etiqueta');
        setBarraSource('etiqueta');
      }
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
      setNotaFiscal(editingItem.notaFiscal ?? '');
      setNotes(editingItem.notes);
      setEstriboRows([createEmptyEstriboRow()]);
      setBobinaRows([createEmptyBobinaRow()]);
    } else {
      setCategory(defaultCategory);
      setMaterialName('');
      setMaterialQty('');
      setKgPorUnidade('');
      setBitola(defaultCategory === 'bobina' ? loadBobinaBitolaDefault() : '');
      setMedida('');
      setQtdPecas('');
      setQtdPacotes('');
      setUnidades('');
      setQtdBarras('');
      setKg('');
      setMeasurementMode('ambos');
      setLabelCode('');
      setScaleWeightKg('');
      setBobinaSource('etiqueta');
      setBarraSource('etiqueta');
      setWireType('liso');
      setArameCaixas('');
      setArameAvulsas('');
      setNotaFiscal('');
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
    if (nextCat !== 'outros_materiais') {
      setMaterialName('');
      setMaterialQty('');
      setKgPorUnidade('');
    }
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
      setBarraSource('etiqueta');
      setMeasurementMode('ambos');
    } else if (nextCat === 'arame') {
      setMeasurementMode('ambos');
      if (wireType === 'none') setWireType('liso');
    } else {
      setMeasurementMode('ambos');
    }
  }

  function buildValidatedPayload(): InventoryItemInput | null {
    if (category === 'outros_materiais') {
      const name = materialName.trim().slice(0, MAX_BITOLA_LENGTH);
      const qty = materialQty.trim() ? parseNumericInput(materialQty) : 0;
      const perUnitKg = kgPorUnidade.trim() ? parseNumericInput(kgPorUnidade) : 0;
      if (!name) { setErrorMsg('Informe o nome do material.'); return null; }
      if (!materialQty.trim() && !kgPorUnidade.trim()) { setErrorMsg('Informe a quantidade, o kg por unidade ou os dois.'); return null; }
      if ((materialQty.trim() && qty <= 0) || (kgPorUnidade.trim() && perUnitKg <= 0)) {
        setErrorMsg('Os valores informados devem ser maiores que zero.');
        return null;
      }
      const totalKg = qty > 0 && perUnitKg > 0 ? qty * perUnitKg : 0;
      if (qty > MAX_NUMERIC_VALUE || perUnitKg > MAX_NUMERIC_VALUE || !Number.isFinite(totalKg) || totalKg > MAX_NUMERIC_VALUE) {
        setErrorMsg('Os valores e o peso total devem respeitar o limite numérico do sistema.');
        return null;
      }
      return {
        category,
        bitola: name,
        materialName: name,
        kgPorUnidade: perUnitKg,
        medida: '',
        qtdPecas: 0,
        qtdPacotes: 0,
        unidades: qty,
        qtdBarras: 0,
        kg: totalKg,
        measurementMode: 'ambos',
        hasLabel: false,
        labelCode: '',
        hasScaleWeight: false,
        scaleWeightKg: 0,
        wireType: 'none',
        notaFiscal: notaFiscal.trim().slice(0, MAX_NOTA_FISCAL_LENGTH),
        notes: notes.trim().slice(0, MAX_NOTES_LENGTH),
      };
    }
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
      (category === 'barra' && (barraSource === 'balanca' || barraSource === 'ambos')) ||
      (category === 'bobina' && (bobinaSource === 'balanca' || bobinaSource === 'ambos'))
        ? parseNumericInput(scaleWeightKg)
        : 0;

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
      if ((bobinaSource === 'etiqueta' || bobinaSource === 'ambos') && parsedKg <= 0) {
        setErrorMsg('Informe o peso da etiqueta (Kg) da bobina.');
        return null;
      }
      if ((bobinaSource === 'balanca' || bobinaSource === 'ambos') && parsedScaleKg <= 0) {
        setErrorMsg('Informe o peso da balança (Kg) da bobina.');
        return null;
      }
    }

    if (category === 'barra') {
      if (barraSource === 'none' && parsedBarras <= 0) {
        setErrorMsg('Informe a Qtd. Barras ou escolha um peso (Etiqueta / Balança).');
        return null;
      }
      if ((barraSource === 'etiqueta' || barraSource === 'ambos') && parsedKg <= 0) {
        setErrorMsg('Informe o peso da etiqueta (Kg) das barras.');
        return null;
      }
      if ((barraSource === 'balanca' || barraSource === 'ambos') && parsedScaleKg <= 0) {
        setErrorMsg('Informe o peso da balança (Kg) das barras.');
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
      qtdBarras: parsedBarras,
      kg:
        category === 'arame'
          ? isArameVariedCoil
            ? parsedKg
            : arameTotalUnits * ARAME_KG_PER_UNIT
          : category === 'barra' && (barraSource === 'balanca' || barraSource === 'none')
            ? 0
            : category === 'bobina' && bobinaSource === 'balanca'
              ? 0
              : parsedKg,
      measurementMode:
        category === 'arame'
          ? isArameVariedCoil
            ? 'kg'
            : 'ambos'
          : category === 'barra'
            ? parsedBarras > 0 && barraSource !== 'none'
              ? 'ambos'
              : parsedBarras > 0
                ? 'barras'
                : 'kg'
            : measurementMode,
      hasLabel:
        category === 'barra'
          ? barraSource === 'etiqueta' || barraSource === 'ambos'
          : category === 'bobina'
            ? bobinaSource === 'etiqueta' || bobinaSource === 'ambos'
            : false,
      labelCode:
        category === 'barra' && (barraSource === 'etiqueta' || barraSource === 'ambos')
          ? labelCode.trim().slice(0, MAX_LABEL_LENGTH)
          : '',
      hasScaleWeight:
        category === 'barra'
          ? barraSource === 'balanca' || barraSource === 'ambos'
          : category === 'bobina'
            ? bobinaSource === 'balanca' || bobinaSource === 'ambos'
            : false,
      scaleWeightKg: parsedScaleKg,
      wireType: category === 'arame' ? (wireType === 'none' ? 'liso' : wireType) : 'none',
      notaFiscal: notaFiscal.trim().slice(0, MAX_NOTA_FISCAL_LENGTH),
      notes: notes.trim().slice(0, MAX_NOTES_LENGTH),
    };
  }

  function formatAddedSummary(payload: InventoryItemInput): string {
    const label = CATEGORY_MAP[payload.category].label;
    const nfSuffix = payload.notaFiscal ? ` · NF ${payload.notaFiscal}` : '';
    if (payload.category === 'estribo') {
      const parts = [label, payload.bitola];
      if (payload.medida) parts.push(payload.medida);
      parts.push(`${formatNumber(payload.qtdPecas)} pçs`, `${formatNumber(payload.qtdPacotes)} pcts`, formatKg(payload.kg));
      return `${parts.join(' · ')}${nfSuffix}`;
    }
    if (payload.category === 'bobina') {
      const parts = [label, payload.bitola, `${formatNumber(payload.unidades)} un`];
      if (payload.hasLabel && payload.kg > 0) parts.push(`Etiqueta ${formatKg(payload.kg)}`);
      if (payload.hasScaleWeight && payload.scaleWeightKg > 0) parts.push(`Balança ${formatKg(payload.scaleWeightKg)}`);
      return `${parts.join(' · ')}${nfSuffix}`;
    }
    if (payload.category === 'barra') {
      const parts = [label, payload.bitola];
      if (payload.qtdBarras > 0) parts.push(`${formatNumber(payload.qtdBarras)} barras`);
      if (payload.hasLabel && payload.kg > 0) parts.push(`Etiqueta ${formatKg(payload.kg)}`);
      if (payload.hasScaleWeight && payload.scaleWeightKg > 0) parts.push(`Balança ${formatKg(payload.scaleWeightKg)}`);
      return `${parts.join(' · ')}${nfSuffix}`;
    }
    if (payload.category === 'outros_materiais') {
      const qty = payload.unidades > 0 ? `${formatNumber(payload.unidades)} un` : '';
      const perUnit = (payload.kgPorUnidade ?? 0) > 0 ? `${formatNumber(payload.kgPorUnidade ?? 0, 3)} kg/un` : '';
      const total = payload.kg > 0 ? formatKg(payload.kg) : '';
      return `${payload.materialName || payload.bitola}${[qty, perUnit, total].filter(Boolean).length ? ` · ${[qty, perUnit, total].filter(Boolean).join(' · ')}` : ''}${nfSuffix}`;
    }
    if (payload.category === 'tela_pop') {
      const resolvedTela = resolveTelaPopByCode(payload.bitola);
      const telaLabel = resolvedTela
        ? `${resolvedTela.code} · ${resolvedTela.nome}`
        : payload.bitola;
      return `${label} · ${telaLabel} · ${formatNumber(payload.unidades)} un${nfSuffix}`;
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
    return `${arameParts.join(' · ')}${nfSuffix}`;
  }

  function resetFieldsForNextEntry() {
    setMaterialName('');
    setMaterialQty('');
    setKgPorUnidade('');
    setMedida('');
    setQtdPecas('');
    setQtdPacotes('');
    setUnidades(category === 'arame' && measurementMode === 'kg' ? '1' : '');
    setQtdBarras('');
    setKg('');
    setArameCaixas('');
    setArameAvulsas('');
    setLabelCode('');
    setScaleWeightKg('');
    setNotaFiscal('');
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
    const lastSource = bobinaRows[bobinaRows.length - 1]?.source ?? 'etiqueta';
    setBobinaRows((prev) => [...prev, createEmptyBobinaRow(lastSource)]);
    window.requestAnimationFrame(() => {
      if (bobinaListRef.current) {
        bobinaListRef.current.scrollTop = bobinaListRef.current.scrollHeight;
      }
    });
  }

  function handleUpdateBobinaRow(
    rowId: string,
    field: 'kg' | 'scaleWeightKg' | 'source',
    value: string
  ) {
    setBobinaRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              ...(field === 'source'
                ? { source: value as BobinaWeightSource }
                : field === 'scaleWeightKg'
                  ? { scaleWeightKg: value }
                  : { kg: value }),
            }
          : row
      )
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
    materialName.trim().length > 0 ||
    materialQty.trim().length > 0 ||
    kgPorUnidade.trim().length > 0 ||
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
        const row = bobinaRows[i];
        const rowEtiquetaKg =
          row.source === 'etiqueta' || row.source === 'ambos' ? parseNumericInput(row.kg) : 0;
        const rowScaleKg =
          row.source === 'balanca' || row.source === 'ambos'
            ? parseNumericInput(row.scaleWeightKg)
            : 0;
        if ((row.source === 'etiqueta' || row.source === 'ambos') && rowEtiquetaKg <= 0) {
          setErrorMsg(`Informe o peso da etiqueta (Kg) da bobina #${i + 1}.`);
          return;
        }
        if ((row.source === 'balanca' || row.source === 'ambos') && rowScaleKg <= 0) {
          setErrorMsg(`Informe o peso da balança (Kg) da bobina #${i + 1}.`);
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
          kg: rowEtiquetaKg,
          measurementMode: 'ambos',
          hasLabel: row.source === 'etiqueta' || row.source === 'ambos',
          labelCode: '',
          hasScaleWeight: row.source === 'balanca' || row.source === 'ambos',
          scaleWeightKg: rowScaleKg,
          wireType: 'none',
          notaFiscal: notaFiscal.trim().slice(0, MAX_NOTA_FISCAL_LENGTH),
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
          notaFiscal: notaFiscal.trim().slice(0, MAX_NOTA_FISCAL_LENGTH),
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
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 p-1 bg-slate-100 rounded-lg">
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

          {category === 'outros_materiais' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-3">
                <label htmlFor="field-outro-nome" className="block text-xs font-medium text-slate-700 mb-1.5">Nome do material *</label>
                <input id="field-outro-nome" type="text" maxLength={MAX_BITOLA_LENGTH} required value={materialName} onChange={(e) => { setMaterialName(e.target.value); setBitola(e.target.value); }} placeholder="Ex.: Cantoneira, prego, tubo..." className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600" />
              </div>
              <div>
                <label htmlFor="field-outro-quantidade" className="block text-xs font-medium text-slate-700 mb-1.5">Quantidade (opcional)</label>
                <input id="field-outro-quantidade" type="number" min="0" max={MAX_NUMERIC_VALUE} step="any" value={materialQty} onChange={(e) => setMaterialQty(e.target.value)} placeholder="Deixe vazio se não se aplica" className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600" />
              </div>
              <div>
                <label htmlFor="field-outro-kg-unit" className="block text-xs font-medium text-slate-700 mb-1.5">Kg por unidade (opcional)</label>
                <input id="field-outro-kg-unit" type="number" min="0" max={MAX_NUMERIC_VALUE} step="0.001" value={kgPorUnidade} onChange={(e) => setKgPorUnidade(e.target.value)} placeholder="Deixe vazio se não se aplica" className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600" />
              </div>
              <p className="sm:col-span-3 text-xs text-slate-500">Preencha quantidade, kg por unidade ou os dois. Não podem ficar ambos vazios. Se os dois forem preenchidos, o peso total será calculado automaticamente.</p>
              {materialQty.trim() && kgPorUnidade.trim() && parseNumericInput(materialQty) > 0 && parseNumericInput(kgPorUnidade) > 0 && (
                <p className="sm:col-span-3 text-sm font-medium text-slate-700">Peso total calculado: {formatKg(parseNumericInput(materialQty) * parseNumericInput(kgPorUnidade))}</p>
              )}
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

          {category === 'outros_materiais' ? null : category === 'tela_pop' ? (() => {
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
            const totalBobinaEtiquetaPreview = bobinaRows.reduce(
              (acc, r) =>
                acc + (r.source === 'etiqueta' || r.source === 'ambos' ? parseNumericInput(r.kg) : 0),
              0
            );
            const totalBobinaBalancaPreview = bobinaRows.reduce(
              (acc, r) =>
                acc +
                (r.source === 'balanca' || r.source === 'ambos'
                  ? parseNumericInput(r.scaleWeightKg)
                  : 0),
              0
            );

            return (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-medium text-slate-700">
                      Bobinas por unidade ({bobinaRows.length})
                    </span>
                    {(totalBobinaEtiquetaPreview > 0 || totalBobinaBalancaPreview > 0) && (
                      <span className="ml-2 text-xs text-slate-500 font-mono-num">
                        {formatNumber(bobinaRows.length)} un
                        {totalBobinaEtiquetaPreview > 0
                          ? ` · Etiq. ${formatKg(totalBobinaEtiquetaPreview)}`
                          : ''}
                        {totalBobinaBalancaPreview > 0
                          ? ` · Bal. ${formatKg(totalBobinaBalancaPreview)}`
                          : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div ref={bobinaListRef} className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {bobinaRows.map((row, index) => (
                    <div
                      key={row.id}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-medium text-slate-700 font-mono-num whitespace-nowrap">
                          #{index + 1} · 1 un
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="inline-flex items-center gap-1 p-0.5 bg-slate-200/80 rounded-lg">
                            <button
                              type="button"
                              onClick={() => handleUpdateBobinaRow(row.id, 'source', 'etiqueta')}
                              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                                row.source === 'etiqueta'
                                  ? 'bg-white text-slate-900 shadow-sm'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Etiqueta
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateBobinaRow(row.id, 'source', 'balanca')}
                              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                                row.source === 'balanca'
                                  ? 'bg-white text-slate-900 shadow-sm'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Balança Kg
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateBobinaRow(row.id, 'source', 'ambos')}
                              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                                row.source === 'ambos'
                                  ? 'bg-white text-slate-900 shadow-sm'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Ambos
                            </button>
                          </div>

                          {bobinaRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveBobinaRow(row.id)}
                              aria-label={`Remover bobina ${index + 1}`}
                              className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div
                        className={`grid gap-2.5 ${
                          row.source === 'ambos' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
                        }`}
                      >
                        {(row.source === 'etiqueta' || row.source === 'ambos') && (
                          <div>
                            <label
                              htmlFor={`bobina-kg-${row.id}`}
                              className="block text-[11px] font-medium text-slate-600 mb-1"
                            >
                              Peso Etiqueta (Kg) *
                            </label>
                            <input
                              id={`bobina-kg-${row.id}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.kg}
                              onChange={(e) => handleUpdateBobinaRow(row.id, 'kg', e.target.value)}
                              placeholder="0.00"
                              className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                            />
                          </div>
                        )}

                        {(row.source === 'balanca' || row.source === 'ambos') && (
                          <div>
                            <label
                              htmlFor={`bobina-balanca-${row.id}`}
                              className="block text-[11px] font-medium text-slate-600 mb-1"
                            >
                              Peso Balança (Kg) *
                            </label>
                            <input
                              id={`bobina-balanca-${row.id}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.scaleWeightKg}
                              onChange={(e) =>
                                handleUpdateBobinaRow(row.id, 'scaleWeightKg', e.target.value)
                              }
                              placeholder="0.00"
                              className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                            />
                          </div>
                        )}
                      </div>
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
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Origem do peso
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setBobinaSource('etiqueta')}
                    className={`py-2 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      bobinaSource === 'etiqueta'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Etiqueta
                  </button>
                  <button
                    type="button"
                    onClick={() => setBobinaSource('balanca')}
                    className={`py-2 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      bobinaSource === 'balanca'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Balança Kg
                  </button>
                  <button
                    type="button"
                    onClick={() => setBobinaSource('ambos')}
                    className={`py-2 px-3 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      bobinaSource === 'ambos'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Ambos
                  </button>
                </div>
              </div>

              <div
                className={`grid grid-cols-1 gap-4 ${
                  bobinaSource === 'ambos' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
                }`}
              >
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
                {(bobinaSource === 'etiqueta' || bobinaSource === 'ambos') && (
                  <div>
                    <label htmlFor="field-kg-bobina" className="block text-xs font-medium text-slate-700 mb-1.5">
                      Peso Etiqueta (Kg) *
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
                )}
                {(bobinaSource === 'balanca' || bobinaSource === 'ambos') && (
                  <div>
                    <label htmlFor="field-balanca-bobina" className="block text-xs font-medium text-slate-700 mb-1.5">
                      Peso Balança (Kg) *
                    </label>
                    <input
                      id="field-balanca-bobina"
                      type="number"
                      min="0"
                      step="0.01"
                      value={scaleWeightKg}
                      onChange={(e) => setScaleWeightKg(e.target.value)}
                      placeholder="0.00"
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {category === 'barra' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Origem do peso (opcional: 1 das 2 ou as 2)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setBarraSource('etiqueta')}
                    className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      barraSource === 'etiqueta'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Etiqueta
                  </button>
                  <button
                    type="button"
                    onClick={() => setBarraSource('balanca')}
                    className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      barraSource === 'balanca'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Balança Kg
                  </button>
                  <button
                    type="button"
                    onClick={() => setBarraSource('ambos')}
                    className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      barraSource === 'ambos'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    As 2
                  </button>
                  <button
                    type="button"
                    onClick={() => setBarraSource('none')}
                    className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      barraSource === 'none'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Só Qtd. Barras
                  </button>
                </div>
              </div>

              <div
                className={`grid grid-cols-1 gap-4 ${
                  barraSource === 'ambos'
                    ? 'sm:grid-cols-3'
                    : barraSource === 'none'
                      ? ''
                      : 'sm:grid-cols-2'
                }`}
              >
                <div>
                  <label htmlFor="field-barras" className="block text-xs font-medium text-slate-700 mb-1.5">
                    {barraSource === 'none' ? 'Qtd. Barras *' : 'Qtd. Barras (opcional)'}
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

                {(barraSource === 'etiqueta' || barraSource === 'ambos') && (
                  <div>
                    <label htmlFor="field-kg-barra" className="block text-xs font-medium text-slate-700 mb-1.5">
                      Peso Etiqueta (Kg) *
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

                {(barraSource === 'balanca' || barraSource === 'ambos') && (
                  <div>
                    <label htmlFor="field-balanca-barra" className="block text-xs font-medium text-slate-700 mb-1.5">
                      Peso Balança (Kg) *
                    </label>
                    <input
                      id="field-balanca-barra"
                      type="number"
                      min="0"
                      step="0.01"
                      value={scaleWeightKg}
                      onChange={(e) => setScaleWeightKg(e.target.value)}
                      placeholder="0.00"
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                    />
                  </div>
                )}
              </div>

              {(barraSource === 'etiqueta' || barraSource === 'ambos') && (
                <div>
                  <label htmlFor="field-label-code-barra" className="block text-xs font-medium text-slate-700 mb-1.5">
                    Código / Nº da etiqueta (opcional)
                  </label>
                  <input
                    id="field-label-code-barra"
                    type="text"
                    maxLength={MAX_LABEL_LENGTH}
                    value={labelCode}
                    onChange={(e) => setLabelCode(e.target.value)}
                    placeholder="Ex: Lote 123 ou código da etiqueta"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                  />
                </div>
              )}
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="field-nota-fiscal" className="block text-xs font-medium text-slate-700 mb-1.5">
                Nota Fiscal (opcional)
              </label>
              <input
                id="field-nota-fiscal"
                type="text"
                maxLength={MAX_NOTA_FISCAL_LENGTH}
                value={notaFiscal}
                onChange={(e) => setNotaFiscal(e.target.value)}
                placeholder="Ex: 12345"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 font-mono-num focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
              />
            </div>

            <div className="sm:col-span-2">
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
