// Tracking profiles: the bridge between "what activity is this" and "what does
// the input screen look like". Hevy has a fixed list of exercise types (weight &
// reps, duration, distance & duration, ...). Here that idea is generalised to
// every physical activity: a profile names the unit of work that repeats (a set,
// an interval, a climb, a game ...), which metrics are recorded per unit, which
// are recorded once per session. Summary stats are derived from the metrics
// (see model/stats.ts), so any activity that records the right metrics gets them.

import type { MetricId } from './metrics';
import type { PaceBases } from './units';

export type SegmentKind = 'set' | 'interval' | 'round' | 'climb' | 'run' | 'game' | 'session';

export const SEGMENT_KINDS: Record<SegmentKind, { singular: string; plural: string }> = {
  set: { singular: 'Set', plural: 'Sets' },
  interval: { singular: 'Interval', plural: 'Intervals' },
  round: { singular: 'Round', plural: 'Rounds' },
  climb: { singular: 'Climb', plural: 'Climbs' },
  run: { singular: 'Run', plural: 'Runs' },
  game: { singular: 'Game', plural: 'Games' },
  session: { singular: 'Session', plural: 'Sessions' },
};

export type ProfileId =
  | 'weightReps'
  | 'bodyweightReps'
  | 'weightedBodyweight'
  | 'assistedBodyweight'
  | 'durationHold'
  | 'weightDistance'
  | 'distanceDuration'
  | 'cardioMachine'
  | 'erg'
  | 'swim'
  | 'timedRounds'
  | 'descent'
  | 'climb'
  | 'match'
  | 'scoredGame'
  | 'golfRound'
  | 'session';

export interface TrackingProfile {
  id: ProfileId;
  label: string;
  description: string;
  segment: SegmentKind;
  /** Always-visible columns, in order. */
  segmentMetrics: MetricId[];
  /** Columns the user can switch on per activity entry ("+ RPE"). */
  optionalMetrics: MetricId[];
  /** Recorded once per activity entry rather than per segment. */
  sessionMetrics: MetricId[];
  /** 'all': every column must be filled to complete a segment; 'any': one is enough. */
  completion: 'all' | 'any';
  /** Warm-up / drop / failure set markers (strength only). */
  setTypes: boolean;
  /** Default rest timer in seconds after completing a segment; 0 = none. */
  restSeconds: number;
  /** How many segments a fresh entry starts with. */
  initialSegments: number;
  paceBasis?: PaceBases;
}

export const KM_MI: PaceBases = {
  metric: { meters: 1000, label: '/km' },
  imperial: { meters: 1609.344, label: '/mi' },
};
const PER_100: PaceBases = {
  metric: { meters: 100, label: '/100m' },
  imperial: { meters: 91.44, label: '/100yd' },
};
const PER_500M: PaceBases = {
  metric: { meters: 500, label: '/500m' },
  imperial: { meters: 500, label: '/500m' },
};

const profile = (p: Omit<TrackingProfile, 'optionalMetrics' | 'sessionMetrics' | 'completion' | 'setTypes' | 'restSeconds' | 'initialSegments'> & Partial<TrackingProfile>): TrackingProfile => ({
  optionalMetrics: [],
  sessionMetrics: [],
  completion: 'all',
  setTypes: false,
  restSeconds: 0,
  initialSegments: 1,
  ...p,
});

export const PROFILES: Record<ProfileId, TrackingProfile> = {
  weightReps: profile({
    id: 'weightReps',
    label: 'Weight & reps',
    description: 'Classic lifting: load × repetitions per set.',
    segment: 'set',
    segmentMetrics: ['weight', 'reps'],
    optionalMetrics: ['rpe', 'side'],
    setTypes: true,
    restSeconds: 120,
    initialSegments: 3,
  }),
  bodyweightReps: profile({
    id: 'bodyweightReps',
    label: 'Bodyweight reps',
    description: 'Repetitions with bodyweight only.',
    segment: 'set',
    segmentMetrics: ['reps'],
    optionalMetrics: ['rpe', 'side'],
    setTypes: true,
    restSeconds: 90,
    initialSegments: 3,
  }),
  weightedBodyweight: profile({
    id: 'weightedBodyweight',
    label: 'Weighted bodyweight',
    description: 'Bodyweight movement with extra load (belt, vest).',
    segment: 'set',
    segmentMetrics: ['addedWeight', 'reps'],
    optionalMetrics: ['rpe'],
    setTypes: true,
    restSeconds: 120,
    initialSegments: 3,
  }),
  assistedBodyweight: profile({
    id: 'assistedBodyweight',
    label: 'Assisted bodyweight',
    description: 'Bodyweight movement made easier with a counterweight or band.',
    segment: 'set',
    segmentMetrics: ['assistWeight', 'reps'],
    optionalMetrics: ['rpe'],
    setTypes: true,
    restSeconds: 90,
    initialSegments: 3,
  }),
  durationHold: profile({
    id: 'durationHold',
    label: 'Duration',
    description: 'Timed holds: planks, hangs, stretches.',
    segment: 'set',
    segmentMetrics: ['duration'],
    optionalMetrics: ['addedWeight', 'side', 'rpe'],
    setTypes: true,
    restSeconds: 60,
    initialSegments: 3,
  }),
  weightDistance: profile({
    id: 'weightDistance',
    label: 'Weight & distance',
    description: 'Loaded carries, sled pushes and drags.',
    segment: 'set',
    segmentMetrics: ['weight', 'distanceShort'],
    optionalMetrics: ['duration', 'rpe'],
    setTypes: true,
    restSeconds: 90,
    initialSegments: 3,
  }),
  distanceDuration: profile({
    id: 'distanceDuration',
    label: 'Distance & time',
    description: 'Endurance over a route. Add intervals for laps or repeats; pace is derived.',
    segment: 'interval',
    segmentMetrics: ['distance', 'duration'],
    optionalMetrics: ['elevationGain', 'heartRateAvg', 'cadence', 'power', 'calories', 'rpe'],
    completion: 'any',
    paceBasis: KM_MI,
  }),
  cardioMachine: profile({
    id: 'cardioMachine',
    label: 'Cardio machine',
    description: 'Time on a machine, with whatever the console reports.',
    segment: 'interval',
    segmentMetrics: ['duration'],
    optionalMetrics: ['distance', 'level', 'incline', 'floors', 'power', 'cadence', 'heartRateAvg', 'calories', 'rpe'],
    paceBasis: KM_MI,
  }),
  erg: profile({
    id: 'erg',
    label: 'Erg / rowing',
    description: 'Rowing-style pieces in metres with a /500m split.',
    segment: 'interval',
    segmentMetrics: ['distanceShort', 'duration'],
    optionalMetrics: ['strokeRate', 'power', 'heartRateAvg', 'calories', 'rpe'],
    completion: 'any',
    restSeconds: 120,
    paceBasis: PER_500M,
  }),
  swim: profile({
    id: 'swim',
    label: 'Swim sets',
    description: 'Swim intervals by stroke, with pace per 100.',
    segment: 'interval',
    segmentMetrics: ['stroke', 'distanceShort', 'duration'],
    optionalMetrics: ['heartRateAvg', 'rpe'],
    completion: 'any',
    restSeconds: 30,
    paceBasis: PER_100,
  }),
  timedRounds: profile({
    id: 'timedRounds',
    label: 'Timed rounds',
    description: 'Work rounds: boxing, sparring, HIIT, skipping.',
    segment: 'round',
    segmentMetrics: ['duration'],
    optionalMetrics: ['reps', 'heartRateAvg', 'calories', 'rpe'],
    restSeconds: 60,
    initialSegments: 3,
  }),
  descent: profile({
    id: 'descent',
    label: 'Runs',
    description: 'Downhill runs on snow.',
    segment: 'run',
    segmentMetrics: ['duration', 'verticalDrop'],
    optionalMetrics: ['distance', 'rpe'],
    completion: 'any',
  }),
  climb: profile({
    id: 'climb',
    label: 'Climbs',
    description: 'Each problem or route with its grade and how it went.',
    segment: 'climb',
    segmentMetrics: ['grade', 'ascentStyle'],
    optionalMetrics: ['attempts', 'rpe'],
  }),
  match: profile({
    id: 'match',
    label: 'Match',
    description: 'Scored games or sets against an opponent.',
    segment: 'game',
    segmentMetrics: ['pointsFor', 'pointsAgainst'],
    optionalMetrics: ['duration'],
    sessionMetrics: ['duration', 'outcome', 'rpe'],
  }),
  scoredGame: profile({
    id: 'scoredGame',
    label: 'Scored games',
    description: 'Individual score per game or end (bowling, archery).',
    segment: 'game',
    segmentMetrics: ['score'],
    sessionMetrics: ['duration'],
  }),
  golfRound: profile({
    id: 'golfRound',
    label: 'Golf round',
    description: 'Holes played and strokes taken.',
    segment: 'session',
    segmentMetrics: ['holes', 'strokes'],
    optionalMetrics: ['par', 'duration', 'distance'],
  }),
  session: profile({
    id: 'session',
    label: 'Session',
    description: 'A continuous session measured by time: classes, practice, flows.',
    segment: 'session',
    segmentMetrics: ['duration'],
    optionalMetrics: ['rpe', 'heartRateAvg', 'calories', 'distance'],
  }),
};
