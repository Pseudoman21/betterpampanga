/**
 * A dropdown drawn by the portal instead of the browser, so it looks the same
 * everywhere and can show each option's count. It follows the WAI-ARIA
 * "select-only combobox" pattern: focus stays on the button, the list is a
 * listbox, and the keyboard works as on a native select (arrows, Home/End,
 * Enter/Space, Escape, Tab, and typing the first letters of an option).
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

export interface Option { value: string; label: string; count?: number }

export default function Select({ label, value, options, onChange }: { label: string; value: string; options: Option[]; onChange: (value: string) => void }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const selected = Math.max(0, options.findIndex((o) => o.value === value));
  const [active, setActive] = useState(selected);
  const current = options[selected];

  const show = (at = selected) => {
    const r = root.current?.getBoundingClientRect();
    setAlignRight(!!r && r.left > document.documentElement.clientWidth / 2);
    setActive(at);
    setOpen(true);
  };
  const choose = (i: number) => {
    setOpen(false);
    if (options[i] && options[i].value !== value) onChange(options[i].value);
  };

  // Close on a click or tap outside.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  // Keep the active option in view while moving through a long list.
  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const onKey = (e: KeyboardEvent) => {
    const last = options.length - 1;
    const move = (i: number) => (open ? setActive(Math.min(last, Math.max(0, i))) : show(Math.min(last, Math.max(0, i))));
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); return open ? move(active + 1) : show();
      case 'ArrowUp': e.preventDefault(); return open ? move(active - 1) : show();
      case 'Home': e.preventDefault(); return move(0);
      case 'End': e.preventDefault(); return move(last);
      case 'PageDown': e.preventDefault(); return move(active + 10);
      case 'PageUp': e.preventDefault(); return move(active - 10);
      case 'Enter':
      case ' ':
        e.preventDefault();
        return open ? choose(active) : show();
      case 'Escape':
        if (open) { e.preventDefault(); setOpen(false); }
        return;
      case 'Tab':
        if (open) choose(active);
        return;
    }
    // Type to jump: the first option whose label starts with what was typed.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + e.key.toLowerCase(), at: now };
      const from = open ? active : selected;
      const order = [...options.keys()].map((k) => (from + 1 + k) % options.length);
      const hit = order.find((i) => options[i].label.toLowerCase().startsWith(typed.current.text));
      if (hit != null) move(hit);
    }
  };

  return (
    <div className="field">
      <span className="label" id={`${id}-label`}>{label}</span>
      <div className={`cselect${open ? ' open' : ''}`} ref={root}>
        <button
          type="button"
          role="combobox"
          className="cselect-button"
          aria-labelledby={`${id}-label ${id}-value`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-activedescendant={open ? `${id}-${active}` : undefined}
          onClick={() => (open ? setOpen(false) : show())}
          onKeyDown={onKey}
        >
          <span id={`${id}-value`} className="cselect-value">{current?.label}</span>
          {current?.count != null && <span className="cselect-count num">{current.count.toLocaleString('en-US')}</span>}
          <svg className="cselect-caret" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className={`cselect-list${alignRight ? ' right' : ''}`}
          hidden={!open}
          tabIndex={-1}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === selected}
              className={`cselect-option${i === active ? ' active' : ''}`}
              onPointerMove={() => setActive(i)}
              // Keep focus on the button so the keyboard keeps working.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
            >
              <svg className="cselect-check" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="cselect-label">{o.label}</span>
              {o.count != null && <span className="cselect-count num">{o.count.toLocaleString('en-US')}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
