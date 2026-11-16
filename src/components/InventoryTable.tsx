import { useState } from 'react';
import { Pencil, Scale, Tag, Trash2 } from 'lucide-react';
import {
  CATEGORY_MAP,
  formatArameBoxes,
  formatKg,
  formatNumber,
  getArameMetrics,
  type InventoryItem,
  type MaterialCategory,
  resolveTelaPopByCode,
} from '../types/inventory';

interface InventoryTableProps {
  items: InventoryItem[];
  activeCategory: MaterialCategory | 'all';
  isLocked: boolean;
  onEdit: (item: InventoryItem) => void;
  onDelete: (itemId: string) => Promise<void>;
}

export function InventoryTable({
  items,
  activeCategory,
  isLocked,
  onEdit,
  onDelete,
}: InventoryTableProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleConfirmDelete(itemId: string) {
    setDeletingId(itemId);
    try {
      await onDelete(itemId);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  }

  function renderActionCell(item: InventoryItem) {
    if (isLocked) {
      return (
        <td className="px-4 py-2.5 text-right text-xs text-slate-400 whitespace-nowrap no-print">
          Mês fechado
        </td>
      );
    }

    if (confirmDeleteId === item.id) {
      return (
        <td className="px-4 py-2.5 text-right whitespace-nowrap no-print">
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              disabled={deletingId === item.id}
              onClick={() => handleConfirmDelete(item.id)}
              className="px-2.5 py-1 rounded text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {deletingId === item.id ? 'Excluindo...' : 'Confirmar'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteId(null)}
              className="px-2.5 py-1 rounded text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
            >
              Cancelar
            </button>
          </div>
        </td>
      );
    }

    return (
      <td className="px-4 py-2.5 text-right whitespace-nowrap no-print">
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(item)}
            title="Editar item"
            aria-label={`Editar ${item.bitola}`}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteId(item.id)}
            title="Excluir item"
            aria-label={`Excluir ${item.bitola}`}
            className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    );
  }

  if (activeCategory === 'estribo') {
    const totalPecas = items.reduce((s, i) => s + i.qtdPecas, 0);
    const totalPacotes = items.reduce((s, i) => s + i.qtdPacotes, 0);
    const totalKg = items.reduce((s, i) => s + i.kg, 0);

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
              <th className="px-4 py-3">Bitola</th>
              <th className="px-4 py-3">Medida</th>
              <th className="px-4 py-3 text-right">Peças</th>
              <th className="px-4 py-3 text-right">Pacotes</th>
              <th className="px-4 py-3 text-right">Peso (kg)</th>
              <th className="px-4 py-3">Obs.</th>
              <th className="px-4 py-3 text-right no-print">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-4 py-2.5 font-medium text-slate-900 font-mono-num">
                  {item.bitola}
                </td>
                <td className="px-4 py-2.5 font-mono-num text-slate-800 whitespace-nowrap">
                  {item.medida || '—'}
                </td>
                <td className="px-4 py-2.5 text-right font-mono-num text-slate-800">
                  {formatNumber(item.qtdPecas)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono-num text-slate-800">
                  {formatNumber(item.qtdPacotes)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono-num font-medium text-slate-900">
                  {formatKg(item.kg)}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500 max-w-xs truncate">
                  {item.notes || '—'}
                </td>
                {renderActionCell(item)}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-300 bg-slate-50/80 text-xs font-semibold text-slate-900">
              <td colSpan={2} className="px-4 py-2.5">
                Total ({items.length} {items.length === 1 ? 'item' : 'itens'})
              </td>
              <td className="px-4 py-2.5 text-right font-mono-num">
                {formatNumber(totalPecas)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono-num">
                {formatNumber(totalPacotes)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono-num">
                {formatKg(totalKg)}
              </td>
              <td className="px-4 py-2.5" />
              <td className="px-4 py-2.5 no-print" />
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  if (activeCategory === 'bobina') {
    const totalUn = items.reduce((s, i) => s + i.unidades, 0);
    const totalEtiquetaKg = items.reduce(
      (s, i) => s + (i.hasLabel || !i.hasScaleWeight ? i.kg : 0),
      0
    );
    const totalBalancaKg = items.reduce(
      (s, i) => s + (i.hasScaleWeight ? i.scaleWeightKg : 0),
      0
    );

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
              <th className="px-4 py-3">Bitola</th>
              <th className="px-4 py-3 text-right">Un.</th>
              <th className="px-4 py-3 text-right">Etiq. (kg)</th>
              <th className="px-4 py-3 text-right">Bal. (kg)</th>
              <th className="px-4 py-3">NF</th>
              <th className="px-4 py-3">Obs.</th>
              <th className="px-4 py-3 text-right no-print">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {items.map((item) => {
              const showEtiquetaKg = item.hasLabel ? item.kg : !item.hasScaleWeight ? item.kg : 0;
              const showScaleKg = item.hasScaleWeight ? item.scaleWeightKg : 0;
              const showDiff =
                showEtiquetaKg > 0 && showScaleKg > 0 && Math.abs(showScaleKg - showEtiquetaKg) > 0.01;
              const diff = showScaleKg - showEtiquetaKg;

              return (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-900 font-mono-num">
                    {item.bitola}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num text-slate-800">
                    {formatNumber(item.unidades)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num">
                    {showEtiquetaKg > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                        <Tag className="w-3.5 h-3.5 shrink-0" />
                        <span>{formatKg(showEtiquetaKg)}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num">
                    {showScaleKg > 0 ? (
                      <div className="inline-flex flex-col items-end">
                        <span className="inline-flex items-center gap-1 text-slate-900 font-medium">
                          <Scale className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                          <span>{formatKg(showScaleKg)}</span>
                        </span>
                        {showDiff && (
                          <span
                            className={`text-[11px] ${
                              diff > 0 ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {diff > 0 ? '+' : ''}
                            {formatKg(diff)} vs etiq.
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono-num whitespace-nowrap">
                    {item.notaFiscal ? (
                      <span className="text-slate-800">{item.notaFiscal}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 max-w-xs truncate">
                    {item.notes || '—'}
                  </td>
                  {renderActionCell(item)}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-300 bg-slate-50/80 text-xs font-semibold text-slate-900">
              <td className="px-4 py-2.5">
                Total ({items.length} bob.)
              </td>
              <td className="px-4 py-2.5 text-right font-mono-num">
                {formatNumber(totalUn)}
              </td>
              <td className="px-4 py-2.5 text-right font-mono-num text-emerald-700">
                {totalEtiquetaKg > 0 ? formatKg(totalEtiquetaKg) : '—'}
              </td>
              <td className="px-4 py-2.5 text-right font-mono-num text-orange-700">
                {totalBalancaKg > 0 ? formatKg(totalBalancaKg) : '—'}
              </td>
              <td className="px-4 py-2.5" />
              <td className="px-4 py-2.5" />
              <td className="px-4 py-2.5 no-print" />
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  if (activeCategory === 'barra') {
    const totalBarras = items.reduce((s, i) => s + i.qtdBarras, 0);
    const totalEtiquetaKg = items.reduce(
      (s, i) => s + (i.hasLabel || !i.hasScaleWeight ? i.kg : 0),
      0
    );
    const totalBalancaKg = items.reduce(
      (s, i) => s + (i.hasScaleWeight ? i.scaleWeightKg : 0),
      0
    );

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
              <th className="px-4 py-3">Bitola</th>
              <th className="px-4 py-3 text-right">Barras</th>
              <th className="px-4 py-3 text-right">Etiq. (kg)</th>
              <th className="px-4 py-3 text-right">Bal. (kg)</th>
              <th className="px-4 py-3">NF</th>
              <th className="px-4 py-3">Obs.</th>
              <th className="px-4 py-3 text-right no-print">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {items.map((item) => {
              const showEtiquetaKg = item.hasLabel ? item.kg : !item.hasScaleWeight ? item.kg : 0;
              const showScaleKg = item.hasScaleWeight ? item.scaleWeightKg : 0;
              const showDiff =
                showEtiquetaKg > 0 && showScaleKg > 0 && Math.abs(showScaleKg - showEtiquetaKg) > 0.01;
              const diff = showScaleKg - showEtiquetaKg;

              return (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-900 font-mono-num">
                    {item.bitola}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num text-slate-800">
                    {item.qtdBarras > 0 ? formatNumber(item.qtdBarras) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num">
                    {showEtiquetaKg > 0 ? (
                      <div className="inline-flex flex-col items-end">
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                          <Tag className="w-3.5 h-3.5 shrink-0" />
                          <span>{formatKg(showEtiquetaKg)}</span>
                        </span>
                        {item.labelCode && (
                          <span className="text-[11px] text-slate-500 font-normal">
                            Etiq.: {item.labelCode}
                          </span>
                        )}
                      </div>
                    ) : item.hasLabel && item.labelCode ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                        <Tag className="w-3.5 h-3.5 shrink-0" />
                        <span>{item.labelCode}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num">
                    {showScaleKg > 0 ? (
                      <div className="inline-flex flex-col items-end">
                        <span className="inline-flex items-center gap-1 text-slate-900 font-medium">
                          <Scale className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                          <span>{formatKg(showScaleKg)}</span>
                        </span>
                        {showDiff && (
                          <span
                            className={`text-[11px] ${
                              diff > 0 ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {diff > 0 ? '+' : ''}
                            {formatKg(diff)} vs etiq.
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono-num whitespace-nowrap">
                    {item.notaFiscal ? (
                      <span className="text-slate-800">{item.notaFiscal}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 max-w-xs truncate">
                    {item.notes || '—'}
                  </td>
                  {renderActionCell(item)}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-300 bg-slate-50/80 text-xs font-semibold text-slate-900">
              <td className="px-4 py-2.5">
                Total ({items.length} {items.length === 1 ? 'item' : 'itens'})
              </td>
              <td className="px-4 py-2.5 text-right font-mono-num">
                {totalBarras > 0 ? formatNumber(totalBarras) : '—'}
              </td>
              <td className="px-4 py-2.5 text-right font-mono-num text-emerald-700">
                {totalEtiquetaKg > 0 ? formatKg(totalEtiquetaKg) : '—'}
              </td>
              <td className="px-4 py-2.5 text-right font-mono-num text-orange-700">
                {totalBalancaKg > 0 ? formatKg(totalBalancaKg) : '—'}
              </td>
              <td className="px-4 py-2.5" />
              <td className="px-4 py-2.5" />
              <td className="px-4 py-2.5 no-print" />
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  if (activeCategory === 'tela_pop') {
    const totalTelas = items.reduce((s, i) => s + i.unidades, 0);

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
              <th className="px-4 py-3">Cód. / Bitola</th>
              <th className="px-4 py-3">Espec.</th>
              <th className="px-4 py-3 text-right">Qtd.</th>
              <th className="px-4 py-3">NF</th>
              <th className="px-4 py-3">Obs.</th>
              <th className="px-4 py-3 text-right no-print">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {items.map((item) => {
              const telaSpec = resolveTelaPopByCode(item.bitola);
              return (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-900 font-mono-num whitespace-nowrap">
                    {item.bitola}
                  </td>
                  <td className="px-4 py-2.5 text-slate-800 whitespace-nowrap">
                    {telaSpec ? (
                      <div>
                        <span className="font-medium text-slate-900">{telaSpec.shortNome}</span>
                        <span className="text-xs text-slate-500 font-mono-num ml-2">
                          {telaSpec.malha} · {telaSpec.painel}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Personalizada</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num font-medium text-slate-900">
                    {formatNumber(item.unidades)} un
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono-num whitespace-nowrap">
                    {item.notaFiscal ? (
                      <span className="text-slate-800">{item.notaFiscal}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 max-w-xs truncate">
                    {item.notes || '—'}
                  </td>
                  {renderActionCell(item)}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-300 bg-slate-50/80 text-xs font-semibold text-slate-900">
              <td colSpan={2} className="px-4 py-2.5">
                Total ({items.length} reg.)
              </td>
              <td className="px-4 py-2.5 text-right font-mono-num">
                {formatNumber(totalTelas)} un
              </td>
              <td className="px-4 py-2.5" />
              <td className="px-4 py-2.5" />
              <td className="px-4 py-2.5 no-print" />
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  if (activeCategory === 'outros_materiais') {
    const totalUnits = items.reduce((sum, item) => sum + item.unidades, 0);
    const totalKg = items.reduce((sum, item) => sum + item.kg, 0);
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead><tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
            <th className="px-4 py-3">Material</th><th className="px-4 py-3 text-right">Qtd.</th><th className="px-4 py-3 text-right">Kg/un</th><th className="px-4 py-3 text-right">Peso (kg)</th><th className="px-4 py-3">NF</th><th className="px-4 py-3">Obs.</th><th className="px-4 py-3 text-right no-print">Ações</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-200 text-sm">{items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
              <td className="px-4 py-2.5 font-medium text-slate-900">{item.materialName || item.bitola}</td>
              <td className="px-4 py-2.5 text-right font-mono-num">{item.unidades > 0 ? formatNumber(item.unidades) : '—'}</td>
              <td className="px-4 py-2.5 text-right font-mono-num">{(item.kgPorUnidade ?? 0) > 0 ? `${formatNumber(item.kgPorUnidade ?? 0, 3)} kg` : '—'}</td>
              <td className="px-4 py-2.5 text-right font-mono-num">{item.kg > 0 ? formatKg(item.kg) : '—'}</td>
              <td className="px-4 py-2.5 text-xs font-mono-num whitespace-nowrap">
                {item.notaFiscal ? (
                  <span className="text-slate-800">{item.notaFiscal}</span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-xs text-slate-500 max-w-xs truncate">{item.notes || '—'}</td>{renderActionCell(item)}
            </tr>
          ))}</tbody>
          <tfoot><tr className="border-t border-slate-300 bg-slate-50/80 text-xs font-semibold text-slate-900"><td className="px-4 py-2.5">Total ({items.length} mat.)</td><td className="px-4 py-2.5 text-right font-mono-num">{totalUnits > 0 ? formatNumber(totalUnits) : '—'}</td><td className="px-4 py-2.5" /><td className="px-4 py-2.5 text-right font-mono-num">{totalKg > 0 ? formatKg(totalKg) : '—'}</td><td className="px-4 py-2.5" /><td className="px-4 py-2.5" /><td className="px-4 py-2.5 no-print" /></tr></tfoot>
        </table>
      </div>
    );
  }

  if (activeCategory === 'arame') {
    let totalBoxUn = 0;
    let totalCoilUn = 0;
    let totalKg = 0;
    for (const item of items) {
      const m = getArameMetrics(item.unidades, item.kg, item.measurementMode);
      totalKg += m.kg;
      if (m.isVariedCoil) {
        totalCoilUn += m.unidades;
      } else {
        totalBoxUn += m.unidades;
      }
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Bitola</th>
              <th className="px-4 py-3">Emb. / Cx</th>
              <th className="px-4 py-3 text-right">Un.</th>
              <th className="px-4 py-3 text-right">Peso (kg)</th>
              <th className="px-4 py-3">NF</th>
              <th className="px-4 py-3">Obs.</th>
              <th className="px-4 py-3 text-right no-print">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {items.map((item) => {
              const metrics = getArameMetrics(item.unidades, item.kg, item.measurementMode);
              return (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    {item.wireType === 'liso'
                      ? 'Liso'
                      : item.wireType === 'torcido'
                        ? 'Torc.'
                        : '—'}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-900 font-mono-num">
                    {item.bitola}
                  </td>
                  <td className="px-4 py-2.5 font-mono-num text-slate-700 whitespace-nowrap">
                    {metrics.isVariedCoil
                      ? 'Bob. kg var.'
                      : metrics.unidades > 0
                        ? formatArameBoxes(metrics.unidades)
                        : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num text-slate-800">
                    {metrics.unidades > 0
                      ? `${formatNumber(metrics.unidades)} ${metrics.isVariedCoil ? 'bob.' : 'un'}`
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num font-medium text-slate-900">
                    {metrics.kg > 0 ? formatKg(metrics.kg) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono-num whitespace-nowrap">
                    {item.notaFiscal ? (
                      <span className="text-slate-800">{item.notaFiscal}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 max-w-xs truncate">
                    {item.notes || '—'}
                  </td>
                  {renderActionCell(item)}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-300 bg-slate-50/80 text-xs font-semibold text-slate-900">
              <td colSpan={2} className="px-4 py-2.5">
                Total ({items.length} {items.length === 1 ? 'item' : 'itens'})
              </td>
              <td className="px-4 py-2.5 font-mono-num text-slate-700">
                {[
                  totalBoxUn > 0 ? formatArameBoxes(totalBoxUn) : null,
                  totalCoilUn > 0 ? `${formatNumber(totalCoilUn)} bob.` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </td>
              <td className="px-4 py-2.5 text-right font-mono-num">
                {[
                  totalBoxUn > 0 ? `${formatNumber(totalBoxUn)} un` : null,
                  totalCoilUn > 0
                    ? `${formatNumber(totalCoilUn)} bob.`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' + ') || '—'}
              </td>
              <td className="px-4 py-2.5 text-right font-mono-num">
                {formatKg(totalKg)}
              </td>
              <td className="px-4 py-2.5" />
              <td className="px-4 py-2.5" />
              <td className="px-4 py-2.5 no-print" />
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  // Visão Geral (all categories)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
            <th className="px-4 py-3">Cat.</th>
            <th className="px-4 py-3">Bitola</th>
            <th className="px-4 py-3">Qtd.</th>
            <th className="px-4 py-3 text-right">Peso / Bal. (kg)</th>
            <th className="px-4 py-3">NF</th>
            <th className="px-4 py-3">Obs. / Det.</th>
            <th className="px-4 py-3 text-right no-print">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-sm">
          {items.map((item) => {
            const catMeta = CATEGORY_MAP[item.category];

            let qtySummary = '—';
            if (item.category === 'estribo') {
              qtySummary = `${formatNumber(item.qtdPecas)} pçs · ${formatNumber(item.qtdPacotes)} pcts`;
            } else if (item.category === 'bobina') {
              qtySummary = `${formatNumber(item.unidades)} un`;
            } else if (item.category === 'barra') {
              qtySummary = item.qtdBarras > 0 ? `${formatNumber(item.qtdBarras)} br` : 'Peso';
            } else if (item.category === 'tela_pop') {
              qtySummary = `${formatNumber(item.unidades)} un`;
            } else if (item.category === 'outros_materiais') {
              qtySummary = [item.unidades > 0 ? `${formatNumber(item.unidades)} un` : '', (item.kgPorUnidade ?? 0) > 0 ? `${formatNumber(item.kgPorUnidade ?? 0, 3)} kg/un` : '', item.kg > 0 ? formatKg(item.kg) : ''].filter(Boolean).join(' · ') || '—';
            } else if (item.category === 'arame') {
              const metrics = getArameMetrics(item.unidades, item.kg, item.measurementMode);
              if (metrics.isVariedCoil) {
                qtySummary =
                  metrics.unidades > 0
                    ? `${formatNumber(metrics.unidades)} bob.`
                    : 'Bob.';
              } else {
                qtySummary =
                  metrics.unidades > 0
                    ? `${formatNumber(metrics.unidades)} un · ${formatArameBoxes(metrics.unidades)}`
                    : '—';
              }
            }

            let detailText = item.notes || '';
            if (item.category === 'estribo' && item.medida) {
              const medidaText = `Med.: ${item.medida}`;
              detailText = detailText ? `${medidaText} · ${detailText}` : medidaText;
            } else if (item.category === 'bobina') {
              const sourceText =
                item.hasLabel && item.hasScaleWeight
                  ? 'Etiq. + Bal.'
                  : item.hasScaleWeight
                    ? 'Bal. (kg)'
                    : item.hasLabel
                      ? 'Etiq.'
                      : '';
              if (sourceText) {
                detailText = detailText ? `${sourceText} · ${detailText}` : sourceText;
              }
            } else if (item.category === 'arame') {
              const wireText =
                item.measurementMode === 'kg'
                  ? `${item.wireType === 'liso' ? 'Liso' : 'Torc.'} · Bob. kg var.`
                  : item.wireType === 'liso'
                    ? 'Liso'
                    : 'Torc.';
              detailText = detailText ? `${wireText} · ${detailText}` : wireText;
            } else if (item.category === 'barra') {
              const hasEtiqueta = item.hasLabel || (!item.hasScaleWeight && item.kg > 0);
              const sourceParts: string[] = [];
              if (hasEtiqueta && item.hasScaleWeight) {
                sourceParts.push('Etiq. + Bal.');
              } else if (item.hasScaleWeight) {
                sourceParts.push('Bal. (kg)');
              } else if (hasEtiqueta) {
                sourceParts.push('Etiq.');
              }
              if (item.labelCode) {
                sourceParts.push(`Cód.: ${item.labelCode}`);
              }
              const barraDetail = sourceParts.join(' · ');
              if (barraDetail) {
                detailText = detailText ? `${barraDetail} · ${detailText}` : barraDetail;
              }
            } else if (item.category === 'tela_pop') {
              const telaSpec = resolveTelaPopByCode(item.bitola);
              if (telaSpec) {
                const telaInfo = `${telaSpec.shortNome} · ${telaSpec.malha}`;
                detailText = detailText ? `${telaInfo} · ${detailText}` : telaInfo;
              }
            }

            const arameKg =
              item.category === 'arame'
                ? getArameMetrics(item.unidades, item.kg, item.measurementMode).kg
                : item.kg;
            const dualEtiquetaKg =
              item.category === 'bobina' || item.category === 'barra'
                ? item.hasLabel || !item.hasScaleWeight
                  ? item.kg
                  : 0
                : 0;

            return (
              <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-4 py-2.5 font-medium text-slate-900 whitespace-nowrap">
                  {catMeta.shortLabel}
                </td>
                <td className="px-4 py-2.5 font-mono-num text-slate-800 whitespace-nowrap">
                  {item.category === 'outros_materiais' ? (item.materialName || item.bitola) : item.bitola}
                </td>
                <td className="px-4 py-2.5 font-mono-num text-slate-700 whitespace-nowrap">
                  {qtySummary}
                </td>
                <td className="px-4 py-2.5 text-right font-mono-num font-medium text-slate-900 whitespace-nowrap">
                  {item.category === 'tela_pop' ? (
                    <span className="text-slate-400 font-normal">—</span>
                  ) : item.category === 'bobina' || item.category === 'barra' ? (
                    <div className="inline-flex flex-col items-end">
                      {dualEtiquetaKg > 0 && (
                        <span>
                          {item.hasScaleWeight ? `Etiq.: ${formatKg(dualEtiquetaKg)}` : formatKg(dualEtiquetaKg)}
                        </span>
                      )}
                      {item.hasScaleWeight && item.scaleWeightKg > 0 && (
                        <span
                          className={
                            dualEtiquetaKg > 0
                              ? 'text-[11px] text-orange-700 font-normal'
                              : 'text-slate-900 font-medium'
                          }
                        >
                          {dualEtiquetaKg > 0
                            ? `Bal.: ${formatKg(item.scaleWeightKg)}`
                            : formatKg(item.scaleWeightKg)}
                        </span>
                      )}
                      {dualEtiquetaKg <= 0 && (!item.hasScaleWeight || item.scaleWeightKg <= 0) && (
                        <span>—</span>
                      )}
                    </div>
                  ) : (
                    <span>{arameKg > 0 ? formatKg(arameKg) : '—'}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs font-mono-num whitespace-nowrap">
                  {item.category !== 'estribo' && item.notaFiscal ? (
                    <span className="text-slate-800">{item.notaFiscal}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-600 max-w-xs truncate">
                  {detailText || '—'}
                </td>
                {renderActionCell(item)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
