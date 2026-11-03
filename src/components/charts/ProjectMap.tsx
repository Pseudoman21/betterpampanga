/**
 * The map: one bubble per town, sized by what the House bill gives the
 * projects whose title names only that town; and a pin for every project whose
 * title gives coordinates (the API's lat/lon), coloured by the version it is in.
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { php } from '../../lib/format';
import type { ScopedProject } from '../../lib/scope';
import type { Town } from '../../lib/towns';
import { COLOR } from './tokens';

export interface TownTotal { town: Town; nep: number; house: number; lines: number }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function pinColor(p: ScopedProject): string {
  return p.nep_php == null ? COLOR.house : p.house_php == null ? COLOR.nep : COLOR.gaa;
}

export default function ProjectMap({ towns, pins }: { towns: TownTotal[]; pins: ScopedProject[] }) {
  const el = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!el.current) return;
    const map = L.map(el.current, { scrollWheelZoom: false, zoomSnap: 0.25 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      className: 'pmap-tiles',
    }).addTo(map);

    const max = Math.max(1, ...towns.map((t) => t.house));
    for (const t of towns) {
      const r = 5 + 30 * Math.sqrt(t.house / max);
      L.circleMarker([t.town.lat, t.town.lon], { radius: r, color: COLOR.house, weight: 1.5, fillColor: COLOR.house, fillOpacity: 0.18 })
        .bindTooltip(`<strong>${esc(t.town.name)}</strong><br>${t.lines} line${t.lines === 1 ? '' : 's'} name it alone<br>NEP ${php(t.nep)} · House bill ${php(t.house)}`, { direction: 'top' })
        .on('click', () => navigate(`/?q=${encodeURIComponent(t.town.name.replace(/ City$|^City of /, ''))}#projects`))
        .addTo(map);
    }
    for (const p of pins) {
      L.circleMarker([p.lat!, p.lon!], { radius: 5, color: '#ffffff', weight: 2, fillColor: pinColor(p), fillOpacity: 1 })
        .bindTooltip(`<strong>${esc(p.title.slice(0, 140))}${p.title.length > 140 ? '…' : ''}</strong><br>NEP ${php(p.nep_php)} · House bill ${php(p.house_php)}`, { direction: 'top' })
        .on('click', () => navigate(`/projects/${p.dataset}/${encodeURIComponent(p.id)}`))
        .addTo(map);
    }
    map.fitBounds(L.latLngBounds(towns.map((t) => [t.town.lat, t.town.lon] as [number, number])).pad(0.12));
    return () => {
      map.remove();
    };
  }, [towns, pins, navigate]);

  return <div ref={el} className="pmap" role="region" aria-label="Map of projects by town; the same figures are in the town chart and its table" />;
}
