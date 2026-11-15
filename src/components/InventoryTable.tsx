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
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
              <th className="px-4 py-3">Bitola</th>
              <th className="px-4 py-3">Medida</th>
              <th className="px-4 py-3 text-right">Qtd. Peças</th>
              <th className="px-4 py-3 text-right">Qtd. Pacotes</th>
              <th className="px-4 py-3 text-right">Peso (Kg)</th>
              <th className="px-4 py-3">Observações</th>
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
        </table>
      </div>
    );
  }

  if (activeCategory === 'bobina') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
              <th className="px-4 py-3">Bitola</th>
              <th className="px-4 py-3 text-right">Unidades</th>
              <th className="px-4 py-3 text-right">Peso (Kg)</th>
              <th className="px-4 py-3">Observações</th>
              <th className="px-4 py-3 text-right no-print">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-4 py-2.5 font-medium text-slate-900 font-mono-num">
                  {item.bitola}
                </td>
                <td className="px-4 py-2.5 text-right font-mono-num text-slate-800">
                  {formatNumber(item.unidades)}
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
        </table>
      </div>
    );
  }

  if (activeCategory === 'barra') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
              <th className="px-4 py-3">Bitola</th>
              <th className="px-4 py-3 text-right">Qtd. Barras</th>
              <th className="px-4 py-3 text-right">Peso (Kg)</th>
              <th className="px-4 py-3">Etiqueta</th>
              <th className="px-4 py-3 text-right">Balança (Kg)</th>
              <th className="px-4 py-3">Observações</th>
              <th className="px-4 py-3 text-right no-print">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm">
            {items.map((item) => {
              const showDiff =
                item.hasScaleWeight && item.kg > 0 && Math.abs(item.scaleWeightKg - item.kg) > 0.01;
              const diff = item.scaleWeightKg - item.kg;

              return (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-slate-900 font-mono-num">
                    {item.bitola}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num text-slate-800">
                    {item.qtdBarras > 0 ? formatNumber(item.qtdBarras) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num font-medium text-slate-900">
                    {item.kg > 0 ? formatKg(item.kg) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {item.hasLabel ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                        <Tag className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Com etiqueta{item.labelCode ? ` · ${item.labelCode}` : ''}
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate-400">Sem etiqueta</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num">
                    {item.hasScaleWeight ? (
                      <div className="inline-flex flex-col items-end">
                        <span className="inline-flex items-center gap-1 text-slate-900 font-medium">
                          <Scale className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                          {formatKg(item.scaleWeightKg)}
                        </span>
                        {showDiff && (
                          <span
                            className={`text-[11px] ${
                              diff > 0 ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {diff > 0 ? '+' : ''}
                            {formatKg(diff)} vs lote
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Não pesada</span>
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
        </table>
      </div>
    );
  }

  if (activeCategory === 'tela_pop') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
              <th className="px-4 py-3">Código / Bitola</th>
              <th className="px-4 py-3">Tela identificada</th>
              <th className="px-4 py-3 text-right">Quantidade</th>
              <th className="px-4 py-3">Observações</th>
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
                        <span className="font-medium text-slate-900">{telaSpec.nome}</span>
                        <span className="text-xs text-slate-500 font-mono-num ml-2">
                          Malha {telaSpec.malha} · {telaSpec.painel}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Código personalizado</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num font-medium text-slate-900">
                    {formatNumber(item.unidades)} un
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 max-w-xs truncate">
                    {item.notes || '—'}
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

  if (activeCategory === 'arame') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Bitola</th>
              <th className="px-4 py-3">Embalagem / Caixas</th>
              <th className="px-4 py-3 text-right">Unidades</th>
              <th className="px-4 py-3 text-right">Peso (Kg)</th>
              <th className="px-4 py-3">Observações</th>
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
                        ? 'Torcido'
                        : '—'}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-900 font-mono-num">
                    {item.bitola}
                  </td>
                  <td className="px-4 py-2.5 font-mono-num text-slate-700 whitespace-nowrap">
                    {metrics.isVariedCoil
                      ? 'Bobina (Kg variado)'
                      : metrics.unidades > 0
                        ? formatArameBoxes(metrics.unidades)
                        : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num text-slate-800">
                    {metrics.unidades > 0
                      ? `${formatNumber(metrics.unidades)} ${metrics.isVariedCoil ? (metrics.unidades === 1 ? 'bobina' : 'bobinas') : 'un'}`
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-num font-medium text-slate-900">
                    {metrics.kg > 0 ? formatKg(metrics.kg) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 max-w-xs truncate">
                    {item.notes || '—'}
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

  // Visão Geral (all categories)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
            <th className="px-4 py-3">Categoria</th>
            <th className="px-4 py-3">Bitola</th>
            <th className="px-4 py-3">Quantidades</th>
            <th className="px-4 py-3 text-right">Peso / Balança (Kg)</th>
            <th className="px-4 py-3">Detalhes</th>
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
              qtySummary = item.qtdBarras > 0 ? `${formatNumber(item.qtdBarras)} barras` : 'Por peso';
            } else if (item.category === 'tela_pop') {
              qtySummary = `${formatNumber(item.unidades)} telas`;
            } else if (item.category === 'arame') {
              const metrics = getArameMetrics(item.unidades, item.kg, item.measurementMode);
              if (metrics.isVariedCoil) {
                qtySummary =
                  metrics.unidades > 0
                    ? `${formatNumber(metrics.unidades)} ${metrics.unidades === 1 ? 'bobina' : 'bobinas'}`
                    : 'Bobina';
              } else {
                qtySummary =
                  metrics.unidades > 0
                    ? `${formatNumber(metrics.unidades)} un · ${formatArameBoxes(metrics.unidades)}`
                    : '—';
              }
            }

            let detailText = item.notes || '';
            if (item.category === 'estribo' && item.medida) {
              const medidaText = `Medida: ${item.medida}`;
              detailText = detailText ? `${medidaText} · ${detailText}` : medidaText;
            } else if (item.category === 'arame') {
              const wireText =
                item.measurementMode === 'kg'
                  ? `${item.wireType === 'liso' ? 'Arame Liso' : 'Arame Torcido'} · Bobina (Kg variado)`
                  : item.wireType === 'liso'
                    ? 'Arame Liso'
                    : 'Arame Torcido';
              detailText = detailText ? `${wireText} · ${detailText}` : wireText;
            } else if (item.category === 'barra') {
              const labelText = item.hasLabel
                ? `Com etiqueta${item.labelCode ? ` (${item.labelCode})` : ''}`
                : 'Sem etiqueta';
              detailText = detailText ? `${labelText} · ${detailText}` : labelText;
            } else if (item.category === 'tela_pop') {
              const telaSpec = resolveTelaPopByCode(item.bitola);
              if (telaSpec) {
                const telaInfo = `${telaSpec.nome} · Malha ${telaSpec.malha}`;
                detailText = detailText ? `${telaInfo} · ${detailText}` : telaInfo;
              }
            }

            const arameKg =
              item.category === 'arame'
                ? getArameMetrics(item.unidades, item.kg, item.measurementMode).kg
                : item.kg;

            return (
              <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-4 py-2.5 font-medium text-slate-900 whitespace-nowrap">
                  {catMeta.label}
                </td>
                <td className="px-4 py-2.5 font-mono-num text-slate-800 whitespace-nowrap">
                  {item.bitola}
                </td>
                <td className="px-4 py-2.5 font-mono-num text-slate-700 whitespace-nowrap">
                  {qtySummary}
                </td>
                <td className="px-4 py-2.5 text-right font-mono-num font-medium text-slate-900 whitespace-nowrap">
                  {item.category === 'tela_pop' ? (
                    <span className="text-slate-400 font-normal">—</span>
                  ) : item.category === 'barra' ? (
                    <div className="inline-flex flex-col items-end">
                      <span>{item.kg > 0 ? formatKg(item.kg) : '—'}</span>
                      {item.hasScaleWeight && (
                        <span className="text-[11px] text-orange-700 font-normal">
                          Balança: {formatKg(item.scaleWeightKg)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span>{arameKg > 0 ? formatKg(arameKg) : '—'}</span>
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
