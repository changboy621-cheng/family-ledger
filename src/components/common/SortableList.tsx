import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GripVertical } from 'lucide-react';
import { arrayMove } from '../../lib/categoryOrder';

interface SortableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** 拖曳過程中即時回報新順序（僅供畫面即時反映，勿在此寫入後端）。 */
  onReorder: (next: T[]) => void;
  /** 放開手指時回報最終順序（在此持久化）。 */
  onCommit?: (next: T[]) => void;
}

// 以 pointer events 實作的垂直拖曳排序清單（滑鼠與觸控通用）。
// 只有左側把手能發動拖曳；把手設 touch-action:none，讓觸控時是拖曳而非捲動頁面。
export function SortableList<T>({ items, getId, renderItem, onReorder, onCommit }: SortableListProps<T>) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // 用 ref 持有最新值，讓掛在 window 的事件監聽在清單重排後仍讀得到當前狀態與回呼。
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  useEffect(() => {
    if (draggingId == null) return undefined;

    function onMove(event: PointerEvent) {
      const list = listRef.current;
      if (!list) return;
      const rows = Array.from(list.querySelectorAll<HTMLElement>('[data-sortable-id]'));
      const current = itemsRef.current;
      const fromIndex = current.findIndex((item) => getId(item) === draggingId);
      if (fromIndex === -1) return;

      // 由上往下找第一個「中線在指標下方」的列，插到它前面；都在上方則插到最後。
      let toIndex = rows.length - 1;
      for (let i = 0; i < rows.length; i += 1) {
        const rect = rows[i].getBoundingClientRect();
        if (event.clientY < rect.top + rect.height / 2) {
          toIndex = i;
          break;
        }
      }

      if (toIndex !== fromIndex) {
        onReorderRef.current(arrayMove(current, fromIndex, toIndex));
      }
    }

    function onUp() {
      setDraggingId(null);
      onCommitRef.current?.(itemsRef.current);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [draggingId, getId]);

  return (
    <ul ref={listRef} className="grid gap-2">
      {items.map((item) => {
        const id = getId(item);
        const dragging = id === draggingId;
        return (
          <li
            key={id}
            data-sortable-id={id}
            className={`flex items-center gap-2 rounded-lg border bg-white px-2 py-2 transition ${
              dragging ? 'border-family shadow-lg ring-2 ring-family/30' : 'border-slate-200'
            }`}
          >
            <button
              type="button"
              aria-label="拖曳排序"
              className="grid h-9 w-9 shrink-0 cursor-grab touch-none place-items-center rounded-md text-slate-400 active:cursor-grabbing"
              style={{ touchAction: 'none' }}
              onPointerDown={(event) => {
                event.preventDefault();
                setDraggingId(id);
              }}
            >
              <GripVertical className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1 select-none">{renderItem(item)}</div>
          </li>
        );
      })}
    </ul>
  );
}
