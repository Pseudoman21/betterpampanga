/**
 * Every project as one square, grouped by what the House bill did to it.
 * A square opens its project. Colours are the status colours used across the
 * portal (the same dots as the status chips), each group named beside it.
 */
import { Link } from 'react-router-dom';
import type { BridgeGroup } from '../../api/types';
import { BRIDGE_GROUPS } from '../../api/types';
import { count, php } from '../../lib/format';
import type { ScopedProject } from '../../lib/scope';
import { TipRow } from './Kit';
import { COLOR, useTip } from './tokens';

export default function Units({ rows, labels }: { rows: ScopedProject[]; labels: Record<BridgeGroup, string> }) {
  const { box: tipBox, show: tipShow, hide: tipHide, node: tipNode } = useTip();
  const groups = BRIDGE_GROUPS.map((g) => ({
    g,
    rows: rows.filter((r) => r.bridge_group === g).sort((a, b) => (b.house_php ?? b.nep_php ?? 0) - (a.house_php ?? a.nep_php ?? 0)),
  })).filter((x) => x.rows.length);
  return (
    <div className="chart units" ref={tipBox} onMouseLeave={tipHide}>
      {groups.map(({ g, rows: list }) => (
        <div className="unit-group" key={g}>
          <p className="unit-head">
            <span className={`status-dot g-${g}`} aria-hidden="true" />
            <span>{labels[g]}</span>
            <b className="num">{count(list.length)}</b>
          </p>
          <div className="unit-grid">
            {list.map((p) => {
              const body = (
                <>
                  <strong className="ctip-title">{p.title}</strong>
                  <TipRow color={COLOR.nep} label="NEP" value={php(p.nep_php)} />
                  <TipRow color={COLOR.house} label="House bill" value={php(p.house_php)} />
                </>
              );
              return (
                <Link
                  key={p.key}
                  to={`/projects/${p.dataset}/${encodeURIComponent(p.id)}`}
                  className={`unit g-${g}`}
                  aria-label={`${p.title}: NEP ${php(p.nep_php)}, House bill ${php(p.house_php)}`}
                  onMouseMove={(e) => tipShow(e, body)}
                  onFocus={(e) => tipShow(e, body)}
                  onBlur={tipHide}
                />
              );
            })}
          </div>
        </div>
      ))}
      {tipNode}
    </div>
  );
}
