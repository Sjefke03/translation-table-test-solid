import {
  CATEGORIES,
  formatDuration,
  formatQuantity,
  gradeLabel,
  METRICS,
  unitFor,
  type ActivityDef,
  type MetricId,
  type MetricValue,
} from '../ontology';
import type { Settings, Values } from '../model/workout';

export function gradeScaleFor(activity: ActivityDef, settings: Settings): string {
  return activity.gradeType === 'boulder' ? settings.boulderScale : settings.routeScale;
}

export function categoryIcon(activity: ActivityDef): string {
  return CATEGORIES.find((c) => c.id === activity.category)?.icon ?? '•';
}

/** Column header including the unit, e.g. "KG", "DIST (MI)". */
export function columnHeader(metric: MetricId, settings: Settings): string {
  const m = METRICS[metric];
  if (m.kind === 'quantity' && m.dimension) {
    const u = unitFor(m.dimension, settings.unitSystem);
    if (metric === 'weight') return u.symbol;
    if (u.symbol && m.dimension !== 'rating') return `${m.short} (${u.symbol})`;
  }
  return m.short;
}

export function formatValue(metric: MetricId, value: MetricValue | undefined, activity: ActivityDef, settings: Settings): string {
  if (value === undefined || value === '') return '';
  const m = METRICS[metric];
  switch (m.kind) {
    case 'quantity':
      return typeof value === 'number' ? formatQuantity(value, m.dimension!, settings.unitSystem, !['count', 'rating', 'level'].includes(m.dimension!)) : '';
    case 'duration':
      return typeof value === 'number' ? formatDuration(value) : '';
    case 'choice':
      return m.options?.find((o) => o.value === value)?.label ?? String(value);
    case 'grade':
      return typeof value === 'number' ? gradeLabel(value, gradeScaleFor(activity, settings)) : '';
  }
}

/** One-line summary of a segment: "60 kg × 8", "5.00 km · 25:00", "V4 · Flash". */
export function formatSegment(columns: MetricId[], values: Values, activity: ActivityDef, settings: Settings): string {
  const parts = columns.map((c) => [c, formatValue(c, values[c], activity, settings)] as const).filter(([, t]) => t);
  if (parts.length >= 2 && METRICS[parts[0][0]].dimension === 'mass' && parts[1][0] === 'reps') {
    const [first, second, ...rest] = parts;
    return [`${first[1]} × ${second[1]}`, ...rest.map(([, t]) => t)].join(' · ');
  }
  return parts.map(([, t]) => t).join(' · ');
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
