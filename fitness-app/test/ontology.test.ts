import { describe, expect, it } from 'vitest';
import {
  ACTIVITIES,
  CATEGORIES,
  findActivity,
  formatPace,
  fromDisplay,
  GRADE_SCALES,
  gradeLabel,
  KM_MI,
  layoutFor,
  maskDurationDigits,
  parseDurationDigits,
  durationToDigits,
  PROFILES,
  toDisplay,
  validateActivities,
  validateVocabulary,
  type ActivityDef,
} from '../src/ontology';

describe('ontology integrity', () => {
  it('vocabulary is consistent', () => {
    expect(validateVocabulary()).toEqual([]);
  });

  it('every built-in activity is consistent', () => {
    expect(validateActivities(ACTIVITIES)).toEqual([]);
  });

  it('every category and profile is used', () => {
    for (const c of CATEGORIES) expect(ACTIVITIES.some((a) => a.category === c.id), c.id).toBe(true);
    for (const p of Object.keys(PROFILES)) expect(ACTIVITIES.some((a) => a.profile === p), p).toBe(true);
  });

  it('catches incoherent custom activities', () => {
    const bad: ActivityDef = {
      id: 'x',
      name: 'Bad',
      category: 'climbing',
      profile: 'climb',
      equipment: 'none',
      environments: ['indoor'],
      met: 5,
      primaryMuscles: [],
      secondaryMuscles: [],
      defaultMetrics: ['reps'],
    };
    const errors = validateActivities([bad, bad]);
    expect(errors.some((e) => e.includes('duplicate id'))).toBe(true);
    expect(errors.some((e) => e.includes('no gradeType'))).toBe(true);
    expect(errors.some((e) => e.includes('default metric reps'))).toBe(true);
  });
});

describe('layouts', () => {
  it('strength: weight and reps per set, with RPE optional', () => {
    const l = layoutFor(findActivity('bench_press_barbell')!);
    expect(l.core).toEqual(['weight', 'reps']);
    expect(l.optional).toContain('rpe');
    expect(l.segmentLabel.singular).toBe('Set');
    expect(l.profile.setTypes).toBe(true);
  });

  it('activities refine their profile', () => {
    const tennis = layoutFor(findActivity('tennis')!);
    expect(tennis.segmentLabel.singular).toBe('Set');
    expect(tennis.session).toEqual(['duration', 'outcome', 'rpe']);

    const pool = layoutFor(findActivity('pool_swim')!);
    expect(pool.session).toEqual(['poolLength']);

    const surf = layoutFor(findActivity('surfing')!);
    expect(surf.optional).toContain('waves');
    expect(surf.defaultVisible).toEqual(['waves']);

    const treadmill = layoutFor(findActivity('treadmill')!);
    expect(treadmill.defaultVisible).toEqual(['distance', 'incline']);
  });
});

describe('units', () => {
  it('round-trips between unit systems', () => {
    expect(toDisplay(fromDisplay(225, 'mass', 'imperial'), 'mass', 'imperial')).toBe(225);
    expect(toDisplay(100, 'mass', 'imperial')).toBe(220.5);
    expect(toDisplay(5000, 'distance', 'metric')).toBe(5);
    expect(toDisplay(1609.344, 'distance', 'imperial')).toBe(1);
  });

  it('enters time like a timer keypad', () => {
    expect(parseDurationDigits('130')).toBe(90);
    expect(parseDurationDigits('45')).toBe(45);
    expect(parseDurationDigits('13000')).toBe(5400);
    expect(parseDurationDigits('')).toBeUndefined();
    expect(maskDurationDigits('130')).toBe('1:30');
    expect(maskDurationDigits('5')).toBe('0:05');
    expect(maskDurationDigits('13000')).toBe('1:30:00');
    expect(durationToDigits(5400)).toBe('13000');
    expect(parseDurationDigits(durationToDigits(3725))).toBe(3725);
  });

  it('formats pace per unit system', () => {
    // 5 km in 25:00 → 5:00 /km, 8:03 /mi
    expect(formatPace(1500 / 5000, KM_MI, 'metric')).toBe('5:00 /km');
    expect(formatPace(1500 / 5000, KM_MI, 'imperial')).toBe('8:03 /mi');
  });
});

describe('grades', () => {
  it('aligned scales share ranks', () => {
    const v4 = GRADE_SCALES.v.grades.indexOf('V4');
    expect(gradeLabel(v4, 'font')).toBe('6B');
    const r = GRADE_SCALES.yds.grades.indexOf('5.11a');
    expect(gradeLabel(r, 'french')).toBe('6c+');
  });
});
