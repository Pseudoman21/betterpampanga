/**
 * /charts — the portal's figures as charts: the 2027 lines by program, office,
 * town, status, kind of work and size; a map; and the enacted budgets,
 * 2020–2026. Every figure is the API's, summed the way the rest of the portal
 * sums it: per version, never across versions or across years.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BridgeGroup, DatasetInfo, DistrictCard, DistrictOffice, Envelope } from '../api/types';
import { BRIDGE_GROUPS, GAA_YEARS } from '../api/types';
import { shortNameOf, type DatasetKey } from '../config';
import { Await, Disclaimers } from '../components/Bits';
import { PageHead } from '../components/Chrome';
import { ChartCard, Columns, HBars, Lines, type HRow } from '../components/charts/Kit';
import { COLOR, TRIO, VERSIONS, countFmt, type Series } from '../components/charts/tokens';
import ProjectMap, { type TownTotal } from '../components/charts/ProjectMap';
import Repeats from '../components/charts/Repeats';
import Units from '../components/charts/Units';
import { count, php, phpDelta, phpFull, plural } from '../lib/format';
import { departmentShort, gaaYearTotals, hasYear, loadGaa, type GaaResult } from '../lib/gaa';
import { usePortal, type Async } from '../lib/portal-context';
import { summarise, type ScopedProject, type ScopeResult } from '../lib/scope';
import { NONE, SEVERAL, TOWNS, townOf } from '../lib/towns';
import { useTitle } from '../lib/use-title';

const FIRST = GAA_YEARS[0];
const LAST = GAA_YEARS[GAA_YEARS.length - 1];

export default function Charts() {
  const { scope, overview, config } = usePortal();
  useTitle(`Charts · ${shortNameOf(config)}`);
  const datasets = overview.status === 'ready' ? overview.value.data.datasets : [];
  return (
    <main className="page main">
      <Await state={scope} what="projects">
        {(s) => <Charts2027 scope={s} datasets={datasets} />}
      </Await>
      <Enacted />
      {scope.status === 'ready' && <Disclaimers items={scope.value.disclaimers} compact />}
    </main>
  );
}

const shortOffice = (o: string) => o.replace(/ District Engineering Office$/, ' DEO');
const projectsLink = (params: Record<string, string>) => `/?${new URLSearchParams(params)}#projects`;
const versions = (rows: ScopedProject[]) => {
  const s = summarise(rows);
  return [s.nep.rows ? s.nep.php : null, s.house.rows ? s.house.php : null];
};
const versionTable = (head: string, rows: HRow[], extra?: (r: HRow) => string) => ({
  head: [head, 'NEP', 'House bill', ...(extra ? ['Lines'] : [])],
  rows: rows.map((r) => [r.label, phpFull(r.values[0]), phpFull(r.values[1]), ...(extra ? [extra(r)] : [])]),
});

/** The kind of work, as the budget documents classify the line (program, then P/A/P). */
function workType(p: ScopedProject): string {
  if (p.dataset === 'fmr') return 'Farm-to-market roads';
  if (p.dataset === 'hfep') return 'Health facilities';
  if (p.dataset === 'nia') return 'Irrigation';
  const pap = p.pap ?? '';
  if (/^BIP - Access Roads/i.test(pap)) return 'Access roads and bridges to public facilities';
  if (/^BIP - Multi-Purpose/i.test(pap)) return 'Multi-purpose buildings';
  if (/flood|drainage/i.test(pap)) return 'Flood control and drainage';
  if (/road|bridge|by-pass|flyover/i.test(pap)) return 'National roads and bridges';
  return 'Other works';
}

const BINS: { label: string; lo: number; hi: number }[] = [
  { label: 'Under ₱10M', lo: 0, hi: 10e6 },
  { label: '₱10–25M', lo: 10e6, hi: 25e6 },
  { label: '₱25–50M', lo: 25e6, hi: 50e6 },
  { label: '₱50–100M', lo: 50e6, hi: 100e6 },
  { label: '₱100–250M', lo: 100e6, hi: 250e6 },
  { label: '₱250M and up', lo: 250e6, hi: Infinity },
];

function Charts2027({ scope, datasets }: { scope: ScopeResult; datasets: DatasetInfo[] }) {
  const { config } = usePortal();
  const name = shortNameOf(config);
  const all = scope.projects;
  const summary = useMemo(() => summarise(all), [all]);
  const programName = (k: DatasetKey) => datasets.find((d) => d.key === k)?.short ?? k.toUpperCase();
  const groupLabels = useMemo(() => {
    const fromApi = datasets[0]?.bridge.groups;
    return Object.fromEntries(BRIDGE_GROUPS.map((g) => [g, fromApi?.[g]?.label ?? all.find((r) => r.bridge_group === g)?.group_label ?? g])) as Record<BridgeGroup, string>;
  }, [datasets, all]);

  const groupBy = <K extends string>(key: (p: ScopedProject) => K) => {
    const m = new Map<K, ScopedProject[]>();
    for (const p of all) {
      const k = key(p);
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return m;
  };
  const byHouse = (a: HRow, b: HRow) => (b.values[1] ?? 0) - (a.values[1] ?? 0) || (b.values[0] ?? 0) - (a.values[0] ?? 0);

  const programRows = useMemo<HRow[]>(
    () => [...groupBy((p) => p.dataset)].map(([k, rows]) => ({ key: k, label: programName(k), sub: plural(rows.length, 'line'), values: versions(rows), to: projectsLink({ program: k }) })).sort(byHouse),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, datasets],
  );

  const officeRows = useMemo<HRow[]>(
    () =>
      [...groupBy((p) => p.office ?? '')]
        .map(([o, rows]) => ({
          key: o || 'none',
          label: o ? (o === 'Central Office' ? 'DPWH Central Office' : shortOffice(o)) : 'Not under a DPWH office',
          sub: o ? plural(rows.length, 'line') : `${plural(rows.length, 'line')} · farm roads, health, irrigation`,
          values: versions(rows),
          to: o ? projectsLink({ office: o }) : undefined,
          muted: !o,
        }))
        .sort((a, b) => Number(!!a.muted) - Number(!!b.muted) || byHouse(a, b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all],
  );

  const townRows = useMemo<HRow[]>(() => {
    const m = groupBy(townOf);
    const named = TOWNS.map((t) => ({ t, rows: m.get(t.name) ?? [] }));
    return [
      ...named
        .filter((x) => x.rows.length)
        .map(({ t, rows }) => ({ key: t.name, label: t.name, sub: plural(rows.length, 'line'), values: versions(rows), to: projectsLink({ q: t.name.replace(/ City$|^City of /, '') }) }))
        .sort(byHouse),
      ...[SEVERAL, NONE].filter((b) => m.get(b)?.length).map((b) => ({ key: b, label: b, sub: plural(m.get(b)!.length, 'line'), values: versions(m.get(b)!), muted: true })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);
  const silentTowns = TOWNS.filter((t) => !townRows.some((r) => r.key === t.name)).map((t) => t.name);

  const mapTowns = useMemo<TownTotal[]>(() => {
    const m = groupBy(townOf);
    return TOWNS.map((town) => {
      const rows = m.get(town.name) ?? [];
      const s = summarise(rows);
      return { town, nep: s.nep.php, house: s.house.php, lines: rows.length };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);
  const pins = useMemo(() => all.filter((p) => p.lat != null && p.lon != null), [all]);

  const statusRows: HRow[] = BRIDGE_GROUPS.filter((g) => summary.groups[g].rows).map((g) => {
    const rows = all.filter((p) => p.bridge_group === g);
    return {
      key: g,
      label: <><span className={`status-dot g-${g}`} aria-hidden="true" /> {groupLabels[g]}</>,
      sub: plural(rows.length, 'line'),
      values: versions(rows),
      to: projectsLink({ status: g }),
    };
  });

  const workRows = useMemo<HRow[]>(
    () => [...groupBy(workType)].map(([k, rows]) => ({ key: k, label: k, sub: plural(rows.length, 'line'), values: versions(rows), muted: k === 'Other works' })).sort((a, b) => Number(!!a.muted) - Number(!!b.muted) || byHouse(a, b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all],
  );

  const bins = BINS.map((b) => [
    all.filter((p) => p.nep_php != null && p.nep_php >= b.lo && p.nep_php < b.hi).length,
    all.filter((p) => p.house_php != null && p.house_php >= b.lo && p.house_php < b.hi).length,
  ]);

  const projectRow = (p: ScopedProject, extra?: string): HRow => ({
    key: p.key,
    label: p.title.length > 90 ? p.title.slice(0, 88) + '…' : p.title,
    sub: [p.office ? shortOffice(p.office) : programName(p.dataset), extra].filter(Boolean).join(' · '),
    values: [p.nep_php, p.house_php],
    to: `/projects/${p.dataset}/${encodeURIComponent(p.id)}`,
  });
  const top = (rows: ScopedProject[], by: (p: ScopedProject) => number, n = 10) => [...rows].sort((a, b) => by(b) - by(a)).slice(0, n);
  const largest = top(all, (p) => Math.max(p.house_php ?? 0, p.nep_php ?? 0), 12).map((p) => projectRow(p, groupLabels[p.bridge_group]));
  const houseOnly = top(all.filter((p) => p.bridge_group === 'house_only'), (p) => p.house_php ?? 0).map((p) => ({ ...projectRow(p), values: [p.house_php] }));
  const nepOnly = top(all.filter((p) => p.bridge_group === 'nep_only'), (p) => p.nep_php ?? 0).map((p) => ({ ...projectRow(p), values: [p.nep_php] }));
  const changed = all
    .filter((p) => p.nep_php != null && p.house_php != null && p.house_php !== p.nep_php)
    .sort((a, b) => Math.abs(b.delta_php ?? 0) - Math.abs(a.delta_php ?? 0))
    .slice(0, 10)
    .map((p) => projectRow(p, phpDelta((p.house_php ?? 0) - (p.nep_php ?? 0))));

  const projectTable = (rows: HRow[], head = ['NEP', 'House bill']) => ({ head: ['Project', ...head], rows: rows.map((r) => [r.label, ...head.map((_, i) => php(r.values[i]))]) });

  return (
    <>
      <PageHead
        eyebrow={<>FY 2027<span className="sep">·</span>Charts<span className="sep">·</span>{name}</>}
        title={`${name}’s 2027 budget lines, in charts`}
      >
        <p>
          The same {plural(summary.rows, 'line')} as the project list, drawn by program, office, town, status and kind of work. Bars are the NEP
          (orange) and the House bill (blue): two versions of one budget, compared, never added. Click a bar to open those projects.
        </p>
      </PageHead>

      <div className="vs">
        <ChartCard title="The two versions, side by side" info="The total of every line in this portal in the National Expenditure Program (NEP), the budget the President submits, and in House Bill 10858, the version the House passed. They are two versions of one budget, so they are compared, never added." sub={`Every line in this portal · NEP ${plural(summary.nep.rows, 'line')}, House bill ${plural(summary.house.rows, 'line')}`}>
          <HBars
            series={[{ key: 'v', label: 'Amount', color: COLOR.house }]}
            rows={[
              { key: 'nep', label: 'NEP', sub: 'what the President proposed', values: [summary.nep.php], color: COLOR.nep, extra: <span className="ctip-note">{plural(summary.nep.rows, 'line')}</span> },
              { key: 'house', label: 'House bill', sub: 'House Bill 10858', values: [summary.house.php], color: COLOR.house, extra: <span className="ctip-note">{plural(summary.house.rows, 'line')}</span> },
            ]}
          />
          <p className="vs-delta">
            The House bill’s lines total <strong>{phpDelta(summary.house.php - summary.nep.php)}</strong> against the NEP’s, a{' '}
            {summary.nep.php ? `${Math.round(((summary.house.php - summary.nep.php) / summary.nep.php) * 100)}%` : '—'} difference.
          </p>
        </ChartCard>
      </div>

      <section className="section" aria-labelledby="where-h">
        <h2 id="where-h" className="section-h">Where it goes</h2>
        <div className="cgrid">
          <ChartCard title="By program" info="The four project lists the Budget API covers: DPWH infrastructure, farm-to-market roads (Department of Agriculture), health facilities (DOH) and irrigation (NIA). Click a program to see its projects." sub="DPWH, farm-to-market roads, health facilities, irrigation" table={versionTable('Program', programRows)}>
            <HBars rows={programRows} series={VERSIONS} />
          </ChartCard>
          <ChartCard
            title="By DPWH office" info="The DPWH office each line is listed under in the budget documents. A district engineering office (DEO) builds in the districts it serves; Central Office lines are run from the national office but are here because their titles name the province. Farm roads, health and irrigation lines have no DPWH office."
            sub="The office the documents list each line under"
            note="A shared office (one that serves several districts) is shown whole, never split. Central Office lines are here because their titles name the province."
            table={versionTable('Office', officeRows)}
          >
            <HBars rows={officeRows} series={VERSIONS} />
          </ChartCard>
          <ChartCard
            wide
            title="By town named in the title" info="Each line is placed in the city or municipality its title names. The API does not yet say where a project is, so a title that names no town, or several, is shown apart and never split between towns. Click a town to search the project list for it."
            sub="Lines whose title names exactly one city or municipality"
            note={
              <>
                Placed by the name in the title, not surveyed: a title that names several towns, or none, is kept apart and never split.
                {silentTowns.length > 0 && <> No line names {silentTowns.join(', ')} alone.</>}
              </>
            }
            table={versionTable('Town', townRows)}
          >
            <HBars rows={townRows} series={VERSIONS} />
          </ChartCard>
          <ChartCard
            wide
            title="On the map" info="Each circle is a town: its size is the House bill total of the lines that name only that town, drawn at the town centre (approximate). The small dots are lines whose title gives exact coordinates, coloured by the version they are in. Click a circle or dot to open its projects."
            sub={`Bubbles: the House bill amount of the lines that name each town alone · Pins: the ${count(pins.length)} lines whose title gives coordinates`}
            note="Town bubbles sit at the town proper. Click a bubble for that town’s projects, a pin for its project."
          >
            <p className="clegend">
              <span><i style={{ background: COLOR.house, opacity: 0.35, borderRadius: '50%' }} />Town, House bill amount</span>
              <span><i className="dot" style={{ background: COLOR.house }} />Pin: House bill only</span>
              <span><i className="dot" style={{ background: COLOR.nep }} />Pin: NEP only</span>
              <span><i className="dot" style={{ background: COLOR.gaa }} />Pin: in both</span>
            </p>
            <ProjectMap towns={mapTowns} pins={pins} />
          </ChartCard>
        </div>
      </section>

      <section className="section" aria-labelledby="changed-h">
        <h2 id="changed-h" className="section-h">What the House bill did</h2>
        <div className="cgrid">
          <ChartCard
            wide
            title="Every line, one square each" info="One square for each line in this portal, grouped by how the NEP and the House bill compare: in the House bill only, in the NEP only, the same amount in both, higher, lower, and so on. Hover a square for its amounts; click it to open the project."
            sub="Grouped by what the House bill did to it · hover for the amounts, click to open"
            note="“In the House bill only” and “In the NEP only” are candidates to check, not confirmed insertions or deletions."
          >
            <Units rows={all} labels={groupLabels} />
          </ChartCard>
          <ChartCard title="Amounts by status" info="For each status, the total of its lines in the NEP and in the House bill. “In the House bill only” lines have no NEP amount, and “In the NEP only” lines have no House bill amount, by definition." sub="Each status’s lines, in each version" table={versionTable('Status', statusRows.map((r) => ({ ...r, label: groupLabels[r.key as BridgeGroup] })))}>
            <HBars rows={statusRows} series={VERSIONS} />
          </ChartCard>
          <ChartCard title="Amounts changed" info="Lines found in both versions with a different amount, largest change first. The signed figure after the office is the House bill amount minus the NEP amount." sub="Lines in both versions whose amount moved, largest change first" table={projectTable(changed)}>
            {changed.length ? <HBars rows={changed} series={VERSIONS} /> : <p className="state">No line changed amount.</p>}
          </ChartCard>
          <ChartCard title="Largest lines in the House bill only" info="The biggest lines in the House bill that could not be matched to a line in the NEP. They are candidates to check, not confirmed insertions: a line can also be renamed or reworded between versions." sub="Insertion candidates, by amount" table={projectTable(houseOnly, ['House bill'])}>
            {houseOnly.length ? <HBars rows={houseOnly} series={[VERSIONS[1]]} /> : <p className="state">None.</p>}
          </ChartCard>
          <ChartCard title="Largest lines in the NEP only" info="The biggest NEP lines that could not be matched to a line in the House bill. They are candidates to check, not confirmed removals: a line can also be renamed or reworded between versions." sub="Lines the House bill does not list, by NEP amount" table={projectTable(nepOnly, ['NEP'])}>
            {nepOnly.length ? <HBars rows={nepOnly} series={[VERSIONS[0]]} /> : <p className="state">None.</p>}
          </ChartCard>
        </div>
      </section>

      <section className="section" aria-labelledby="repeats-h">
        <h2 id="repeats-h" className="section-h">Amounts that repeat</h2>
        <Repeats rows={all} />
      </section>

      <section className="section" aria-labelledby="kind-h">
        <h2 id="kind-h" className="section-h">What kind of work</h2>
        <div className="cgrid">
          <ChartCard title="By kind of work" info="Lines grouped by the program, activity or project (P/A/P) the budget documents file them under, such as flood control or access roads. It is the documents’ own classification, not a reading of each title." sub="As the budget documents classify each line" note="A DPWH line’s kind is its program, activity or project (P/A/P) in the documents, not a reading of its title." table={versionTable('Kind of work', workRows)}>
            <HBars rows={workRows} series={VERSIONS} />
          </ChartCard>
          <ChartCard
            title="How big the lines are" info="How many lines fall in each size band, counted separately for the NEP and the House bill. It shows whether the money is spread over many small projects or a few large ones."
            sub="Number of lines in each size band, per version"
            table={{ head: ['Size', 'NEP lines', 'House bill lines'], rows: BINS.map((b, i) => [b.label, count(bins[i][0]), count(bins[i][1])]) }}
          >
            <Columns cats={BINS.map((b) => b.label)} series={VERSIONS} values={bins} format={countFmt} />
          </ChartCard>
          <ChartCard wide title="The largest lines" info="The twelve biggest lines in this portal, by the larger of their two amounts, with their status. Click one to open its project page and the page of the budget document it is on." sub="By the larger of the two amounts · status after the office" table={projectTable(largest)}>
            <HBars rows={largest} series={VERSIONS} />
          </ChartCard>
        </div>
        <p className="fine">
          Amounts are in pesos as published in the 2027 NEP and House Bill 10858, not spending. <Link to="/#projects">See every project as a list</Link>.
        </p>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Enacted budgets, 2020–2026
// ---------------------------------------------------------------------------

function Enacted() {
  const { client, config, districts } = usePortal();
  const places = config.scope.places ?? [];
  const [state, setState] = useState<Async<GaaResult>>({ status: 'loading' });
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  useEffect(() => {
    if (!places.length) return;
    let live = true;
    loadGaa(client, config, (done, total) => live && setProgress({ done, total })).then(
      (value) => live && setState({ status: 'ready', value }),
      (error) => live && setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      live = false;
    };
  }, [client, config, places.length]);
  const placeList = places.map((p) => p.label).join(', ');

  return (
    <section className="section" aria-labelledby="gaa-h">
      <h2 id="gaa-h" className="section-h">The enacted budgets, {FIRST}–{LAST}</h2>
      <p className="section-lede">
        What each year’s General Appropriations Act gave: the authority to spend, not the money spent. Years are shown side by side, never added,
        and the 2027 bill is kept apart. <Link to="/gaa">Every program, year by year</Link>.
      </p>
      <div className="cgrid">
        <Await state={districts} what="DPWH office budgets">
          {(list) => <OfficeYears list={list} />}
        </Await>
        {places.length > 0 &&
          (state.status === 'ready' ? (
            <GaaCharts result={state.value} placeList={placeList} />
          ) : state.status === 'error' ? (
            <p className="state state-error">Could not load the enacted budgets: {state.error.message}</p>
          ) : (
            <div className="state ccard" role="status">
              <span className="spinner" aria-hidden="true" /> Searching every department’s programs for {placeList}
              {progress && progress.total > 0 && <> · {count(progress.done)} of {count(progress.total)}</>}…
            </div>
          ))}
      </div>
    </section>
  );
}

function OfficeYears({ list }: { list: Envelope<DistrictCard>[] }) {
  const offices = useMemo(() => {
    const byId = new Map<string, DistrictOffice>();
    for (const env of list) for (const o of env.data.offices) if (!byId.has(o.id)) byId.set(o.id, o);
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true })).slice(0, TRIO.length);
  }, [list]);
  if (!offices.length) return null;
  const series: Series[] = offices.map((o, i) => ({ key: o.id, label: o.name, color: TRIO[i] }));
  const gaa = (o: DistrictOffice, fy: number) => o.years?.find((y) => y.fy === fy && y.stage === 'gaa')?.php ?? null;
  const values = offices.map((o) => GAA_YEARS.map((fy) => gaa(o, fy)));
  const y2027 = (o: DistrictOffice, stage: string) => o.years?.find((y) => y.fy === 2027 && y.stage === stage)?.php ?? null;
  return (
    <ChartCard
      wide
      title="Each DPWH office’s whole budget, by year" info="Each district engineering office’s total in each year’s General Appropriations Act (GAA), the budget as signed into law: the authority to spend, not the money spent. The 2027 figures are not law yet, so they are listed under the chart, not drawn."
      sub="Enacted (GAA), the office’s whole budget as the GAA lists it under that office"
      note={
        <>
          2027, not law and not drawn: {offices.map((o) => `${o.name} NEP ${php(y2027(o, 'nep'))}`).join(' · ')}. A shared office is shown whole, never split.
        </>
      }
      table={{ head: ['Office', ...GAA_YEARS.map(String)], rows: offices.map((o, i) => [o.name, ...values[i].map((v) => php(v))]) }}
    >
      <Lines xs={GAA_YEARS.map(String)} series={series} values={values} />
    </ChartCard>
  );
}

function GaaCharts({ result, placeList }: { result: GaaResult; placeList: string }) {
  const rows = result.rows;
  const totals = useMemo(() => gaaYearTotals(rows), [rows]);
  // The two departments with the most money across the years by name; the rest as "Other".
  const depts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) for (const y of GAA_YEARS) if (hasYear(r, y)) m.set(r.department_id, (m.get(r.department_id) ?? 0) + r.years[String(y)].amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }, [rows]);
  const lead = depts.slice(0, 2);
  const deptName = (id: string) => departmentShort(rows.find((r) => r.department_id === id)?.department ?? id);
  const series: Series[] = [
    ...lead.map((id, i) => ({ key: id, label: deptName(id), color: TRIO[i] })),
    ...(depts.length > 2 ? [{ key: 'other', label: `${depts.length - 2} other departments`, color: COLOR.other }] : []),
  ];
  const stack = GAA_YEARS.map((y) => {
    const by = new Map<string, number>();
    for (const r of rows) if (hasYear(r, y)) {
      const k = lead.includes(r.department_id) ? r.department_id : 'other';
      by.set(k, (by.get(k) ?? 0) + r.years[String(y)].amount);
    }
    return series.map((s) => by.get(s.key) ?? null);
  });
  const [year, setYear] = useState<string | null>(null);
  const topOfYear = year
    ? [...rows].filter((r) => hasYear(r, year)).sort((a, b) => b.years[year].amount - a.years[year].amount).slice(0, 10)
    : [];

  return (
    <>
      <ChartCard
        wide
        title={`Programs and projects that name ${placeList}, by year`}
        sub="By department · click a year for its ten largest" info="Every program, activity or project in any department whose name includes the place, with its appropriation in each year’s GAA, stacked by department. A year counts only programs funded above zero. Names are matched, not places surveyed. Click a year for its ten largest."
        note="Names are matched, not places surveyed. Each year counts only programs with an appropriation above zero."
        table={{ head: ['Year', ...series.map((s) => s.label), 'Programs'], rows: GAA_YEARS.map((y, i) => [String(y), ...stack[i].map((v) => php(v)), count(totals[i].programs)]) }}
      >
        <Columns
          cats={GAA_YEARS.map(String)}
          series={series}
          values={stack}
          stacked
          height={280}
          picked={year}
          onPick={(c) => setYear((y) => (y === c ? null : c))}
          catSub={(i) => <span className="ctip-note">{plural(totals[i].programs, 'program')} funded</span>}
        />
        {year && (
          <div className="drill">
            <h4>{year}: the ten largest</h4>
            <HBars
              series={[{ key: 'gaa', label: `GAA ${year}`, color: COLOR.gaa }]}
              rows={topOfYear.map((r) => ({ key: r.key, label: r.name, sub: departmentShort(r.department), values: [r.years[year].amount] }))}
            />
          </div>
        )}
      </ChartCard>
      <ChartCard
        title="How many were funded each year" info="How many of the programs and projects that name the place had an appropriation above zero in each year’s GAA."
        sub={`Programs and projects naming ${placeList} with an appropriation`}
        table={{ head: ['Year', 'Programs'], rows: totals.map((t) => [String(t.year), count(t.programs)]) }}
      >
        <Columns cats={GAA_YEARS.map(String)} series={[{ key: 'n', label: 'Programs funded', color: COLOR.gaa }]} values={totals.map((t) => [t.programs])} format={countFmt} />
      </ChartCard>
      <ChartCard
        title="Average size of a funded program" info="Each year’s total for the programs that name the place, divided by how many were funded that year. A rise can mean fewer but larger projects."
        sub="That year’s total divided by the programs funded"
        table={{ head: ['Year', 'Average'], rows: totals.map((t) => [String(t.year), php(t.programs ? t.amount / t.programs : null)]) }}
      >
        <Columns cats={GAA_YEARS.map(String)} series={[{ key: 'a', label: 'Average', color: COLOR.gaa }]} values={totals.map((t) => [t.programs ? t.amount / t.programs : null])} />
      </ChartCard>
    </>
  );
}
