/**
 * The cities and municipalities of Pampanga, for the Charts page's "by town"
 * view and map.
 *
 * The API does not yet say which town a project is in (see docs/api.md#gaps),
 * so a line is placed by the town its title names, the same way the place
 * search finds it. A title that names no town, or several, is kept apart and
 * never split between towns. Centres are approximate (the town proper), for
 * placing a bubble on the map, not for surveying.
 */
import type { ProjectRow } from '../api/types';

export interface Town {
  name: string;
  kind: 'city' | 'municipality';
  /** Tested against the lower-cased title. */
  pattern: RegExp;
  lat: number;
  lon: number;
}

export const TOWNS: Town[] = [
  { name: 'Angeles City', kind: 'city', pattern: /\bangeles\b/, lat: 15.145, lon: 120.5887 },
  { name: 'Apalit', kind: 'municipality', pattern: /\bapalit\b/, lat: 14.9497, lon: 120.7583 },
  { name: 'Arayat', kind: 'municipality', pattern: /\barayat\b/, lat: 15.1503, lon: 120.7697 },
  { name: 'Bacolor', kind: 'municipality', pattern: /\bbacolor\b/, lat: 15.0003, lon: 120.6517 },
  { name: 'Candaba', kind: 'municipality', pattern: /\bcandaba\b/, lat: 15.0933, lon: 120.8283 },
  { name: 'Floridablanca', kind: 'municipality', pattern: /\bflorida ?blanca\b/, lat: 14.9744, lon: 120.5281 },
  { name: 'Guagua', kind: 'municipality', pattern: /\bguagua\b/, lat: 14.9653, lon: 120.6339 },
  { name: 'Lubao', kind: 'municipality', pattern: /\blubao\b/, lat: 14.9386, lon: 120.6011 },
  { name: 'Mabalacat City', kind: 'city', pattern: /\bmabalacat\b/, lat: 15.2231, lon: 120.5742 },
  { name: 'Macabebe', kind: 'municipality', pattern: /\bmacabebe\b/, lat: 14.9081, lon: 120.7158 },
  { name: 'Magalang', kind: 'municipality', pattern: /\bmagalang\b/, lat: 15.2147, lon: 120.6611 },
  { name: 'Masantol', kind: 'municipality', pattern: /\bmasantol\b/, lat: 14.8967, lon: 120.7092 },
  { name: 'Mexico', kind: 'municipality', pattern: /\bmexico\b/, lat: 15.0647, lon: 120.7197 },
  { name: 'Minalin', kind: 'municipality', pattern: /\bminalin\b/, lat: 14.9681, lon: 120.6814 },
  { name: 'Porac', kind: 'municipality', pattern: /\bporac\b/, lat: 15.0719, lon: 120.5419 },
  { name: 'City of San Fernando', kind: 'city', pattern: /\bsan fernando\b|\bcsfp\b/, lat: 15.0286, lon: 120.6936 },
  { name: 'San Luis', kind: 'municipality', pattern: /\bsan luis\b/, lat: 15.0397, lon: 120.7917 },
  { name: 'San Simon', kind: 'municipality', pattern: /\bsan simon\b/, lat: 14.9981, lon: 120.78 },
  { name: 'Santa Ana', kind: 'municipality', pattern: /\b(santa|sta\.?) ?ana\b/, lat: 15.0939, lon: 120.7678 },
  { name: 'Santa Rita', kind: 'municipality', pattern: /\b(santa|sta\.?) ?rita\b/, lat: 14.995, lon: 120.6153 },
  { name: 'Santo Tomas', kind: 'municipality', pattern: /\b(santo|sto\.?) ?tomas\b/, lat: 15.0003, lon: 120.7044 },
  { name: 'Sasmuan', kind: 'municipality', pattern: /\bsasmuan\b|\bsexmoan\b/, lat: 14.9386, lon: 120.6203 },
];

export const SEVERAL = 'Several towns named';
export const NONE = 'No town named';

/** Every town the title names. */
export function townsNamed(row: Pick<ProjectRow, 'title'>): Town[] {
  const t = row.title.toLowerCase();
  return TOWNS.filter((town) => town.pattern.test(t));
}

/** The one town the title names, or SEVERAL / NONE. */
export function townOf(row: Pick<ProjectRow, 'title'>): string {
  const named = townsNamed(row);
  return named.length === 1 ? named[0].name : named.length ? SEVERAL : NONE;
}
