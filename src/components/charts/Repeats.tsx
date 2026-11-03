/**
 * Amounts that repeat: how many lines carry exactly the same amount, per
 * version. Many lines share a few round sums (₱50M, ₱100M, ₱150M), which shows
 * how the budget was written: a set sum per line, the work fitted to it. A row
 * opens the lines at that amount.
 *
 * A repeated amount is a pattern to ask about, not a finding: it does not by
 * itself show that any line is overpriced.
 */
import { useMemo, useState } from 'react';
import { count, php, plural } from '../../lib/format';
import type { ScopedProject } from '../../lib/scope';
import { ChartCard, HBars, type HRow } from './Kit';
import { VERSIONS, countFmt } from './tokens';

/** Amounts shown: shared by at least this many lines in one version. */
const MIN_LINES = 3;
const MAX_ROWS = 12;
const MAX_DRILL = 15;

const shortOffice = (o: string | null) => (o ? o.replace(/ District Engineering Office$/, ' DEO') : 'No DPWH office');

export default function Repeats({ rows }: { rows: ScopedProject[] }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [all, setAll] = useState(false);

  const amounts = useMemo(() => {
    const m = new Map<number, { nep: number; house: number; offices: Map<string, number> }>();
    const at = (v: number) => m.get(v) ?? (m.set(v, { nep: 0, house: 0, offices: new Map() }), m.get(v)!);
    for (const p of rows) {
      if (p.nep_php) at(p.nep_php).nep++;
      if (p.house_php) at(p.house_php).house++;
      // Offices count each line once, whichever version carries the amount.
      for (const v of new Set([p.nep_php, p.house_php])) {
        if (!v) continue;
        const o = at(v).offices;
        o.set(shortOffice(p.office), (o.get(shortOffice(p.office)) ?? 0) + 1);
      }
    }
    return [...m]
      .map(([amount, c]) => ({ amount, ...c, most: Math.max(c.nep, c.house) }))
      .filter((x) => x.most >= MIN_LINES)
      .sort((a, b) => b.most - a.most || b.amount - a.amount)
      .slice(0, MAX_ROWS);
  }, [rows]);

  const nepLines = rows.filter((p) => p.nep_php != null);
  const houseLines = rows.filter((p) => p.house_php != null);
  const round = (xs: ScopedProject[], v: (p: ScopedProject) => number | null) => xs.filter((p) => (v(p) ?? 1) % 10e6 === 0).length;

  if (!amounts.length) return null;

  const chartRows: HRow[] = amounts.map((a) => {
    const [office, n] = [...a.offices].sort((x, y) => y[1] - x[1])[0];
    const lines = [...a.offices.values()].reduce((x, y) => x + y, 0);
    return {
      key: String(a.amount),
      label: php(a.amount),
      sub: `${count(n)} of ${count(lines)} under ${office}`,
      values: [a.nep || null, a.house || null],
      onSelect: () => { setPicked((p) => (p === a.amount ? null : a.amount)); setAll(false); },
      active: picked === a.amount,
    };
  });

  const drill = picked == null ? [] : rows
    .filter((p) => p.nep_php === picked || p.house_php === picked)
    .sort((a, b) => (a.office ?? '').localeCompare(b.office ?? '') || a.title.localeCompare(b.title));
  const drillRows: HRow[] = drill.slice(0, all ? drill.length : MAX_DRILL).map((p) => ({
    key: p.key,
    label: p.title.length > 90 ? p.title.slice(0, 88) + '…' : p.title,
    sub: `${shortOffice(p.office)} · ${p.status_label}`,
    values: [p.nep_php, p.house_php],
    to: `/projects/${p.dataset}/${encodeURIComponent(p.id)}`,
  }));

  return (
    <ChartCard
      wide
      title="Amounts that repeat"
      info={
        <>
          Each bar counts the lines that carry exactly this amount: orange in the NEP, blue in the House bill. Only amounts shared by{' '}
          {MIN_LINES} or more lines are shown. Click an amount to list its lines; each opens its project page and the page of the budget
          document it is on.
        </>
      }
      sub={`How many lines carry exactly the same amount, per version · amounts shared by ${MIN_LINES} or more lines · click an amount for its lines`}
      note={
        <>
          Many lines share a few round sums. That shows how the budget was written: often a set sum per line, with the stretch of road
          or dike sized to fit it, or one phase of a longer project. A repeated amount is a pattern to ask about, not a finding: it does
          not by itself show that any line is overpriced. Under each amount: how many of its lines one office has, for the office with the most.
        </>
      }
      table={{ head: ['Amount', 'NEP lines', 'House bill lines', 'Most lines under'], rows: amounts.map((a, i) => [php(a.amount), count(a.nep), count(a.house), chartRows[i].sub]) }}
    >
      <p className="cstat">
        {count(round(nepLines, (p) => p.nep_php))} of {plural(nepLines.length, 'NEP line')} and {count(round(houseLines, (p) => p.house_php))} of{' '}
        {plural(houseLines.length, 'House bill line')} are exact multiples of ₱10M.
      </p>
      <HBars rows={chartRows} series={VERSIONS} format={countFmt} />
      {picked != null && (
        <div className="drill">
          <h4>{plural(drill.length, 'line')} at {php(picked)} in either version</h4>
          <HBars rows={drillRows} series={VERSIONS} />
          {drill.length > MAX_DRILL && (
            <p className="drill-more">
              {all ? <>All {count(drill.length)} shown. </> : <>Showing {count(MAX_DRILL)} of {count(drill.length)}. </>}
              <button type="button" className="link-button" onClick={() => setAll((v) => !v)}>{all ? 'Show fewer' : `Show all ${count(drill.length)}`}</button>
            </p>
          )}
        </div>
      )}
    </ChartCard>
  );
}
