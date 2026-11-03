/**
 * A small chart kit for the Charts page: plain SVG and HTML, no chart library.
 *
 * Every chart has a hover/focus tooltip and a "Show as table" view, so a value
 * is never readable by colour or hover alone. Colours follow the version, not
 * the rank: the House bill is always blue, the NEP always orange, an enacted
 * budget always ink.
 */
import { useState, type FocusEvent, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { php } from '../../lib/format';
import Info from '../Info';
import { useTip, useWidth, type Series } from './tokens';

export function TipRow({ color, label, value, ring }: { color?: string; label: ReactNode; value: ReactNode; ring?: boolean }) {
  return (
    <span className="ctip-row">
      {color && <i style={ring ? { boxShadow: `inset 0 0 0 2px ${color}` } : { background: color }} />}
      <span>{label}</span>
      <b className="num">{value}</b>
    </span>
  );
}

export function Legend({ items }: { items: { label: string; color: string; ring?: boolean }[] }) {
  return (
    <p className="clegend">
      {items.map((i) => (
        <span key={i.label}>
          <i style={i.ring ? { boxShadow: `inset 0 0 0 2px ${i.color}` } : { background: i.color }} />
          {i.label}
        </span>
      ))}
    </p>
  );
}

export interface Table { head: string[]; rows: ReactNode[][] }

/** A chart with its title, a note, and the same figures as a table. */
export function ChartCard({ title, sub, note, info, table, wide, children }: { title: ReactNode; sub?: ReactNode; note?: ReactNode; info?: ReactNode; table?: Table; wide?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <figure className={`ccard${wide ? ' ccard-wide' : ''}`}>
      <figcaption>
        <h3>{title}{info && <Info>{info}</Info>}</h3>
        {sub && <p className="csub">{sub}</p>}
      </figcaption>
      {children}
      {note && <p className="cnote">{note}</p>}
      {table && (
        <>
          <button type="button" className="link-button ctable-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide table' : 'Show as table'}
          </button>
          {open && (
            <div className="ctable-wrap">
              <table className="ctable">
                <thead>
                  <tr>{table.head.map((h, i) => <th key={i} className={i ? 'r' : undefined}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {table.rows.map((r, i) => (
                    <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'r num' : undefined}>{c}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Horizontal bars: one row per category, one bar per series.
// ---------------------------------------------------------------------------

export interface HRow {
  key: string;
  label: ReactNode;
  sub?: ReactNode;
  values: (number | null)[];
  /** Opens the project list (or a project) filtered to this row. */
  to?: string;
  /** A bucket rather than a category (no town named, several towns): drawn quieter. */
  muted?: boolean;
  /** Overrides the series colour (one series, rows that are themselves versions). */
  color?: string;
  /** Makes the row a toggle (a drill-down below the chart) instead of a link. */
  onSelect?: () => void;
  active?: boolean;
  extra?: ReactNode;
}

export function HBars({ rows, series, format = php }: { rows: HRow[]; series: Series[]; format?: (n: number) => string }) {
  const { box: tipBox, show: tipShow, hide: tipHide, node: tipNode } = useTip();
  const max = Math.max(1, ...rows.flatMap((r) => r.values.map((v) => v ?? 0)));
  return (
    <div className="chart" ref={tipBox} onMouseLeave={tipHide}>
      {series.length > 1 && <Legend items={series} />}
      <div className="hbars">
        {rows.map((r) => {
          const body = (
            <>
              <strong>{r.label}</strong>
              {series.map((s, i) => <TipRow key={s.key} color={r.color ?? s.color} label={s.label} value={r.values[i] == null ? '—' : format(r.values[i]!)} />)}
              {r.extra}
            </>
          );
          const inner = (
            <>
              <span className="hb-label">
                <span className="hb-name">{r.label}</span>
                {r.sub && <span className="hb-sub">{r.sub}</span>}
              </span>
              <span className="hb-bars">
                {series.map((s, i) => {
                  const v = r.values[i];
                  const pct = v ? Math.max(0.4, (v / max) * 100) : 0;
                  return (
                    <span className="hb-track" key={s.key}>
                      <span className="hb-bar" style={{ width: `${pct}%`, background: r.color ?? s.color, opacity: r.muted ? 0.5 : 1 }} />
                      <span className="hb-v num" style={{ left: `calc(${pct}% + 6px)` }}>{v == null ? '—' : format(v)}</span>
                    </span>
                  );
                })}
              </span>
            </>
          );
          const handlers = { onMouseMove: (e: MouseEvent) => tipShow(e, body), onFocus: (e: FocusEvent) => tipShow(e, body), onBlur: tipHide };
          return r.to ? (
            <Link key={r.key} to={r.to} className="hb-row" {...handlers}>{inner}</Link>
          ) : r.onSelect ? (
            <button key={r.key} type="button" className={`hb-row hb-button${r.active ? ' active' : ''}`} aria-pressed={!!r.active} onClick={r.onSelect} {...handlers}>{inner}</button>
          ) : (
            <div key={r.key} className="hb-row" tabIndex={0} {...handlers}>{inner}</div>
          );
        })}
      </div>
      {tipNode}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Columns: categories along x; series grouped side by side, or stacked.
// ---------------------------------------------------------------------------

function niceMax(max: number, ticks = 4): { top: number; step: number } {
  const raw = max / ticks || 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  const step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  return { top: Math.ceil(max / step) * step || step, step };
}

/** A bar path with a 4px rounded top and a square base. */
function colPath(x: number, y: number, w: number, h: number, round: boolean): string {
  const r = round ? Math.min(4, w / 2, h) : 0;
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function Columns({
  cats,
  series,
  values,
  stacked,
  format = php,
  height = 240,
  picked,
  onPick,
  catSub,
}: {
  cats: string[];
  series: Series[];
  /** values[cat][series] */
  values: (number | null)[][];
  stacked?: boolean;
  format?: (n: number) => string;
  height?: number;
  picked?: string | null;
  onPick?: (cat: string) => void;
  catSub?: (i: number) => ReactNode;
}) {
  const { box: tipBox, show: tipShow, hide: tipHide, node: tipNode } = useTip();
  const [wrap, width] = useWidth<HTMLDivElement>();
  const m = { t: 22, r: 16, b: 30, l: 58 };
  const w = Math.max(0, width - m.l - m.r);
  const h = height - m.t - m.b;
  const totals = values.map((row) => (stacked ? row.reduce<number>((a, v) => a + (v ?? 0), 0) : Math.max(0, ...row.map((v) => v ?? 0))));
  const { top, step } = niceMax(Math.max(1, ...totals));
  const y = (v: number) => h - (v / top) * h;
  const band = cats.length ? w / cats.length : 0;
  const barW = Math.max(4, Math.min(stacked ? 28 : 22, (band * 0.7) / (stacked ? 1 : series.length)));
  const groupW = stacked ? barW : barW * series.length + 2 * (series.length - 1);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const labelCaps = stacked || series.length === 1;

  return (
    <div className="chart" ref={tipBox} onMouseLeave={tipHide}>
      {series.length > 1 && <Legend items={series} />}
      <div ref={wrap} className="cols">
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label="Column chart; the same figures are in the table view">
            <g transform={`translate(${m.l},${m.t})`}>
              {ticks.map((t) => (
                <g key={t} transform={`translate(0,${y(t)})`}>
                  <line x2={w} className={t ? 'grid' : 'base'} />
                  <text x={-8} dy="0.32em" textAnchor="end" className="tick">{format(t)}</text>
                </g>
              ))}
              {cats.map((c, i) => {
                const x0 = i * band + (band - groupW) / 2;
                let acc = 0;
                const last = values[i].reduce((k, v, j) => ((v ?? 0) > 0 ? j : k), -1);
                const body = (
                  <>
                    <strong>{c}</strong>
                    {series.map((s, j) => <TipRow key={s.key} color={s.color} label={s.label} value={values[i][j] == null ? '—' : format(values[i][j]!)} />)}
                    {stacked && series.length > 1 && <TipRow label="Total" value={format(totals[i])} />}
                    {catSub?.(i)}
                  </>
                );
                return (
                  <g
                    key={c}
                    className={`col${onPick ? ' pickable' : ''}${picked === c ? ' picked' : ''}${picked && picked !== c ? ' dim' : ''}`}
                    tabIndex={0}
                    role={onPick ? 'button' : undefined}
                    aria-label={`${c}: ${series.map((s, j) => `${s.label} ${values[i][j] == null ? 'none' : format(values[i][j]!)}`).join(', ')}`}
                    onMouseMove={(e) => tipShow(e, body)}
                    onFocus={(e) => tipShow(e, body)}
                    onBlur={tipHide}
                    onClick={() => onPick?.(c)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick && (e.preventDefault(), onPick(c))}
                  >
                    <rect x={i * band} y={0} width={band} height={h} className="hit" />
                    {series.map((s, j) => {
                      const v = values[i][j] ?? 0;
                      if (v <= 0) return null;
                      if (stacked) {
                        const y1 = y(acc + v);
                        const hh = y(acc) - y1 - (acc > 0 ? 2 : 0);
                        acc += v;
                        return hh > 0 ? <path key={s.key} d={colPath(x0, y1, barW, hh, j === last)} fill={s.color} /> : null;
                      }
                      const yy = y(v);
                      return <path key={s.key} d={colPath(x0 + j * (barW + 2), yy, barW, h - yy, true)} fill={s.color} />;
                    })}
                    {labelCaps && totals[i] > 0 && (
                      <text x={x0 + groupW / 2} y={y(totals[i]) - 6} textAnchor="middle" className="cap">{format(totals[i])}</text>
                    )}
                    <text x={i * band + band / 2} y={h + 18} textAnchor="middle" className="xlab">{c}</text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </div>
      {tipNode}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lines: a few series over the years, with a crosshair.
// ---------------------------------------------------------------------------

export function Lines({ xs, series, values, format = php, height = 260 }: { xs: string[]; series: Series[]; values: (number | null)[][]; format?: (n: number) => string; height?: number }) {
  const { box: tipBox, show: tipShow, hide: tipHide, node: tipNode } = useTip();
  const [wrap, width] = useWidth<HTMLDivElement>();
  const [at, setAt] = useState<number | null>(null);
  const m = { t: 16, r: 16, b: 30, l: 58 };
  const w = Math.max(0, width - m.l - m.r);
  const h = height - m.t - m.b;
  const { top, step } = niceMax(Math.max(1, ...values.flat().map((v) => v ?? 0)));
  const x = (i: number) => (xs.length > 1 ? (i / (xs.length - 1)) * w : w / 2);
  const y = (v: number) => h - (v / top) * h;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  const body = (i: number) => (
    <>
      <strong>{xs[i]}</strong>
      {series.map((s, j) => <TipRow key={s.key} color={s.color} label={s.label} value={values[j][i] == null ? '—' : format(values[j][i]!)} />)}
    </>
  );
  const pick = (e: MouseEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.max(0, Math.min(xs.length - 1, Math.round(((e.clientX - r.left) / r.width) * (xs.length - 1))));
    setAt(i);
    tipShow(e, body(i));
  };

  return (
    <div className="chart" ref={tipBox} onMouseLeave={() => { tipHide(); setAt(null); }}>
      {series.length > 1 && <Legend items={series} />}
      <div ref={wrap} className="cols">
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label="Line chart; the same figures are in the table view">
            <g transform={`translate(${m.l},${m.t})`}>
              {ticks.map((t) => (
                <g key={t} transform={`translate(0,${y(t)})`}>
                  <line x2={w} className={t ? 'grid' : 'base'} />
                  <text x={-8} dy="0.32em" textAnchor="end" className="tick">{format(t)}</text>
                </g>
              ))}
              {xs.map((label, i) => <text key={label} x={x(i)} y={h + 18} textAnchor="middle" className="xlab">{label}</text>)}
              {at != null && <line x1={x(at)} x2={x(at)} y2={h} className="crosshair" />}
              {series.map((s, j) => {
                // A missing year breaks the line rather than drawing it through zero.
                const d = values[j].map((v, i) => (v == null ? '' : `${i && values[j][i - 1] != null ? 'L' : 'M'}${x(i)},${y(v)}`)).join('');
                return (
                  <g key={s.key}>
                    <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                    {values[j].map((v, i) => v != null && (
                      <circle key={i} cx={x(i)} cy={y(v)} r={at === i ? 5 : 4} fill={s.color} stroke="#fff" strokeWidth={2} />
                    ))}
                  </g>
                );
              })}
              <rect width={w} height={h} className="hit" onMouseMove={pick} />
            </g>
          </svg>
        )}
      </div>
      {/* Keyboard: step through the years. */}
      <div className="sr-only">
        {xs.map((label, i) => <button key={label} type="button" onFocus={(e) => { setAt(i); tipShow(e, body(i)); }} onBlur={tipHide}>{label}</button>)}
      </div>
      {tipNode}
    </div>
  );
}

