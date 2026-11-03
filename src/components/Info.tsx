/**
 * An ⓘ beside a heading or a figure: says what the information is about.
 * Opens on hover, on keyboard focus and on tap (for phones); Escape or a tap
 * elsewhere closes it. The text is also the button's accessible description.
 */
import { useId, useRef, useState, type ReactNode } from 'react';

export default function Info({ children, label = 'What is this?' }: { children: ReactNode; label?: string }) {
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  // Where the box starts, relative to the icon: kept inside the screen with an 8px margin.
  const [open, setOpen] = useState<null | { left: number; width: number }>(null);
  const show = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const vw = document.documentElement.clientWidth;
    const width = Math.min(320, vw - 16);
    const left = Math.min(Math.max(r.left - 4, 8), vw - width - 8);
    setOpen({ left: left - r.left, width });
  };
  return (
    <span className="info" onMouseEnter={show} onMouseLeave={() => setOpen(null)}>
      <button
        ref={btn}
        type="button"
        className="info-btn"
        aria-label={label}
        aria-expanded={!!open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // A tap also fires hover and focus first, so a click only ever opens; blur, Escape or leaving closes.
          show();
        }}
        onFocus={show}
        onBlur={() => setOpen(null)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(null)}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <rect x="7.3" y="7" width="1.4" height="4.6" rx="0.7" fill="currentColor" />
          <circle cx="8" cy="4.8" r="0.9" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <span role="tooltip" id={id} className="info-pop" style={{ left: open.left, width: open.width }}>
          {children}
        </span>
      )}
    </span>
  );
}
