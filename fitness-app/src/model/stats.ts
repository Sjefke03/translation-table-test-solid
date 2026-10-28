// Derived stats. Each stat declares the metrics it needs; an entry gets every
// stat its columns can support, whatever activity it is. The same definitions
// drive the per-entry summary line and personal records.

import {
  formatDurationLong,
  formatPace,
  formatQuantity,
  gradeLabel,
  KM_MI,
  layoutFor,
  type ActivityDef,
  type MetricId,
} from '../ontology';
import type { ActivityEntry, Segment, Settings, Workout } from './workout';

export type StatFormat = 'mass' | 'distance' | 'shortDistance' | 'elevation' | 'duration' | 'count' | 'pace' | 'grade' | 'signed' | 'ratio';

export interface Stat {
  id: string;
  label: string;
  value: number;
  /** for 'ratio': the denominator */
  of?: number;
  format: StatFormat;
  /** Whether this stat can be a personal record, and in which direction. */
  record?: 'higher' | 'lower';
}

interface StatDef {
  id: string;
  label: string;
  requires: MetricId[][]; // any of these metric sets must be available
  format: StatFormat;
  record?: 'higher' | 'lower';
  onlyFor?: (a: ActivityDef) => boolean;
  compute: (segs: Segment[], entry: ActivityEntry) => { value: number; of?: number } | undefined;
}

const num = (s: Segment, m: MetricId): number | undefined => {
  const v = s.values[m];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
};

const sum = (segs: Segment[], m: MetricId) => {
  const xs = segs.map((s) => num(s, m)).filter((x): x is number => x !== undefined);
  return xs.length ? { value: xs.reduce((a, b) => a + b, 0) } : undefined;
};

const max = (segs: Segment[], m: MetricId) => {
  const xs = segs.map((s) => num(s, m)).filter((x): x is number => x !== undefined);
  return xs.length ? { value: Math.max(...xs) } : undefined;
};

const isSetBased = (a: ActivityDef) => layoutFor(a).profile.segment === 'set';
const hasPace = (a: ActivityDef) => !!layoutFor(a).profile.paceBasis;
const isSent = (s: Segment) => typeof s.values.ascentStyle === 'string' && s.values.ascentStyle !== 'project';

/** Epley estimate of a one-rep max. */
export function estimateOneRepMax(weight: number, reps: number): number {
  return reps <= 1 ? weight : weight * (1 + reps / 30);
}

const STATS: StatDef[] = [
  {
    id: 'volume',
    label: 'Volume',
    requires: [['weight', 'reps']],
    format: 'mass',
    record: 'higher',
    compute: (segs) => {
      const pairs = segs.filter((s) => num(s, 'weight') !== undefined && num(s, 'reps') !== undefined);
      return pairs.length ? { value: pairs.reduce((t, s) => t + num(s, 'weight')! * num(s, 'reps')!, 0) } : undefined;
    },
  },
  { id: 'maxWeight', label: 'Heaviest', requires: [['weight']], format: 'mass', record: 'higher', onlyFor: isSetBased, compute: (s) => max(s, 'weight') },
  {
    id: 'e1rm',
    label: 'Est. 1RM',
    requires: [['weight', 'reps']],
    format: 'mass',
    record: 'higher',
    compute: (segs) => {
      const xs = segs
        .filter((s) => num(s, 'weight') !== undefined && (num(s, 'reps') ?? 0) > 0)
        .map((s) => estimateOneRepMax(num(s, 'weight')!, num(s, 'reps')!));
      return xs.length ? { value: Math.max(...xs) } : undefined;
    },
  },
  { id: 'maxAddedWeight', label: 'Heaviest added', requires: [['addedWeight']], format: 'mass', record: 'higher', compute: (s) => max(s, 'addedWeight') },
  { id: 'totalReps', label: 'Reps', requires: [['reps']], format: 'count', compute: (s) => sum(s, 'reps') },
  { id: 'maxReps', label: 'Most reps', requires: [['reps']], format: 'count', record: 'higher', onlyFor: isSetBased, compute: (s) => max(s, 'reps') },
  { id: 'totalDistance', label: 'Distance', requires: [['distance']], format: 'distance', record: 'higher', compute: (s) => sum(s, 'distance') },
  { id: 'totalDistanceShort', label: 'Distance', requires: [['distanceShort']], format: 'shortDistance', record: 'higher', compute: (s) => sum(s, 'distanceShort') },
  {
    id: 'totalTime',
    label: 'Time',
    requires: [['duration']],
    format: 'duration',
    compute: (segs, entry) => {
      const fromSegments = sum(segs, 'duration');
      const session = entry.sessionValues.duration;
      return fromSegments ?? (typeof session === 'number' ? { value: session } : undefined);
    },
  },
  { id: 'longestTime', label: 'Longest', requires: [['duration']], format: 'duration', record: 'higher', onlyFor: isSetBased, compute: (s) => max(s, 'duration') },
  {
    id: 'pace',
    label: 'Pace',
    requires: [['distance', 'duration'], ['distanceShort', 'duration']],
    format: 'pace',
    record: 'lower',
    onlyFor: hasPace,
    compute: (segs) => {
      let meters = 0;
      let seconds = 0;
      for (const s of segs) {
        const d = num(s, 'distance') ?? num(s, 'distanceShort');
        const t = num(s, 'duration');
        if (d && t) {
          meters += d;
          seconds += t;
        }
      }
      return meters > 0 ? { value: seconds / meters } : undefined;
    },
  },
  { id: 'elevationGain', label: 'Elevation', requires: [['elevationGain']], format: 'elevation', record: 'higher', compute: (s) => sum(s, 'elevationGain') },
  { id: 'verticalDrop', label: 'Vertical', requires: [['verticalDrop']], format: 'elevation', record: 'higher', compute: (s) => sum(s, 'verticalDrop') },
  {
    id: 'sends',
    label: 'Sends',
    requires: [['ascentStyle']],
    format: 'ratio',
    compute: (segs) => (segs.length ? { value: segs.filter(isSent).length, of: segs.length } : undefined),
  },
  {
    id: 'maxGradeSent',
    label: 'Hardest send',
    requires: [['grade', 'ascentStyle']],
    format: 'grade',
    record: 'higher',
    compute: (segs) => max(segs.filter(isSent), 'grade'),
  },
  {
    id: 'gamesWon',
    label: 'Won',
    requires: [['pointsFor', 'pointsAgainst']],
    format: 'ratio',
    compute: (segs) => {
      const scored = segs.filter((s) => num(s, 'pointsFor') !== undefined && num(s, 'pointsAgainst') !== undefined);
      return scored.length ? { value: scored.filter((s) => num(s, 'pointsFor')! > num(s, 'pointsAgainst')!).length, of: scored.length } : undefined;
    },
  },
  { id: 'bestScore', label: 'Best score', requires: [['score']], format: 'count', record: 'higher', compute: (s) => max(s, 'score') },
  {
    id: 'strokesToPar',
    label: 'To par',
    requires: [['strokes', 'par']],
    format: 'signed',
    record: 'lower',
    compute: (segs) => {
      const rounds = segs.filter((s) => num(s, 'strokes') !== undefined && num(s, 'par') !== undefined);
      return rounds.length ? { value: rounds.reduce((t, s) => t + num(s, 'strokes')! - num(s, 'par')!, 0) } : undefined;
    },
  },
  { id: 'waves', label: 'Waves', requires: [['waves']], format: 'count', record: 'higher', compute: (s) => sum(s, 'waves') },
];

/** Total lifted volume across a workout. */
export function workoutVolume(w: Workout, lookup: (id: string) => ActivityDef | undefined): number {
  return w.entries.reduce((t, e) => {
    const a = lookup(e.activityId);
    return t + (a ? entryStats(e, a).find((s) => s.id === 'volume')?.value ?? 0 : 0);
  }, 0);
}

/** Segments that count: completed and not warm-ups. */
export function workingSegments(entry: ActivityEntry): Segment[] {
  return entry.segments.filter((s) => s.done && s.type !== 'warmup');
}

export function entryStats(entry: ActivityEntry, activity: ActivityDef): Stat[] {
  const layout = layoutFor(activity);
  const available = new Set<MetricId>([...layout.core, ...layout.optional, ...layout.session]);
  const segs = workingSegments(entry);
  const out: Stat[] = [];
  for (const def of STATS) {
    if (!def.requires.some((set) => set.every((m) => available.has(m)))) continue;
    if (def.onlyFor && !def.onlyFor(activity)) continue;
    const r = def.compute(segs, entry);
    if (!r || !Number.isFinite(r.value)) continue;
    out.push({ id: def.id, label: def.label, value: r.value, of: r.of, format: def.format, record: def.record });
  }
  return out;
}

export function formatStat(stat: Stat, activity: ActivityDef, settings: Settings): string {
  const sys = settings.unitSystem;
  switch (stat.format) {
    case 'mass':
    case 'distance':
    case 'shortDistance':
    case 'elevation':
      return formatQuantity(stat.value, stat.format, sys);
    case 'duration':
      return formatDurationLong(stat.value);
    case 'count':
      return stat.value.toLocaleString();
    case 'pace':
      return formatPace(stat.value, layoutFor(activity).profile.paceBasis ?? KM_MI, sys);
    case 'grade':
      return gradeLabel(stat.value, activity.gradeType === 'boulder' ? settings.boulderScale : settings.routeScale);
    case 'signed':
      return stat.value === 0 ? 'E' : stat.value > 0 ? `+${stat.value}` : String(stat.value);
    case 'ratio':
      return `${stat.value}/${stat.of}`;
  }
}

export interface PersonalRecord {
  stat: Stat;
  workoutId: string;
  date: number;
}

const better = (a: number, b: number, dir: 'higher' | 'lower') => (dir === 'higher' ? a > b : a < b);

/** Best value of every record-able stat across the history of one activity. */
export function personalRecords(activity: ActivityDef, history: Workout[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();
  const sorted = [...history].filter((w) => w.endedAt).sort((a, b) => a.endedAt! - b.endedAt!);
  for (const w of sorted) {
    for (const e of w.entries) {
      if (e.activityId !== activity.id) continue;
      for (const stat of entryStats(e, activity)) {
        if (!stat.record) continue;
        const cur = best.get(stat.id);
        if (!cur || better(stat.value, cur.stat.value, stat.record)) best.set(stat.id, { stat, workoutId: w.id, date: w.endedAt! });
      }
    }
  }
  return [...best.values()];
}

/** Stats in this workout that beat every earlier workout (first-ever values don't count). */
export function recordsSetIn(workout: Workout, history: Workout[], activities: (id: string) => ActivityDef | undefined): Map<string, Stat[]> {
  const earlier = history.filter((w) => w.id !== workout.id && w.endedAt && w.endedAt < (workout.endedAt ?? Infinity));
  const out = new Map<string, Stat[]>();
  for (const e of workout.entries) {
    const a = activities(e.activityId);
    if (!a) continue;
    const prior = new Map(personalRecords(a, earlier).map((r) => [r.stat.id, r.stat.value]));
    const prs = entryStats(e, a).filter((s) => s.record && prior.has(s.id) && better(s.value, prior.get(s.id)!, s.record));
    if (prs.length) out.set(e.id, prs);
  }
  return out;
}
