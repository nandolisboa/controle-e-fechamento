import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Lock,
  LogIn,
  LogOut,
  Plus,
  Printer,
  Search,
  Unlock,
  X,
} from 'lucide-react';
import { ConsolidatedSummary } from './components/ConsolidatedSummary';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ExcelPreviewModal } from './components/ExcelPreviewModal';
import { AuthGate } from './components/AuthGate';
import { InventoryTable } from './components/InventoryTable';
import { ItemFormModal } from './components/ItemFormModal';
import { PrintPreviewModal } from './components/PrintPreviewModal';
import { exportMonthlyCsv } from './lib/csvExport';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signOutUser,
  testFirestoreConnection,
} from './lib/firebase';
import {
  buildMonthDocId,
  copyMonthItems,
  createInventoryItem,
  createInventoryItemsBatch,
  deleteInventoryItem,
  ensureMonthRecord,
  setMonthLockState,
  updateInventoryItem,
  updateMonthNotes,
} from './lib/inventoryService';
import {
  buildLocalMonthRecord,
  consolidateEstriboItems,
  createLocalItemRecord,
  loadLocalItems,
  loadLocalMonths,
  saveLocalItems,
  saveLocalMonths,
  sortInventoryItems,
  updateLocalItemRecord,
} from './lib/localTestStore';
import {
  CATEGORIES,
  CATEGORY_MAP,
  formatMonthLabel,
  getAdjacentMonthKey,
  getCurrentMonthKey,
  type InventoryItem,
  type InventoryItemInput,
  MAX_MONTH_NOTES_LENGTH,
  type MaterialCategory,
  type MonthRecord,
} from './types/inventory';

function Workspace() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [testMode, setTestMode] = useState(false);

  const [monthsMap, setMonthsMap] = useState<Record<string, MonthRecord>>({});
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey);
  const [activeCategory, setActiveCategory] = useState<MaterialCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [arameFilter, setArameFilter] = useState<'all' | 'liso' | 'torcido'>('all');
  const [barraFilter, setBarraFilter] = useState<'all' | 'etiqueta' | 'balanca' | 'ambos'>('all');
  const [bobinaFilter, setBobinaFilter] = useState<'all' | 'etiqueta' | 'balanca' | 'ambos'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [responsavelPromptOpen, setResponsavelPromptOpen] = useState(false);
  const [responsavelDraft, setResponsavelDraft] = useState('');
  const [responsavelAtivo, setResponsavelAtivo] = useState('');
  const [excelPreviewOpen, setExcelPreviewOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);

  const [notesOpen, setNotesOpen] = useState(false);
  const [monthNotesDraft, setMonthNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [togglingLock, setTogglingLock] = useState(false);
  const [copyingMonth, setCopyingMonth] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (currentUser) {
        setTestMode(false);
        setMonthsMap({});
        setAllItems([]);
        setDataLoading(true);
        testFirestoreConnection();
      } else {
        setMonthsMap(loadLocalMonths());
        setAllItems(sortInventoryItems(loadLocalItems()));
        setDataLoading(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;

    setDataLoading(true);
    let monthsLoaded = false;
    let itemsLoaded = false;

    const monthsQuery = query(
      collection(db, 'months'),
      where('ownerId', '==', user.uid)
    );
    const itemsQuery = query(
      collection(db, 'inventoryItems'),
      where('ownerId', '==', user.uid)
    );

    const unsubMonths = onSnapshot(
      monthsQuery,
      (snapshot) => {
        const nextMap: Record<string, MonthRecord> = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const record: MonthRecord = {
            id: docSnap.id,
            ownerId: String(data.ownerId ?? ''),
            monthKey: String(data.monthKey ?? ''),
            isLocked: Boolean(data.isLocked),
            notes: String(data.notes ?? ''),
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
          if (record.monthKey) {
            nextMap[record.monthKey] = record;
          }
        });
        setMonthsMap(nextMap);
        monthsLoaded = true;
        if (itemsLoaded) setDataLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'months');
      }
    );

    const unsubItems = onSnapshot(
      itemsQuery,
      (snapshot) => {
        const list: InventoryItem[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: docSnap.id,
            ownerId: String(d.ownerId ?? ''),
            monthDocId: String(d.monthDocId ?? ''),
            monthKey: String(d.monthKey ?? ''),
            category: d.category as MaterialCategory,
            bitola: String(d.bitola ?? ''),
            materialName: String(d.materialName ?? ''),
            kgPorUnidade: Number(d.kgPorUnidade ?? 0),
            conferentes: Array.isArray(d.conferentes) ? d.conferentes.map(String) : [],
            temConferenciaSemNome: Boolean(d.temConferenciaSemNome),
            medida: String(d.medida ?? ''),
            qtdPecas: Number(d.qtdPecas ?? 0),
            qtdPacotes: Number(d.qtdPacotes ?? 0),
            unidades: Number(d.unidades ?? 0),
            qtdBarras: Number(d.qtdBarras ?? 0),
            kg: Number(d.kg ?? 0),
            measurementMode: d.measurementMode ?? 'ambos',
            hasLabel: Boolean(d.hasLabel),
            labelCode: String(d.labelCode ?? ''),
            hasScaleWeight: Boolean(d.hasScaleWeight),
            scaleWeightKg: Number(d.scaleWeightKg ?? 0),
            wireType: d.wireType ?? 'none',
            notaFiscal: String(d.notaFiscal ?? ''),
            notes: String(d.notes ?? ''),
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
          });
        });
        setAllItems(sortInventoryItems(list));
        itemsLoaded = true;
        if (monthsLoaded) setDataLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'inventoryItems');
      }
    );

    return () => {
      unsubMonths();
      unsubItems();
    };
  }, [authReady, user]);

  const currentMonthRecord = monthsMap[selectedMonth];
  const isMonthLocked = Boolean(currentMonthRecord?.isLocked);

  useEffect(() => {
    setMonthNotesDraft(currentMonthRecord?.notes ?? '');
  }, [selectedMonth, currentMonthRecord?.notes]);

  useEffect(() => {
    if (!actionFeedback) return;
    const timer = window.setTimeout(() => setActionFeedback(null), 4000);
    return () => window.clearTimeout(timer);
  }, [actionFeedback]);

  const monthItems = useMemo(
    () => allItems.filter((item) => item.monthKey === selectedMonth),
    [allItems, selectedMonth]
  );

  const prevMonthKey = useMemo(() => getAdjacentMonthKey(selectedMonth, -1), [selectedMonth]);
  const prevMonthItems = useMemo(
    () => allItems.filter((item) => item.monthKey === prevMonthKey),
    [allItems, prevMonthKey]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<MaterialCategory, number> = {
      estribo: 0,
      bobina: 0,
      barra: 0,
      tela_pop: 0,
      arame: 0,
      outros_materiais: 0,
    };
    for (const item of monthItems) {
      counts[item.category] += 1;
    }
    return counts;
  }, [monthItems]);

  const filteredItems = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return monthItems.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }
      if (activeCategory === 'arame' && arameFilter !== 'all') {
        if (item.wireType !== arameFilter) return false;
      }
      if (activeCategory === 'barra' && barraFilter !== 'all') {
        const hasEtiqueta = item.hasLabel || item.kg > 0;
        if (barraFilter === 'etiqueta' && !hasEtiqueta) return false;
        if (barraFilter === 'balanca' && !item.hasScaleWeight) return false;
        if (barraFilter === 'ambos' && !(hasEtiqueta && item.hasScaleWeight)) return false;
      }
      if (activeCategory === 'bobina' && bobinaFilter !== 'all') {
        if (bobinaFilter === 'etiqueta' && !item.hasLabel) return false;
        if (bobinaFilter === 'balanca' && !item.hasScaleWeight) return false;
        if (bobinaFilter === 'ambos' && !(item.hasLabel && item.hasScaleWeight)) return false;
      }
      if (term) {
        const matchBitola = item.bitola.toLowerCase().includes(term);
        const matchMaterialName = (item.materialName ?? '').toLowerCase().includes(term);
        const matchMedida = item.medida.toLowerCase().includes(term);
        const matchLabel = item.labelCode.toLowerCase().includes(term);
        const matchNf = (item.notaFiscal ?? '').toLowerCase().includes(term);
        const matchNotes = item.notes.toLowerCase().includes(term);
        const matchCat = CATEGORY_MAP[item.category].label.toLowerCase().includes(term);
        const matchOrigem =
          (item.hasLabel && 'etiqueta'.includes(term)) ||
          (item.hasScaleWeight && ('balanca'.includes(term) || 'balança'.includes(term)));
        return (
          matchBitola ||
          matchMaterialName ||
          matchMedida ||
          matchLabel ||
          matchNf ||
          matchNotes ||
          matchCat ||
          matchOrigem
        );
      }
      return true;
    });
  }, [monthItems, activeCategory, arameFilter, barraFilter, bobinaFilter, searchQuery]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center">
        <div className="text-sm text-slate-500">Carregando sistema...</div>
      </div>
    );
  }

  function handleEnterTestMode() {
    if (auth.currentUser) return;
    setUser(null);
    setTestMode(true);
    setMonthsMap(loadLocalMonths());
    setAllItems(sortInventoryItems(loadLocalItems()));
    setDataLoading(false);
  }

  if (!user && !testMode) {
    return (
      <AuthGate
        onEnterTestMode={handleEnterTestMode}
        onGoogleLogin={(loggedUser) => setUser(loggedUser)}
      />
    );
  }

  if (user && user.email?.toLowerCase() !== 'aramesprojeto@gmail.com') {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8">
          <h1 className="text-xl font-semibold">Conta sem acesso</h1>
          <p className="mt-3 text-sm text-slate-600">Para acessar o estoque, entre com aramesprojeto@gmail.com.</p>
          <button type="button" onClick={signOutUser} className="mt-6 px-4 py-2 rounded-lg bg-slate-900 text-white">Sair e trocar de conta</button>
        </div>
      </div>
    );
  }

  async function handleSaveItem(payload: InventoryItemInput, editingId?: string) {
    setActionError(null);
    if (!user) {
      if (editingId) {
        const updated = allItems.map((item) =>
          item.id === editingId ? updateLocalItemRecord(item, payload) : item
        );
        const { items: consolidated } = consolidateEstriboItems(updated);
        const nextItems = sortInventoryItems(consolidated);
        setAllItems(nextItems);
        saveLocalItems(nextItems);
        setActionFeedback('Item atualizado no estoque.');
      } else {
        const resp = responsavelAtivo.trim();
        const created = { ...createLocalItemRecord(selectedMonth, payload), conferentes: resp ? [resp] : [] };
        const { items: consolidated, changed } = consolidateEstriboItems([
          ...allItems,
          created,
        ]);
        const nextItems = sortInventoryItems(consolidated);
        setAllItems(nextItems);
        saveLocalItems(nextItems);
        setActionFeedback(
          changed
            ? 'Quantidade somada ao estribo da mesma bitola e medida.'
            : 'Item adicionado ao estoque mensal.'
        );
      }
      return;
    }

    if (editingId) {
      await updateInventoryItem(editingId, payload, monthItems);
      setActionFeedback('Item atualizado no estoque.');
    } else {
      await createInventoryItem(
        user.uid,
        selectedMonth,
        { ...payload, conferentes: responsavelAtivo.trim() ? [responsavelAtivo.trim()] : [] },
        Boolean(currentMonthRecord),
        monthItems
      );
      setActionFeedback('Item adicionado ao estoque mensal.');
    }
  }

  async function handleSaveItemsBatch(payloads: InventoryItemInput[]) {
    if (payloads.length === 0) return;
    setActionError(null);
    if (!user) {
      const resp = responsavelAtivo.trim();
      const createdList = payloads.map((payload) => ({
        ...createLocalItemRecord(selectedMonth, payload),
        conferentes: resp ? [resp] : [],
      }));
      const { items: consolidated } = consolidateEstriboItems([
        ...allItems,
        ...createdList,
      ]);
      const nextItems = sortInventoryItems(consolidated);
      setAllItems(nextItems);
      saveLocalItems(nextItems);
      setActionFeedback(
        payloads.length === 1
          ? 'Item adicionado ao estoque mensal.'
          : `${payloads.length} medidas processadas e somadas no estoque mensal.`
      );
      return;
    }

    const count = await createInventoryItemsBatch(
      user.uid,
      selectedMonth,
      payloads.map((payload) => ({
        ...payload,
        conferentes: responsavelAtivo.trim() ? [responsavelAtivo.trim()] : [],
      })),
      Boolean(currentMonthRecord),
      monthItems
    );
    setActionFeedback(
      count === 1
        ? 'Item adicionado ao estoque mensal.'
        : `${count} medidas processadas e somadas no estoque mensal.`
    );
  }

  async function handleDeleteItem(itemId: string) {
    setActionError(null);
    if (!user) {
      const nextItems = allItems.filter((item) => item.id !== itemId);
      setAllItems(nextItems);
      saveLocalItems(nextItems);
      setActionFeedback('Item removido do estoque.');
      return;
    }

    try {
      await deleteInventoryItem(itemId);
      setActionFeedback('Item removido do estoque.');
    } catch {
      setActionError('Não foi possível excluir o item. Verifique sua conexão ou permissões.');
    }
  }

  async function handleToggleMonthLock() {
    setTogglingLock(true);
    setActionError(null);
    if (!user) {
      const existingMonth = monthsMap[selectedMonth];
      const nextLocked = !isMonthLocked;
      const nextMap: Record<string, MonthRecord> = {
        ...monthsMap,
        [selectedMonth]: buildLocalMonthRecord(selectedMonth, {
          ...existingMonth,
          isLocked: nextLocked,
        }),
      };
      setMonthsMap(nextMap);
      saveLocalMonths(nextMap);
      setActionFeedback(
        nextLocked
          ? `Estoque de ${formatMonthLabel(selectedMonth)} fechado.`
          : `Estoque de ${formatMonthLabel(selectedMonth)} reaberto para edições.`
      );
      setTogglingLock(false);
      return;
    }

    try {
      const monthDocId = await ensureMonthRecord(user.uid, selectedMonth, Boolean(currentMonthRecord));
      await setMonthLockState(monthDocId, !isMonthLocked);
      setActionFeedback(
        !isMonthLocked
          ? `Estoque de ${formatMonthLabel(selectedMonth)} fechado.`
          : `Estoque de ${formatMonthLabel(selectedMonth)} reaberto para edições.`
      );
    } catch {
      setActionError('Não foi possível alterar o status de fechamento do mês.');
    } finally {
      setTogglingLock(false);
    }
  }

  async function handleSaveMonthNotes() {
    setSavingNotes(true);
    setActionError(null);
    if (!user) {
      const existingMonth = monthsMap[selectedMonth];
      const nextMap: Record<string, MonthRecord> = {
        ...monthsMap,
        [selectedMonth]: buildLocalMonthRecord(selectedMonth, {
          ...existingMonth,
          notes: monthNotesDraft,
        }),
      };
      setMonthsMap(nextMap);
      saveLocalMonths(nextMap);
      setActionFeedback('Observações do mês salvas.');
      setNotesOpen(false);
      setSavingNotes(false);
      return;
    }

    try {
      const monthDocId = currentMonthRecord
        ? buildMonthDocId(user.uid, selectedMonth)
        : await ensureMonthRecord(user.uid, selectedMonth);
      await updateMonthNotes(monthDocId, monthNotesDraft);
      setActionFeedback('Observações do mês salvas.');
      setNotesOpen(false);
    } catch {
      setActionError('Não foi possível salvar as observações do mês.');
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleCopyPreviousMonth() {
    if (prevMonthItems.length === 0 || isMonthLocked) return;
    setCopyingMonth(true);
    setActionError(null);
    if (!user) {
      const copied = prevMonthItems.map((src) =>
        createLocalItemRecord(selectedMonth, {
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
          notaFiscal: src.notaFiscal ?? '',
          notes: src.notes,
        })
      );
      const { items: consolidated } = consolidateEstriboItems([
        ...allItems,
        ...copied,
      ]);
      const nextItems = sortInventoryItems(consolidated);
      setAllItems(nextItems);
      saveLocalItems(nextItems);
      setActionFeedback(
        `${copied.length} itens copiados de ${formatMonthLabel(prevMonthKey)}.`
      );
      setCopyingMonth(false);
      return;
    }

    try {
      const count = await copyMonthItems(user.uid, selectedMonth, prevMonthItems, Boolean(currentMonthRecord));
      setActionFeedback(
        `${count} itens copiados de ${formatMonthLabel(prevMonthKey)}.`
      );
    } catch {
      setActionError('Não foi possível copiar os itens do mês anterior.');
    } finally {
      setCopyingMonth(false);
    }
  }

  function openNewModal(defaultCat?: MaterialCategory) {
    if (isMonthLocked) return;
    setEditingItem(null);
    if (defaultCat) {
      setActiveCategory(defaultCat);
    }
    setResponsavelDraft(responsavelAtivo);
    setResponsavelPromptOpen(true);
  }

  function confirmResponsavelAndContinue() {
    const name = responsavelDraft.trim();
    if (!name) return;
    setResponsavelAtivo(name);
    setResponsavelPromptOpen(false);
    setModalOpen(true);
  }

  function openEditModal(item: InventoryItem) {
    if (isMonthLocked) return;
    setEditingItem(item);
    setModalOpen(true);
  }

  const activeCategoryTitle =
    activeCategory === 'all' ? 'Visão Geral' : CATEGORY_MAP[activeCategory].label;

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      (activeCategory === 'arame' && arameFilter !== 'all') ||
      (activeCategory === 'barra' && barraFilter !== 'all') ||
      (activeCategory === 'bobina' && bobinaFilter !== 'all')
  );

  return (
    <>
    <div className={`min-h-screen bg-[#F7F8FA] text-slate-900 flex ${printPreviewOpen ? 'no-print' : ''}`}>
      {testMode && <div role="status" className="fixed bottom-0 left-0 right-0 z-[80] bg-amber-100 text-amber-900 text-center text-xs py-1 px-3 no-print">MODO TESTE — alterações ficam somente neste navegador e não são sincronizadas com o estoque oficial</div>}
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden no-print"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#0F172A] text-slate-100 flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 no-print ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
            <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
              AçoGestão
            </span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Fechar menu"
              className="lg:hidden p-1.5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Month Selector */}
          <div className="p-4 border-b border-slate-800">
            <div className="text-xs font-medium text-slate-400 mb-2">
              Mês de referência
            </div>
            <div className="flex items-center justify-between gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setSelectedMonth((m) => getAdjacentMonthKey(m, -1))}
                aria-label="Mês anterior"
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium text-white whitespace-nowrap truncate">
                {formatMonthLabel(selectedMonth)}
              </span>
              <button
                type="button"
                onClick={() => setSelectedMonth((m) => getAdjacentMonthKey(m, 1))}
                aria-label="Próximo mês"
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="month"
                aria-label="Selecionar mês específico"
                value={selectedMonth}
                onChange={(e) => {
                  if (e.target.value) setSelectedMonth(e.target.value);
                }}
                className="w-full bg-transparent text-xs text-slate-300 font-mono-num focus:outline-none cursor-pointer [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Category Navigation */}
          <nav aria-label="Categorias do estoque" className="p-3 space-y-1">
            <button
              type="button"
              onClick={() => {
                setActiveCategory('all');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeCategory === 'all'
                  ? 'bg-orange-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <span>Visão Geral</span>
              <span className="font-mono-num text-xs opacity-80">{monthItems.length}</span>
            </button>

            <div className="pt-2 pb-1 px-3 text-[11px] font-medium text-slate-500">
              Materiais
            </div>

            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  activeCategory === cat.id
                    ? 'bg-orange-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <span>{cat.label}</span>
                <span className="font-mono-num text-xs opacity-80">
                  {categoryCounts[cat.id]}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Account / Mode Footer */}
        <div className="p-4 border-t border-slate-800">
          {user ? (
            <>
              <div className="text-xs font-medium text-slate-200 truncate">
                {user.displayName || 'Operador'}
              </div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                {user.email}
              </div>
              <button
                type="button"
                onClick={() => signOutUser()}
                className="mt-3 w-full h-9 px-3 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair da conta</span>
              </button>
            </>
          ) : (
            <>
              <div className="text-xs font-medium text-slate-200 truncate">
                Modo Teste local
              </div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                Salvo localmente no navegador
              </div>
              <button
                type="button"
                onClick={() => { setTestMode(false); setAllItems([]); setMonthsMap({}); setMobileMenuOpen(false); }}
                className="mt-3 w-full h-9 px-3 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Voltar para acesso oficial</span>
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col print-full">
        {/* Top Bar */}
        <header className="min-h-16 sm:h-16 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-0 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
            <img
              src={`${import.meta.env.BASE_URL}logo-arames-brasil.jpg`}
              alt="Arames Brasil"
              className="h-9 w-auto max-w-[120px] object-contain shrink-0"
            />
            <div className="flex items-center gap-2 text-sm min-w-0 truncate">
              <span className="text-slate-500 hidden sm:inline">Estoque Mensal</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="font-medium text-slate-900 whitespace-nowrap">
                {formatMonthLabel(selectedMonth)}
              </span>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-orange-600 truncate">
                {activeCategoryTitle}
              </span>
              <span className="text-slate-300 hidden md:inline">·</span>
              <span
                className={`hidden md:inline text-xs font-medium whitespace-nowrap ${
                  isMonthLocked ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {isMonthLocked ? 'Mês fechado' : 'Em aberto'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 sm:gap-2.5 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => { if (user) { void signOutUser(); } else { setTestMode(false); setAllItems([]); setMonthsMap({}); } }}
              className="sm:hidden inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 whitespace-nowrap"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </button>
            <button
              type="button"
              onClick={() => setExcelPreviewOpen(true)}
              disabled={monthItems.length === 0}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-xs font-medium text-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Exportar Excel</span>
            </button>
            <button
              type="button"
              onClick={() => exportMonthlyCsv(selectedMonth, monthItems)}
              disabled={monthItems.length === 0}
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-xs font-medium text-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>
            <button
              type="button"
              onClick={() => setPrintPreviewOpen(true)}
              disabled={monthItems.length === 0}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-xs font-medium text-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
            <button
              type="button"
              disabled={isMonthLocked}
              onClick={() =>
                openNewModal(activeCategory === 'all' ? 'estribo' : activeCategory)
              }
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Novo lançamento</span>
            </button>
          </div>
        </header>

        {/* Print Header (visible only when printing) */}
        <div className="hidden print:block px-6 pt-6 pb-4 border-b border-slate-300">
          <h1 className="font-display text-2xl font-bold text-slate-900">
            AçoGestão — Controle de Estoque Mensal ({formatMonthLabel(selectedMonth)})
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Categoria: {activeCategoryTitle} · Situação: {isMonthLocked ? 'Fechado' : 'Em aberto'}
            {currentMonthRecord?.notes ? ` · Obs.: ${currentMonthRecord.notes}` : ''}
          </p>
        </div>

        {/* Main Workspace Body */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1360px] w-full mx-auto space-y-5">
          {/* Feedback Banner */}
          {actionFeedback && (
            <div
              role="status"
              className="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-medium flex items-center justify-between no-print"
            >
              <span>{actionFeedback}</span>
              <button
                type="button"
                onClick={() => setActionFeedback(null)}
                className="text-slate-400 hover:text-white ml-4 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {actionError && (
            <div
              role="alert"
              className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center justify-between no-print"
            >
              <span>{actionError}</span>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="text-red-500 hover:text-red-800 ml-4 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Workspace Toolbar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 no-print">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Category Quick Tabs */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto max-w-full">
                <button
                  type="button"
                  onClick={() => setActiveCategory('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeCategory === 'all'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todas
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      activeCategory === cat.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Month Lock & Notes Actions */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setNotesOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Observações do mês</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleMonthLock}
                  disabled={togglingLock}
                  className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isMonthLocked
                      ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {isMonthLocked ? (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Reabrir mês</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>Fechar mês</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Sub-filters */}
            {(activeCategory === 'arame' || activeCategory === 'barra' || activeCategory === 'bobina') && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">

              {activeCategory === 'arame' && (
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setArameFilter('all')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                      arameFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todos os arames
                  </button>
                  <button
                    type="button"
                    onClick={() => setArameFilter('liso')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                      arameFilter === 'liso'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Liso
                  </button>
                  <button
                    type="button"
                    onClick={() => setArameFilter('torcido')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                      arameFilter === 'torcido'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Torcido
                  </button>
                </div>
              )}

              {activeCategory === 'barra' && (
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setBarraFilter('all')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                      barraFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todas as barras
                  </button>
                  <button
                    type="button"
                    onClick={() => setBarraFilter('etiqueta')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                      barraFilter === 'etiqueta'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Etiqueta
                  </button>
                  <button
                    type="button"
                    onClick={() => setBarraFilter('balanca')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                      barraFilter === 'balanca'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Balança Kg
                  </button>
                  <button
                    type="button"
                    onClick={() => setBarraFilter('ambos')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                      barraFilter === 'ambos'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Os 2 pesos
                  </button>
                </div>
              )}

              {activeCategory === 'bobina' && (
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setBobinaFilter('all')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                      bobinaFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todas as bobinas
                  </button>
                  <button
                    type="button"
                    onClick={() => setBobinaFilter('etiqueta')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                      bobinaFilter === 'etiqueta'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Etiqueta
                  </button>
                  <button
                    type="button"
                    onClick={() => setBobinaFilter('balanca')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                      bobinaFilter === 'balanca'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Balança Kg
                  </button>
                  <button
                    type="button"
                    onClick={() => setBobinaFilter('ambos')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                      bobinaFilter === 'ambos'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Os 2 pesos
                  </button>
                </div>
              )}
            </div>
            )}

            {/* Collapsible Month Notes */}
            {notesOpen && (
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <label
                  htmlFor="month-notes"
                  className="block text-xs font-medium text-slate-700"
                >
                  Anotações gerais de {formatMonthLabel(selectedMonth)}
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="month-notes"
                    type="text"
                    maxLength={MAX_MONTH_NOTES_LENGTH}
                    value={monthNotesDraft}
                    onChange={(e) => setMonthNotesDraft(e.target.value)}
                    placeholder="Ex: Inventário conferido pela equipe da manhã, pátio B reorganizado..."
                    className="flex-1 h-9 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                  />
                  <button
                    type="button"
                    disabled={savingNotes}
                    onClick={handleSaveMonthNotes}
                    className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium cursor-pointer whitespace-nowrap"
                  >
                    {savingNotes ? 'Salvando...' : 'Salvar anotação'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Locked Notice */}
          {isMonthLocked && (
            <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-4 no-print">
              <span>
                O período de <strong>{formatMonthLabel(selectedMonth)}</strong> está fechado. Reabra o mês caso precise adicionar, editar ou remover lançamentos.
              </span>
              <button
                type="button"
                onClick={handleToggleMonthLock}
                className="text-xs font-semibold text-amber-900 underline hover:no-underline whitespace-nowrap cursor-pointer"
              >
                Reabrir agora
              </button>
            </div>
          )}

          {/* Consolidated Compatible Summary */}
          {!dataLoading && filteredItems.length > 0 && (
            <ConsolidatedSummary
              items={filteredItems}
              activeCategory={activeCategory}
            />
          )}

          {/* Data Table Section */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {/* Search bar right above Todos os materiais lançados */}
            <div className="px-4 sm:px-5 py-3 border-b border-slate-200 bg-slate-50/50 no-print">
              <div className="relative max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por bitola, nota fiscal, etiqueta ou observação..."
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                />
              </div>
            </div>

            <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {activeCategory === 'all'
                    ? 'Todos os materiais lançados'
                    : CATEGORY_MAP[activeCategory].label}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeCategory === 'all'
                    ? 'Consolidado mensal com estribos, bobinas, barras, telas pop e arames.'
                    : CATEGORY_MAP[activeCategory].description}
                </p>
              </div>
              <span className="text-xs text-slate-500 font-mono-num whitespace-nowrap">
                {filteredItems.length} {filteredItems.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>

            {dataLoading ? (
              <div className="divide-y divide-slate-200">
                {[1, 2, 3, 4, 5].map((row) => (
                  <div key={row} className="px-4 py-3 flex items-center gap-4">
                    <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
                    <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
                    <div className="h-4 w-28 bg-slate-100 rounded animate-pulse ml-auto" />
                    <div className="h-4 w-16 bg-slate-100 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : monthItems.length === 0 ? (
              <div className="px-6 py-14 text-center max-w-md mx-auto">
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Nenhum lançamento em {formatMonthLabel(selectedMonth)}
                </h3>
                <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
                  Adicione o primeiro item de estoque deste mês ou copie os itens registrados no mês anterior para agilizar a contagem.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  {!isMonthLocked && (
                    <button
                      type="button"
                      onClick={() =>
                        openNewModal(
                          activeCategory === 'all' ? 'estribo' : activeCategory
                        )
                      }
                      className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Registrar primeiro item</span>
                    </button>
                  )}

                  {prevMonthItems.length > 0 && !isMonthLocked && (
                    <button
                      type="button"
                      disabled={copyingMonth}
                      onClick={handleCopyPreviousMonth}
                      className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium cursor-pointer whitespace-nowrap"
                    >
                      <Copy className="w-4 h-4" />
                      <span>
                        {copyingMonth
                          ? 'Copiando...'
                          : `Copiar de ${formatMonthLabel(prevMonthKey)} (${prevMonthItems.length})`}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm font-medium text-slate-800">
                  Nenhum item encontrado com os filtros selecionados.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setArameFilter('all');
                    setBarraFilter('all');
                    setBobinaFilter('all');
                  }}
                  className="mt-3 text-xs font-medium text-orange-600 hover:text-orange-700 underline cursor-pointer"
                >
                  Limpar busca e filtros
                </button>
              </div>
            ) : (
              <InventoryTable
                items={filteredItems}
                activeCategory={activeCategory}
                isLocked={isMonthLocked}
                onEdit={openEditModal}
                onDelete={handleDeleteItem}
              />
            )}
          </div>
        </main>
      </div>

      {responsavelPromptOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/60 flex items-center justify-center p-4 no-print" role="dialog" aria-modal="true" aria-labelledby="responsavel-title">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6">
            <h2 id="responsavel-title" className="text-lg font-semibold text-slate-900">Responsável pela conferência</h2>
            <p className="mt-2 text-sm text-slate-600">Informe quem está conferindo os lançamentos.</p>
            <label htmlFor="responsavel-conferencia" className="block mt-4 text-xs font-medium text-slate-700 mb-1.5">Nome do responsável *</label>
            <input id="responsavel-conferencia" autoFocus maxLength={80} value={responsavelDraft} onChange={(e) => setResponsavelDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirmResponsavelAndContinue(); if (e.key === 'Escape') setResponsavelPromptOpen(false); }} placeholder="Digite o nome" className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600" />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setResponsavelPromptOpen(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-sm text-slate-700">Cancelar</button>
              <button type="button" disabled={!responsavelDraft.trim()} onClick={confirmResponsavelAndContinue} className="h-9 px-4 rounded-lg bg-slate-900 text-sm font-medium text-white disabled:opacity-40">Continuar</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <ItemFormModal
        isOpen={modalOpen}
        editingItem={editingItem}
        defaultCategory={activeCategory === 'all' ? 'estribo' : activeCategory}
        onClose={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        onSubmit={handleSaveItem}
        onSubmitBatch={handleSaveItemsBatch}
      />
    </div>

    <PrintPreviewModal
      isOpen={printPreviewOpen}
      isTestMode={testMode && !user}
      onClose={() => setPrintPreviewOpen(false)}
      monthKey={selectedMonth}
      isLocked={isMonthLocked}
      monthNotes={currentMonthRecord?.notes ?? ''}
      activeCategory={activeCategory}
      allMonthItems={monthItems}
      filteredItems={filteredItems}
      hasActiveFilters={hasActiveFilters}
    />
    <ExcelPreviewModal
      isOpen={excelPreviewOpen}
      isTestMode={testMode && !user}
      onClose={() => setExcelPreviewOpen(false)}
      monthKey={selectedMonth}
      activeCategory={activeCategory}
      allMonthItems={monthItems}
      filteredItems={filteredItems}
      hasActiveFilters={hasActiveFilters}
      onExportError={(msg) => setActionError(msg)}
    />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Workspace />
    </ErrorBoundary>
  );
}
