// Physical dimensions and units. Every measured value is stored in a canonical
// SI unit (kg, m, s, ...) and converted only for display and input, so switching
// between metric and imperial never rewrites history.

export type UnitSystem = 'metric' | 'imperial';

export type Dimension =
  | 'mass' // external load: kg / lb
  | 'distance' // route distance: km / mi
  | 'shortDistance' // pool lengths, sprints, carries, ergs: m / yd
  | 'elevation' // climb / descent: m / ft
  | 'duration' // seconds
  | 'count' // reps, rounds, points, strokes
  | 'heartRate' // beats per minute
  | 'power' // watts
  | 'energy' // kcal
  | 'cadence' // rpm / strokes per minute
  | 'percent' // treadmill incline
  | 'level' // machine resistance level
  | 'rating'; // RPE 1–10

export interface Unit {
  id: string;
  symbol: string;
  dimension: Dimension;
  /** canonical value = display value × factor */
  factor: number;
  /** decimals shown when formatting */
  decimals: number;
}

const unit = (id: string, symbol: string, dimension: Dimension, factor: number, decimals: number): Unit => ({
  id,
  symbol,
  dimension,
  factor,
  decimals,
});

export const UNITS: Record<string, Unit> = {
  kg: unit('kg', 'kg', 'mass', 1, 1),
  lb: unit('lb', 'lb', 'mass', 0.45359237, 1),
  km: unit('km', 'km', 'distance', 1000, 2),
  mi: unit('mi', 'mi', 'distance', 1609.344, 2),
  m: unit('m', 'm', 'shortDistance', 1, 0),
  yd: unit('yd', 'yd', 'shortDistance', 0.9144, 0),
  m_elev: unit('m_elev', 'm', 'elevation', 1, 0),
  ft: unit('ft', 'ft', 'elevation', 0.3048, 0),
  s: unit('s', 's', 'duration', 1, 0),
  count: unit('count', '', 'count', 1, 0),
  bpm: unit('bpm', 'bpm', 'heartRate', 1, 0),
  W: unit('W', 'W', 'power', 1, 0),
  kcal: unit('kcal', 'kcal', 'energy', 1, 0),
  rpm: unit('rpm', 'rpm', 'cadence', 1, 0),
  pct: unit('pct', '%', 'percent', 1, 1),
  level: unit('level', 'lvl', 'level', 1, 0),
  rating: unit('rating', '', 'rating', 1, 1),
};

const PREFERRED: Record<Dimension, Record<UnitSystem, string>> = {
  mass: { metric: 'kg', imperial: 'lb' },
  distance: { metric: 'km', imperial: 'mi' },
  shortDistance: { metric: 'm', imperial: 'yd' },
  elevation: { metric: 'm_elev', imperial: 'ft' },
  duration: { metric: 's', imperial: 's' },
  count: { metric: 'count', imperial: 'count' },
  heartRate: { metric: 'bpm', imperial: 'bpm' },
  power: { metric: 'W', imperial: 'W' },
  energy: { metric: 'kcal', imperial: 'kcal' },
  cadence: { metric: 'rpm', imperial: 'rpm' },
  percent: { metric: 'pct', imperial: 'pct' },
  level: { metric: 'level', imperial: 'level' },
  rating: { metric: 'rating', imperial: 'rating' },
};

export function unitFor(dimension: Dimension, system: UnitSystem): Unit {
  return UNITS[PREFERRED[dimension][system]];
}

export function round(value: number, decimals: number): number {
  const p = 10 ** decimals;
  return Math.round(value * p) / p;
}

export function toDisplay(canonical: number, dimension: Dimension, system: UnitSystem): number {
  const u = unitFor(dimension, system);
  return round(canonical / u.factor, u.decimals);
}

export function fromDisplay(display: number, dimension: Dimension, system: UnitSystem): number {
  return display * unitFor(dimension, system).factor;
}

export function formatQuantity(canonical: number, dimension: Dimension, system: UnitSystem, withUnit = true): string {
  const u = unitFor(dimension, system);
  const n = toDisplay(canonical, dimension, system);
  const text = n.toLocaleString(undefined, { maximumFractionDigits: u.decimals });
  return withUnit && u.symbol ? `${text} ${u.symbol}` : text;
}

/** 75 → "1:15", 3725 → "1:02:05" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Human duration for summaries: 3725 → "1h 2m", 95 → "1m 35s" */
export function formatDurationLong(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return sec ? `${m}m ${sec}s` : `${m}m`;
  return `${sec}s`;
}

/**
 * Timer-style entry: digits fill from the right like a microwave keypad.
 * "130" → 90 s (1:30), "13000" → 1:30:00, "45" → 45 s.
 */
export function parseDurationDigits(digits: string): number | undefined {
  const d = digits.replace(/\D/g, '').slice(-6);
  if (!d) return undefined;
  const padded = d.padStart(6, '0');
  const h = Number(padded.slice(0, 2));
  const m = Number(padded.slice(2, 4));
  const s = Number(padded.slice(4, 6));
  return h * 3600 + m * 60 + s;
}

/** Inverse of parseDurationDigits, for pre-filling the input. */
export function durationToDigits(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${h}${pad(m)}${pad(sec)}`.replace(/^0+/, '');
}

/** Mask raw digits as the user types: "130" → "1:30", "13000" → "1:30:00" */
export function maskDurationDigits(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(-6).replace(/^0+/, '');
  if (!d) return '';
  if (d.length <= 2) return `0:${d.padStart(2, '0')}`;
  if (d.length <= 4) return `${d.slice(0, -2)}:${d.slice(-2)}`;
  return `${d.slice(0, -4)}:${d.slice(-4, -2)}:${d.slice(-2)}`;
}

/** How a pace is expressed: seconds per `meters`, shown with `label`. */
export interface PaceBasis {
  meters: number;
  label: string;
}

export type PaceBases = Record<UnitSystem, PaceBasis>;

export function formatPace(secondsPerMeter: number, basis: PaceBases, system: UnitSystem): string {
  const b = basis[system];
  return `${formatDuration(secondsPerMeter * b.meters)} ${b.label}`;
}
