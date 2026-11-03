/** The Charts page's colours and the hooks its charts share. */
import { useEffect, useRef, useState, type FocusEvent, type MouseEvent, type ReactNode } from 'react';
import { count } from '../../lib/format';

export const COLOR = {
  house: '#2a78d6',
  nep: '#eb6834',
  gaa: '#3d4757',
  other: '#b9bec8',
} as const;

/** Three DPWH offices, or three departments: validated as a set (all pairs). */
export const TRIO = ['#199e70', '#6250d6', '#d95926'] as const;

export interface Series { key: string; label: string; color: string }

export const VERSIONS: Series[] = [
  { key: 'nep', label: 'NEP', color: COLOR.nep },
  { key: 'house', label: 'House bill', color: COLOR.house },
];

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

type TipEvent = MouseEvent<Element> | FocusEvent<Element>;

/** A tooltip that follows the pointer (or sits on the focused mark) inside `box`. */
export function useTip() {
  // A callback ref held in state, so the handlers can read it and render never touches a ref.
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; flip: boolean; body: ReactNode } | null>(null);
  const show = (e: TipEvent, body: ReactNode) => {
    const r = box?.getBoundingClientRect();
    if (!r) return;
    let x: number, y: number;
    if ('clientX' in e && e.clientX) [x, y] = [e.clientX - r.left, e.clientY - r.top];
    else {
      const t = (e.currentTarget as Element).getBoundingClientRect();
      [x, y] = [t.left + Math.min(t.width, 160) - r.left, t.top + t.height / 2 - r.top];
    }
    setTip({ x, y, flip: x > r.width / 2, body });
  };
  const node = tip && (
    <div
      className="ctip"
      role="status"
      style={{ left: tip.x, top: tip.y, transform: `translate(${tip.flip ? 'calc(-100% - 14px)' : '14px'}, -50%)` }}
    >
      {tip.body}
    </div>
  );
  return { box: setBox, show, hide: () => setTip(null), node };
}


/** Counts on an axis: 0, 25, 50 … */
export const countFmt = (n: number) => count(Math.round(n));
