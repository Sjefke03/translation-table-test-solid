import { describe, expect, it } from 'vitest';
import { findActivity } from '../src/ontology';
import { entryStats, estimateOneRepMax, personalRecords, recordsSetIn } from '../src/model/stats';
import { estimateCalories, finalizeWorkout, isSegmentComplete, newEntry, type ActivityEntry, type Workout } from '../src/model/workout';
import { layoutFor } from '../src/ontology';
import { INITIAL_STATE, reducer, type State } from '../src/store/store';

const act = (id: string) => findActivity(id)!;

function entry(activityId: string, rows: Record<string, number | string>[], extra: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    ...newEntry(act(activityId)),
    segments: rows.map((values, i) => ({ id: `s${i}`, type: 'normal', values, done: true })),
    ...extra,
  };
}

function workout(id: string, endedAt: number, entries: ActivityEntry[]): Workout {
  return { id, name: id, startedAt: endedAt - 3600_000, endedAt, entries, notes: '' };
}

describe('stats', () => {
  it('strength: volume, heaviest, e1RM; warm-ups excluded', () => {
    const e = entry('squat_barbell', [
      { weight: 60, reps: 5 },
      { weight: 100, reps: 5 },
      { weight: 100, reps: 3 },
    ]);
    e.segments[0].type = 'warmup';
    const s = Object.fromEntries(entryStats(e, act('squat_barbell')).map((x) => [x.id, x.value]));
    expect(s.volume).toBe(800);
    expect(s.maxWeight).toBe(100);
    expect(s.e1rm).toBeCloseTo(estimateOneRepMax(100, 5));
    expect(s.totalReps).toBe(8);
  });

  it('running: distance, time and pace', () => {
    const e = entry('running', [{ distance: 5000, duration: 1500 }]);
    const s = Object.fromEntries(entryStats(e, act('running')).map((x) => [x.id, x.value]));
    expect(s.totalDistance).toBe(5000);
    expect(s.totalTime).toBe(1500);
    expect(s.pace).toBeCloseTo(0.3);
  });

  it('climbing: sends and hardest send ignore attempts', () => {
    const e = entry('bouldering', [
      { grade: 5, ascentStyle: 'flash' },
      { grade: 7, ascentStyle: 'project' },
      { grade: 6, ascentStyle: 'redpoint' },
    ]);
    const s = entryStats(e, act('bouldering'));
    expect(s.find((x) => x.id === 'sends')).toMatchObject({ value: 2, of: 3 });
    expect(s.find((x) => x.id === 'maxGradeSent')?.value).toBe(6);
  });

  it('match: games won and session time', () => {
    const e = entry('tennis', [
      { pointsFor: 6, pointsAgainst: 4 },
      { pointsFor: 3, pointsAgainst: 6 },
      { pointsFor: 7, pointsAgainst: 5 },
    ], { sessionValues: { duration: 5400, outcome: 'win' } });
    const s = entryStats(e, act('tennis'));
    expect(s.find((x) => x.id === 'gamesWon')).toMatchObject({ value: 2, of: 3 });
    expect(s.find((x) => x.id === 'totalTime')?.value).toBe(5400);
  });

  it('stats follow metrics, not activities: optional fields unlock stats', () => {
    const e = entry('surfing', [{ duration: 3600, waves: 12 }]);
    expect(entryStats(e, act('surfing')).find((x) => x.id === 'waves')?.value).toBe(12);
  });
});

describe('completion rules', () => {
  it("'all' needs every core field, 'any' needs one", () => {
    const strength = layoutFor(act('bench_press_barbell'));
    expect(isSegmentComplete(strength, { weight: 60 })).toBe(false);
    expect(isSegmentComplete(strength, { weight: 60, reps: 8 })).toBe(true);
    const run = layoutFor(act('running'));
    expect(isSegmentComplete(run, { duration: 600 })).toBe(true);
    expect(isSegmentComplete(run, {})).toBe(false);
  });
});

describe('records', () => {
  it('finds bests across history and flags new ones', () => {
    const w1 = workout('w1', 1000, [entry('deadlift_barbell', [{ weight: 140, reps: 5 }])]);
    const w2 = workout('w2', 2000, [entry('deadlift_barbell', [{ weight: 150, reps: 3 }])]);
    const history = [w2, w1];
    const prs = personalRecords(act('deadlift_barbell'), history);
    expect(prs.find((p) => p.stat.id === 'maxWeight')).toMatchObject({ workoutId: 'w2' });
    expect(prs.find((p) => p.stat.id === 'volume')).toMatchObject({ workoutId: 'w1' });
    const set = recordsSetIn(w2, history, (id) => findActivity(id));
    expect(set.get(w2.entries[0].id)?.map((s) => s.id)).toEqual(['maxWeight', 'e1rm']); // 150×3 ≈ 165 beats 140×5 ≈ 163
    expect(recordsSetIn(w1, history, (id) => findActivity(id)).size).toBe(0);
  });
});

describe('calories', () => {
  it('uses logged time, else an estimate per set, else reported calories', () => {
    const run = workout('r', 1, [entry('running', [{ distance: 5000, duration: 1800 }])]);
    expect(estimateCalories(run, 70)).toBe(Math.round(9.8 * 70 * 0.5));
    const machine = workout('m', 1, [entry('elliptical', [{ duration: 1800, calories: 321 }])]);
    expect(estimateCalories(machine, 70)).toBe(321);
  });
});

describe('reducer', () => {
  const run = (state: State, ...actions: Parameters<typeof reducer>[1][]) => actions.reduce(reducer, state);

  it('logs a workout end to end and keeps only completed rows', () => {
    let s = run(INITIAL_STATE, { type: 'start', activityIds: ['bench_press_barbell'] });
    const e = s.active!.entries[0];
    expect(e.segments).toHaveLength(3);
    s = run(
      s,
      { type: 'setValue', entryId: e.id, segmentId: e.segments[0].id, metric: 'weight', value: 60 },
      { type: 'completeSegment', entryId: e.id, segmentId: e.segments[0].id, fill: { reps: 8 } },
      { type: 'finish' },
    );
    expect(s.active).toBeNull();
    expect(s.history).toHaveLength(1);
    expect(s.history[0].entries[0].segments).toHaveLength(1);
    expect(s.history[0].entries[0].segments[0].values).toEqual({ weight: 60, reps: 8 });
  });

  it('a new entry copies the shape of the last one', () => {
    const prev = workout('p', 1, [entry('bench_press_barbell', [{ weight: 40, reps: 10 }, { weight: 60, reps: 8 }], { visibleMetrics: ['rpe'] })]);
    prev.entries[0].segments[0].type = 'warmup';
    const s = run({ ...INITIAL_STATE, history: [prev] }, { type: 'start', activityIds: ['bench_press_barbell'] });
    const e = s.active!.entries[0];
    expect(e.segments.map((x) => x.type)).toEqual(['warmup', 'normal']);
    expect(e.visibleMetrics).toEqual(['rpe']);
  });

  it('finishing with nothing completed saves nothing', () => {
    const s = run(INITIAL_STATE, { type: 'start', activityIds: ['running'] }, { type: 'finish' });
    expect(s.history).toHaveLength(0);
    expect(finalizeWorkout(workout('x', 1, [])).entries).toEqual([]);
  });
});
