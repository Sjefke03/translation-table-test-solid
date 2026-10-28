// Ontology entry point: lookups, how an activity resolves into an input layout,
// and an integrity check that every activity (built-in or custom) is coherent.

import { ACTIVITIES, type ActivityDef } from './activities';
import { GRADE_SCALES } from './grades';
import { METRICS, type MetricId } from './metrics';
import { PROFILES, SEGMENT_KINDS, type TrackingProfile } from './profiles';
import { CATEGORIES, EQUIPMENT, MUSCLES } from './taxonomy';

export * from './activities';
export * from './grades';
export * from './metrics';
export * from './profiles';
export * from './taxonomy';
export * from './units';

const BUILT_IN = new Map(ACTIVITIES.map((a) => [a.id, a]));

export function findActivity(id: string, custom: ActivityDef[] = []): ActivityDef | undefined {
  return BUILT_IN.get(id) ?? custom.find((a) => a.id === id);
}

export function allActivities(custom: ActivityDef[] = []): ActivityDef[] {
  return [...ACTIVITIES, ...custom];
}

export function categoryOf(a: ActivityDef) {
  return CATEGORIES.find((c) => c.id === a.category)!;
}

/** Everything the input screen needs to know about an activity. */
export interface ActivityLayout {
  profile: TrackingProfile;
  segmentLabel: { singular: string; plural: string };
  /** Columns that are always shown and must be filled (see profile.completion). */
  core: MetricId[];
  /** Columns that can be switched on. */
  optional: MetricId[];
  /** Optional columns switched on for a fresh entry. */
  defaultVisible: MetricId[];
  /** Recorded once per entry. */
  session: MetricId[];
}

const unique = <T,>(xs: T[]) => [...new Set(xs)];

export function layoutFor(a: ActivityDef): ActivityLayout {
  const profile = PROFILES[a.profile];
  const optional = unique([...profile.optionalMetrics, ...(a.extraMetrics ?? [])]).filter(
    (m) => !profile.segmentMetrics.includes(m),
  );
  return {
    profile,
    segmentLabel: a.segmentLabel ?? SEGMENT_KINDS[profile.segment],
    core: profile.segmentMetrics,
    optional,
    defaultVisible: (a.defaultMetrics ?? []).filter((m) => optional.includes(m)),
    session: unique([...profile.sessionMetrics, ...(a.extraSessionMetrics ?? [])]),
  };
}

/** Returns a list of problems; empty when the activity list is coherent. */
export function validateActivities(activities: ActivityDef[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const a of activities) {
    const where = `${a.id} (${a.name})`;
    if (seen.has(a.id)) errors.push(`${where}: duplicate id`);
    seen.add(a.id);
    const profile = PROFILES[a.profile];
    if (!profile) {
      errors.push(`${where}: unknown profile ${a.profile}`);
      continue;
    }
    if (!CATEGORIES.some((c) => c.id === a.category)) errors.push(`${where}: unknown category ${a.category}`);
    if (!(a.equipment in EQUIPMENT)) errors.push(`${where}: unknown equipment ${a.equipment}`);
    for (const m of [...a.primaryMuscles, ...a.secondaryMuscles]) {
      if (!(m in MUSCLES)) errors.push(`${where}: unknown muscle ${m}`);
    }
    if (!(a.met > 0 && a.met <= 25)) errors.push(`${where}: MET ${a.met} out of range`);
    if (a.environments.length === 0) errors.push(`${where}: no environment`);
    for (const m of [...(a.extraMetrics ?? []), ...(a.extraSessionMetrics ?? []), ...(a.defaultMetrics ?? [])]) {
      if (!METRICS[m]) errors.push(`${where}: unknown metric ${m}`);
    }
    const layout = layoutFor(a);
    for (const m of a.defaultMetrics ?? []) {
      if (!layout.optional.includes(m)) errors.push(`${where}: default metric ${m} is not an optional metric of ${a.profile}`);
    }
    const usesGrade = [...layout.core, ...layout.optional, ...layout.session].includes('grade');
    if (usesGrade && !a.gradeType) errors.push(`${where}: records a grade but has no gradeType`);
    if (!usesGrade && a.gradeType) errors.push(`${where}: has a gradeType but records no grade`);
  }
  return errors;
}

/** Integrity of the shared vocabulary itself (profiles, metrics, scales). */
export function validateVocabulary(): string[] {
  const errors: string[] = [];
  for (const p of Object.values(PROFILES)) {
    if (p.segmentMetrics.length === 0) errors.push(`profile ${p.id}: no segment metrics`);
    for (const m of [...p.segmentMetrics, ...p.optionalMetrics, ...p.sessionMetrics]) {
      if (!METRICS[m]) errors.push(`profile ${p.id}: unknown metric ${m}`);
    }
    if (p.setTypes && p.segment !== 'set') errors.push(`profile ${p.id}: set types on a non-set profile`);
  }
  for (const m of Object.values(METRICS)) {
    if (m.kind === 'quantity' && !m.dimension) errors.push(`metric ${m.id}: quantity without dimension`);
    if (m.kind === 'choice' && !m.options?.length) errors.push(`metric ${m.id}: choice without options`);
  }
  const lengths = new Map<string, number>();
  for (const s of Object.values(GRADE_SCALES)) {
    const n = lengths.get(s.type);
    if (n !== undefined && n !== s.grades.length) errors.push(`grade scales of type ${s.type} are not aligned`);
    lengths.set(s.type, s.grades.length);
  }
  return errors;
}
