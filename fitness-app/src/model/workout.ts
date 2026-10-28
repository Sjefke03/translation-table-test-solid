// Logged data. Everything here is plain JSON so it can be persisted as-is;
// values are always canonical (kg, m, s, grade rank).

import { findActivity, layoutFor, type ActivityDef, type ActivityLayout, type MetricId, type MetricValue, type UnitSystem } from '../ontology';

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

export const SET_TYPES: Record<SetType, { label: string; badge: string }> = {
  normal: { label: 'Normal', badge: '' },
  warmup: { label: 'Warm-up', badge: 'W' },
  drop: { label: 'Drop set', badge: 'D' },
  failure: { label: 'Failure', badge: 'F' },
};

export type Values = Partial<Record<MetricId, MetricValue>>;

export interface Segment {
  id: string;
  type: SetType;
  values: Values;
  done: boolean;
}

export interface ActivityEntry {
  id: string;
  activityId: string;
  segments: Segment[];
  sessionValues: Values;
  /** Optional columns the user has switched on. */
  visibleMetrics: MetricId[];
  notes: string;
  restSeconds: number;
}

export interface Workout {
  id: string;
  name: string;
  startedAt: number;
  endedAt?: number;
  entries: ActivityEntry[];
  notes: string;
}

export interface Settings {
  unitSystem: UnitSystem;
  bodyMassKg: number;
  boulderScale: string;
  routeScale: string;
}

export const DEFAULT_SETTINGS: Settings = {
  unitSystem: 'metric',
  bodyMassKg: 75,
  boulderScale: 'v',
  routeScale: 'french',
};

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function newSegment(type: SetType = 'normal'): Segment {
  return { id: newId(), type, values: {}, done: false };
}

/** A fresh entry, shaped like the last time this activity was logged when there was one. */
export function newEntry(activity: ActivityDef, previous?: ActivityEntry): ActivityEntry {
  const layout = layoutFor(activity);
  const segments = previous
    ? previous.segments.map((s) => newSegment(s.type))
    : Array.from({ length: layout.profile.initialSegments }, () => newSegment());
  return {
    id: newId(),
    activityId: activity.id,
    segments,
    sessionValues: {},
    visibleMetrics: previous?.visibleMetrics.filter((m) => layout.optional.includes(m)) ?? layout.defaultVisible,
    notes: '',
    restSeconds: layout.profile.restSeconds,
  };
}

export function newWorkout(now = Date.now()): Workout {
  const hour = new Date(now).getHours();
  const part = hour < 5 ? 'Night' : hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : hour < 21 ? 'Evening' : 'Night';
  return { id: newId(), name: `${part} Workout`, startedAt: now, entries: [], notes: '' };
}

/** Columns shown for an entry, in display order. */
export function visibleColumns(layout: ActivityLayout, entry: ActivityEntry): MetricId[] {
  return [...layout.core, ...layout.optional.filter((m) => entry.visibleMetrics.includes(m))];
}

const filled = (v: MetricValue | undefined) => v !== undefined && v !== '';

export function isSegmentComplete(layout: ActivityLayout, values: Values): boolean {
  const present = layout.core.filter((m) => filled(values[m]));
  return layout.profile.completion === 'all' ? present.length === layout.core.length : present.length > 0;
}

/** The most recent finished entry of this activity. */
export function previousEntry(history: Workout[], activityId: string): ActivityEntry | undefined {
  const sorted = [...history].sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt));
  for (const w of sorted) {
    const e = w.entries.find((x) => x.activityId === activityId);
    if (e) return e;
  }
  return undefined;
}

/** Keep only completed segments; drop entries left empty. */
export function finalizeWorkout(w: Workout, now = Date.now()): Workout {
  return {
    ...w,
    endedAt: now,
    entries: w.entries
      .map((e) => ({ ...e, segments: e.segments.filter((s) => s.done) }))
      .filter((e) => e.segments.length > 0),
  };
}

export function countDone(w: Workout): number {
  return w.entries.reduce((n, e) => n + e.segments.filter((s) => s.done).length, 0);
}

const SECONDS_PER_UNTIMED_SET = 120; // work plus typical rest

/** Seconds of activity in an entry: logged time, or an estimate for untimed sets. */
export function entryActiveSeconds(entry: ActivityEntry): number {
  const done = entry.segments.filter((s) => s.done);
  const timed = done.reduce((t, s) => t + (typeof s.values.duration === 'number' ? s.values.duration : 0), 0);
  const session = typeof entry.sessionValues.duration === 'number' ? entry.sessionValues.duration : 0;
  if (timed || session) return Math.max(timed, session);
  return done.length * SECONDS_PER_UNTIMED_SET;
}

/** Calories = MET × body mass (kg) × hours. An estimate, and labelled as one in the UI. */
export function estimateCalories(w: Workout, bodyMassKg: number, custom: ActivityDef[] = []): number {
  let kcal = 0;
  for (const e of w.entries) {
    const a = findActivity(e.activityId, custom);
    if (!a) continue;
    const reported = e.segments.filter((s) => s.done).reduce((t, s) => t + (typeof s.values.calories === 'number' ? s.values.calories : 0), 0);
    kcal += reported || a.met * bodyMassKg * (entryActiveSeconds(e) / 3600);
  }
  return Math.round(kcal);
}
