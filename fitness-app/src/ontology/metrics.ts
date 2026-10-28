// Metrics: the atomic things a person can record about a piece of activity.
// A metric knows its value kind (which decides the input widget) and, for
// quantities, its physical dimension (which decides units and conversion).

import type { Dimension } from './units';

export type MetricKind =
  | 'quantity' // number in a dimension, converted between unit systems
  | 'duration' // seconds, entered timer-style
  | 'choice' // one of a fixed set of options
  | 'grade'; // climbing difficulty rank, shown in the preferred grade scale

export type MetricId =
  | 'weight'
  | 'addedWeight'
  | 'assistWeight'
  | 'reps'
  | 'duration'
  | 'distance'
  | 'distanceShort'
  | 'elevationGain'
  | 'verticalDrop'
  | 'incline'
  | 'level'
  | 'floors'
  | 'heartRateAvg'
  | 'power'
  | 'cadence'
  | 'strokeRate'
  | 'calories'
  | 'rpe'
  | 'side'
  | 'stroke'
  | 'poolLength'
  | 'grade'
  | 'ascentStyle'
  | 'attempts'
  | 'pointsFor'
  | 'pointsAgainst'
  | 'outcome'
  | 'score'
  | 'holes'
  | 'strokes'
  | 'par'
  | 'waves';

export interface ChoiceOption {
  value: string;
  label: string;
}

export interface MetricDef {
  id: MetricId;
  label: string;
  /** column header in the logging table */
  short: string;
  kind: MetricKind;
  dimension?: Dimension;
  options?: ChoiceOption[];
  integer?: boolean;
  min?: number;
  max?: number;
  description: string;
}

export type MetricValue = number | string;

const q = (
  id: MetricId,
  label: string,
  short: string,
  dimension: Dimension,
  description: string,
  extra: Partial<MetricDef> = {},
): MetricDef => ({ id, label, short, kind: 'quantity', dimension, description, min: 0, ...extra });

const choice = (id: MetricId, label: string, short: string, options: ChoiceOption[], description: string): MetricDef => ({
  id,
  label,
  short,
  kind: 'choice',
  options,
  description,
});

const opts = (...pairs: [string, string][]): ChoiceOption[] => pairs.map(([value, label]) => ({ value, label }));

export const METRICS: Record<MetricId, MetricDef> = {
  weight: q('weight', 'Weight', 'Weight', 'mass', 'External load moved, e.g. the barbell including plates.'),
  addedWeight: q('addedWeight', 'Added weight', '+Weight', 'mass', 'Load added on top of bodyweight (belt, vest, dumbbell).'),
  assistWeight: q('assistWeight', 'Assistance', '−Weight', 'mass', 'Counterweight or band assistance subtracted from bodyweight.'),
  reps: q('reps', 'Reps', 'Reps', 'count', 'Repetitions completed.', { integer: true }),
  duration: { id: 'duration', label: 'Time', short: 'Time', kind: 'duration', dimension: 'duration', description: 'Elapsed time.' },
  distance: q('distance', 'Distance', 'Dist', 'distance', 'Distance covered over a route.'),
  distanceShort: q('distanceShort', 'Distance', 'Dist', 'shortDistance', 'Short distance: lengths, carries, sprints, erg pieces.'),
  elevationGain: q('elevationGain', 'Elevation gain', 'Elev+', 'elevation', 'Total ascent.'),
  verticalDrop: q('verticalDrop', 'Vertical drop', 'Vert', 'elevation', 'Height descended on a run.'),
  incline: q('incline', 'Incline', 'Incl', 'percent', 'Treadmill grade.', { max: 40 }),
  level: q('level', 'Level', 'Lvl', 'level', 'Machine resistance level.', { integer: true, max: 30 }),
  floors: q('floors', 'Floors', 'Floors', 'count', 'Floors / flights climbed.', { integer: true }),
  heartRateAvg: q('heartRateAvg', 'Avg heart rate', 'HR', 'heartRate', 'Average heart rate.', { integer: true, max: 250 }),
  power: q('power', 'Avg power', 'Watts', 'power', 'Average power output.', { integer: true }),
  cadence: q('cadence', 'Cadence', 'Cad', 'cadence', 'Pedal or step cadence.', { integer: true }),
  strokeRate: q('strokeRate', 'Stroke rate', 'SPM', 'cadence', 'Strokes per minute.', { integer: true }),
  calories: q('calories', 'Calories', 'kcal', 'energy', 'Energy reported by a machine or watch.', { integer: true }),
  rpe: q('rpe', 'RPE', 'RPE', 'rating', 'Rate of perceived exertion, 1 (easy) to 10 (max).', { min: 1, max: 10 }),
  side: choice('side', 'Side', 'Side', opts(['both', 'Both'], ['left', 'Left'], ['right', 'Right']), 'Which side, for unilateral work.'),
  stroke: choice(
    'stroke',
    'Stroke',
    'Stroke',
    opts(['free', 'Freestyle'], ['back', 'Backstroke'], ['breast', 'Breaststroke'], ['fly', 'Butterfly'], ['im', 'IM'], ['kick', 'Kick'], ['drill', 'Drill']),
    'Swim stroke.',
  ),
  poolLength: q('poolLength', 'Pool length', 'Pool', 'shortDistance', 'Length of the pool.'),
  grade: { id: 'grade', label: 'Grade', short: 'Grade', kind: 'grade', description: 'Difficulty of the problem or route.' },
  ascentStyle: choice(
    'ascentStyle',
    'Style',
    'Style',
    opts(['onsight', 'Onsight'], ['flash', 'Flash'], ['redpoint', 'Redpoint'], ['repeat', 'Repeat'], ['project', 'Attempt']),
    'How it was climbed. "Attempt" means not sent.',
  ),
  attempts: q('attempts', 'Attempts', 'Tries', 'count', 'Number of goes.', { integer: true, min: 1 }),
  pointsFor: q('pointsFor', 'Points for', 'Us', 'count', 'Your (team’s) score.', { integer: true }),
  pointsAgainst: q('pointsAgainst', 'Points against', 'Them', 'count', 'Opponent’s score.', { integer: true }),
  outcome: choice('outcome', 'Result', 'Result', opts(['win', 'Win'], ['loss', 'Loss'], ['draw', 'Draw']), 'Overall result.'),
  score: q('score', 'Score', 'Score', 'count', 'Points scored.', { integer: true }),
  holes: q('holes', 'Holes', 'Holes', 'count', 'Holes played.', { integer: true, max: 36 }),
  strokes: q('strokes', 'Strokes', 'Strokes', 'count', 'Total strokes.', { integer: true }),
  par: q('par', 'Par', 'Par', 'count', 'Par for the holes played.', { integer: true }),
  waves: q('waves', 'Waves', 'Waves', 'count', 'Waves ridden.', { integer: true }),
};
