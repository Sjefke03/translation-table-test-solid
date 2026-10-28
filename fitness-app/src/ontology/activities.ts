// The activity catalogue. Each activity picks a tracking profile (what gets
// logged) and is classified by the taxonomy facets (how it is found). An activity
// can refine its profile: switch optional columns on by default, add metrics the
// profile does not have, or rename the segment ("Set" in tennis, "Roll" in BJJ).
//
// MET values follow the Compendium of Physical Activities (rounded) and are only
// used for calorie estimates.

import type { GradeType } from './grades';
import type { MetricId } from './metrics';
import type { ProfileId } from './profiles';
import type { CategoryId, Environment, EquipmentId, MovementPattern, MuscleId } from './taxonomy';

export interface ActivityDef {
  id: string;
  name: string;
  category: CategoryId;
  profile: ProfileId;
  equipment: EquipmentId;
  environments: Environment[];
  met: number;
  primaryMuscles: MuscleId[];
  secondaryMuscles: MuscleId[];
  pattern?: MovementPattern;
  /** Optional columns shown by default. */
  defaultMetrics?: MetricId[];
  /** Metrics beyond the profile's own; they become optional columns. */
  extraMetrics?: MetricId[];
  /** Metrics beyond the profile's own, recorded once per entry. */
  extraSessionMetrics?: MetricId[];
  segmentLabel?: { singular: string; plural: string };
  gradeType?: GradeType;
  aliases?: string[];
  custom?: boolean;
}

type Opts = Partial<Omit<ActivityDef, 'id' | 'name' | 'category' | 'profile'>>;

const base = (id: string, name: string, category: CategoryId, profile: ProfileId, met: number, o: Opts = {}): ActivityDef => ({
  id,
  name,
  category,
  profile,
  met,
  equipment: 'none',
  environments: ['indoor'],
  primaryMuscles: [],
  secondaryMuscles: [],
  ...o,
});

/** Strength exercise helper. */
const lift = (
  id: string,
  name: string,
  profile: ProfileId,
  equipment: EquipmentId,
  pattern: MovementPattern,
  primaryMuscles: MuscleId[],
  secondaryMuscles: MuscleId[] = [],
  o: Opts = {},
): ActivityDef =>
  base(id, name, 'strength', profile, profile === 'durationHold' ? 3.8 : 5, {
    equipment,
    pattern,
    primaryMuscles,
    secondaryMuscles,
    ...o,
  });

const unilateral: Opts = { defaultMetrics: ['side'] };
const outdoor: Environment[] = ['outdoor'];
const both: Environment[] = ['indoor', 'outdoor'];

const label = (singular: string, plural: string) => ({ segmentLabel: { singular, plural } });

export const ACTIVITIES: ActivityDef[] = [
  // ── Strength: chest
  lift('bench_press_barbell', 'Bench Press (Barbell)', 'weightReps', 'barbell', 'horizontalPush', ['chest'], ['triceps', 'shoulders']),
  lift('bench_press_dumbbell', 'Bench Press (Dumbbell)', 'weightReps', 'dumbbell', 'horizontalPush', ['chest'], ['triceps', 'shoulders']),
  lift('incline_bench_barbell', 'Incline Bench Press (Barbell)', 'weightReps', 'barbell', 'horizontalPush', ['chest'], ['shoulders', 'triceps']),
  lift('chest_fly_cable', 'Chest Fly (Cable)', 'weightReps', 'cable', 'isolation', ['chest'], ['shoulders']),
  lift('push_up', 'Push Up', 'bodyweightReps', 'none', 'horizontalPush', ['chest'], ['triceps', 'shoulders', 'abdominals'], { aliases: ['press up'] }),
  lift('chest_dip', 'Chest Dip', 'bodyweightReps', 'none', 'verticalPush', ['chest', 'triceps'], ['shoulders']),
  lift('chest_dip_weighted', 'Chest Dip (Weighted)', 'weightedBodyweight', 'none', 'verticalPush', ['chest', 'triceps'], ['shoulders']),
  // ── Strength: shoulders
  lift('overhead_press_barbell', 'Overhead Press (Barbell)', 'weightReps', 'barbell', 'verticalPush', ['shoulders'], ['triceps', 'upperBack'], { aliases: ['ohp', 'military press'] }),
  lift('shoulder_press_dumbbell', 'Shoulder Press (Dumbbell)', 'weightReps', 'dumbbell', 'verticalPush', ['shoulders'], ['triceps']),
  lift('lateral_raise_dumbbell', 'Lateral Raise (Dumbbell)', 'weightReps', 'dumbbell', 'isolation', ['shoulders']),
  lift('face_pull_cable', 'Face Pull (Cable)', 'weightReps', 'cable', 'horizontalPull', ['shoulders'], ['upperBack', 'traps']),
  lift('shrug_dumbbell', 'Shrug (Dumbbell)', 'weightReps', 'dumbbell', 'isolation', ['traps'], ['forearms']),
  // ── Strength: back
  lift('deadlift_barbell', 'Deadlift (Barbell)', 'weightReps', 'barbell', 'hinge', ['hamstrings', 'glutes', 'lowerBack'], ['quadriceps', 'traps', 'forearms']),
  lift('romanian_deadlift_barbell', 'Romanian Deadlift (Barbell)', 'weightReps', 'barbell', 'hinge', ['hamstrings', 'glutes'], ['lowerBack', 'forearms'], { aliases: ['rdl'] }),
  lift('pull_up', 'Pull Up', 'bodyweightReps', 'pullUpBar', 'verticalPull', ['lats'], ['biceps', 'upperBack', 'forearms']),
  lift('pull_up_weighted', 'Pull Up (Weighted)', 'weightedBodyweight', 'pullUpBar', 'verticalPull', ['lats'], ['biceps', 'upperBack', 'forearms']),
  lift('pull_up_assisted', 'Pull Up (Assisted)', 'assistedBodyweight', 'machine', 'verticalPull', ['lats'], ['biceps', 'upperBack']),
  lift('chin_up', 'Chin Up', 'bodyweightReps', 'pullUpBar', 'verticalPull', ['lats', 'biceps'], ['upperBack', 'forearms']),
  lift('lat_pulldown_cable', 'Lat Pulldown (Cable)', 'weightReps', 'cable', 'verticalPull', ['lats'], ['biceps', 'upperBack']),
  lift('bent_over_row_barbell', 'Bent Over Row (Barbell)', 'weightReps', 'barbell', 'horizontalPull', ['upperBack', 'lats'], ['biceps', 'lowerBack']),
  lift('seated_row_cable', 'Seated Row (Cable)', 'weightReps', 'cable', 'horizontalPull', ['upperBack', 'lats'], ['biceps']),
  lift('row_dumbbell', 'Single Arm Row (Dumbbell)', 'weightReps', 'dumbbell', 'horizontalPull', ['upperBack', 'lats'], ['biceps'], unilateral),
  lift('inverted_row', 'Inverted Row', 'bodyweightReps', 'suspension', 'horizontalPull', ['upperBack'], ['biceps', 'lats']),
  lift('back_extension', 'Back Extension', 'bodyweightReps', 'machine', 'hinge', ['lowerBack'], ['glutes', 'hamstrings']),
  // ── Strength: legs
  lift('squat_barbell', 'Squat (Barbell)', 'weightReps', 'barbell', 'squat', ['quadriceps', 'glutes'], ['hamstrings', 'lowerBack', 'adductors'], { aliases: ['back squat'] }),
  lift('front_squat_barbell', 'Front Squat (Barbell)', 'weightReps', 'barbell', 'squat', ['quadriceps'], ['glutes', 'upperBack']),
  lift('goblet_squat_kettlebell', 'Goblet Squat (Kettlebell)', 'weightReps', 'kettlebell', 'squat', ['quadriceps', 'glutes'], ['abdominals']),
  lift('leg_press_machine', 'Leg Press (Machine)', 'weightReps', 'machine', 'squat', ['quadriceps', 'glutes'], ['hamstrings']),
  lift('lunge_dumbbell', 'Lunge (Dumbbell)', 'weightReps', 'dumbbell', 'lunge', ['quadriceps', 'glutes'], ['hamstrings', 'adductors']),
  lift('bulgarian_split_squat', 'Bulgarian Split Squat (Dumbbell)', 'weightReps', 'dumbbell', 'lunge', ['quadriceps', 'glutes'], ['hamstrings'], unilateral),
  lift('hip_thrust_barbell', 'Hip Thrust (Barbell)', 'weightReps', 'barbell', 'hinge', ['glutes'], ['hamstrings']),
  lift('glute_bridge', 'Glute Bridge', 'bodyweightReps', 'none', 'hinge', ['glutes'], ['hamstrings']),
  lift('leg_extension_machine', 'Leg Extension (Machine)', 'weightReps', 'machine', 'isolation', ['quadriceps']),
  lift('leg_curl_machine', 'Leg Curl (Machine)', 'weightReps', 'machine', 'isolation', ['hamstrings']),
  lift('calf_raise_machine', 'Calf Raise (Machine)', 'weightReps', 'machine', 'isolation', ['calves']),
  lift('hip_abduction_machine', 'Hip Abduction (Machine)', 'weightReps', 'machine', 'isolation', ['abductors']),
  lift('hip_adduction_machine', 'Hip Adduction (Machine)', 'weightReps', 'machine', 'isolation', ['adductors']),
  // ── Strength: arms
  lift('bicep_curl_barbell', 'Bicep Curl (Barbell)', 'weightReps', 'barbell', 'isolation', ['biceps'], ['forearms']),
  lift('bicep_curl_dumbbell', 'Bicep Curl (Dumbbell)', 'weightReps', 'dumbbell', 'isolation', ['biceps'], ['forearms']),
  lift('hammer_curl_dumbbell', 'Hammer Curl (Dumbbell)', 'weightReps', 'dumbbell', 'isolation', ['biceps', 'forearms']),
  lift('triceps_pushdown_cable', 'Triceps Pushdown (Cable)', 'weightReps', 'cable', 'isolation', ['triceps']),
  lift('skullcrusher_barbell', 'Skullcrusher (Barbell)', 'weightReps', 'barbell', 'isolation', ['triceps'], [], { aliases: ['lying triceps extension'] }),
  // ── Strength: core
  lift('plank', 'Plank', 'durationHold', 'none', 'core', ['abdominals'], ['shoulders', 'glutes']),
  lift('side_plank', 'Side Plank', 'durationHold', 'none', 'core', ['abdominals'], ['abductors'], unilateral),
  lift('hanging_leg_raise', 'Hanging Leg Raise', 'bodyweightReps', 'pullUpBar', 'core', ['abdominals'], ['forearms']),
  lift('crunch', 'Crunch', 'bodyweightReps', 'none', 'core', ['abdominals']),
  lift('russian_twist', 'Russian Twist', 'bodyweightReps', 'none', 'core', ['abdominals']),
  lift('ab_wheel', 'Ab Wheel Rollout', 'bodyweightReps', 'other', 'core', ['abdominals'], ['lats', 'shoulders']),
  lift('dead_hang', 'Dead Hang', 'durationHold', 'pullUpBar', 'verticalPull', ['forearms'], ['lats', 'shoulders']),
  lift('wall_sit', 'Wall Sit', 'durationHold', 'none', 'squat', ['quadriceps'], ['glutes']),
  // ── Strength: full body / carries / olympic
  lift('kettlebell_swing', 'Kettlebell Swing', 'weightReps', 'kettlebell', 'hinge', ['glutes', 'hamstrings'], ['lowerBack', 'shoulders']),
  lift('turkish_get_up', 'Turkish Get-Up', 'weightReps', 'kettlebell', 'core', ['shoulders', 'abdominals'], ['glutes'], unilateral),
  lift('farmers_carry', 'Farmer’s Carry', 'weightDistance', 'dumbbell', 'carry', ['forearms', 'traps'], ['abdominals', 'glutes'], { aliases: ['farmers walk'] }),
  lift('sled_push', 'Sled Push', 'weightDistance', 'sled', 'carry', ['quadriceps', 'glutes'], ['calves', 'shoulders']),
  lift('power_clean', 'Power Clean (Barbell)', 'weightReps', 'barbell', 'olympic', ['fullBody'], ['traps', 'glutes', 'quadriceps']),
  lift('clean_and_jerk', 'Clean and Jerk (Barbell)', 'weightReps', 'barbell', 'olympic', ['fullBody'], ['shoulders', 'quadriceps']),
  lift('snatch', 'Snatch (Barbell)', 'weightReps', 'barbell', 'olympic', ['fullBody'], ['shoulders', 'traps']),

  // ── Conditioning
  base('burpee', 'Burpee', 'conditioning', 'bodyweightReps', 8, { pattern: 'plyometric', primaryMuscles: ['fullBody'] }),
  base('box_jump', 'Box Jump', 'conditioning', 'bodyweightReps', 8, { pattern: 'plyometric', primaryMuscles: ['quadriceps', 'glutes'], secondaryMuscles: ['calves'] }),
  base('wall_ball', 'Wall Ball', 'conditioning', 'weightReps', 6, { equipment: 'medicineBall', primaryMuscles: ['quadriceps', 'shoulders'], secondaryMuscles: ['glutes'] }),
  base('thruster', 'Thruster (Barbell)', 'conditioning', 'weightReps', 6, { equipment: 'barbell', primaryMuscles: ['quadriceps', 'shoulders'], secondaryMuscles: ['glutes', 'triceps'] }),
  base('jump_rope', 'Jump Rope', 'conditioning', 'timedRounds', 11.8, { equipment: 'jumpRope', primaryMuscles: ['calves'], defaultMetrics: ['reps'], aliases: ['skipping'] }),
  base('battle_ropes', 'Battle Ropes', 'conditioning', 'timedRounds', 10, { equipment: 'other', primaryMuscles: ['shoulders'], secondaryMuscles: ['abdominals'] }),
  base('hiit', 'HIIT', 'conditioning', 'timedRounds', 8, { primaryMuscles: ['fullBody'], aliases: ['interval training', 'tabata'] }),
  base('circuit_training', 'Circuit Training', 'conditioning', 'timedRounds', 8, { primaryMuscles: ['fullBody'] }),
  base('metcon', 'Metcon / WOD', 'conditioning', 'session', 8, { primaryMuscles: ['fullBody'], defaultMetrics: ['rpe'], aliases: ['crossfit', 'amrap', 'emom'] }),

  // ── Cardio & endurance
  base('running', 'Running', 'cardio', 'distanceDuration', 9.8, { environments: outdoor, primaryMuscles: ['quadriceps', 'calves'], aliases: ['jog'] }),
  base('trail_running', 'Trail Running', 'cardio', 'distanceDuration', 10, { environments: outdoor, defaultMetrics: ['elevationGain'], primaryMuscles: ['quadriceps', 'calves'] }),
  base('treadmill', 'Treadmill', 'cardio', 'cardioMachine', 9, { equipment: 'treadmill', defaultMetrics: ['distance', 'incline'], primaryMuscles: ['quadriceps', 'calves'] }),
  base('track_intervals', 'Track Intervals', 'cardio', 'distanceDuration', 10, { environments: outdoor, segmentLabel: { singular: 'Rep', plural: 'Reps' }, primaryMuscles: ['quadriceps', 'calves'], aliases: ['sprints', 'repeats'] }),
  base('walking', 'Walking', 'cardio', 'distanceDuration', 3.5, { environments: both }),
  base('hiking', 'Hiking', 'cardio', 'distanceDuration', 6, { environments: outdoor, defaultMetrics: ['elevationGain'] }),
  base('rucking', 'Rucking', 'cardio', 'distanceDuration', 7, { environments: outdoor, extraMetrics: ['weight'], defaultMetrics: ['weight'] }),
  base('cycling', 'Cycling', 'cardio', 'distanceDuration', 7.5, { equipment: 'bike', environments: outdoor, defaultMetrics: ['elevationGain'], aliases: ['road bike', 'ride'] }),
  base('mountain_biking', 'Mountain Biking', 'cardio', 'distanceDuration', 8.5, { equipment: 'bike', environments: outdoor, defaultMetrics: ['elevationGain'], aliases: ['mtb'] }),
  base('indoor_cycling', 'Indoor Cycling', 'cardio', 'cardioMachine', 7, { equipment: 'bike', defaultMetrics: ['distance', 'power'], aliases: ['spin', 'stationary bike'] }),
  base('elliptical', 'Elliptical', 'cardio', 'cardioMachine', 5, { equipment: 'machine', defaultMetrics: ['level', 'distance'], aliases: ['cross trainer'] }),
  base('stair_climber', 'Stair Climber', 'cardio', 'cardioMachine', 9, { equipment: 'machine', defaultMetrics: ['floors', 'level'], aliases: ['stairmaster'] }),
  base('rowing_machine', 'Rowing Machine', 'cardio', 'erg', 7, { equipment: 'rower', defaultMetrics: ['strokeRate'], primaryMuscles: ['upperBack', 'quadriceps'], aliases: ['erg', 'concept2'] }),
  base('ski_erg', 'SkiErg', 'cardio', 'erg', 7, { equipment: 'rower', primaryMuscles: ['lats', 'triceps'] }),
  base('inline_skating', 'Inline Skating', 'cardio', 'distanceDuration', 7.5, { environments: outdoor, aliases: ['rollerblading'] }),

  // ── Water
  base('pool_swim', 'Swimming (Pool)', 'water', 'swim', 7, { environments: ['water'], extraSessionMetrics: ['poolLength'], primaryMuscles: ['fullBody'] }),
  base('open_water_swim', 'Open Water Swim', 'water', 'distanceDuration', 7, { environments: ['water'], primaryMuscles: ['fullBody'] }),
  base('rowing_water', 'Rowing (On-water)', 'water', 'erg', 7, { environments: ['water'], defaultMetrics: ['strokeRate'] }),
  base('kayaking', 'Kayaking', 'water', 'distanceDuration', 5, { environments: ['water'], aliases: ['canoe'] }),
  base('sup', 'Stand-Up Paddleboarding', 'water', 'distanceDuration', 6, { environments: ['water'], aliases: ['paddleboard'] }),
  base('surfing', 'Surfing', 'water', 'session', 3, { environments: ['water'], extraMetrics: ['waves'], defaultMetrics: ['waves'] }),
  base('water_polo', 'Water Polo', 'water', 'match', 10, { environments: ['water'], ...label('Quarter', 'Quarters') }),

  // ── Winter
  base('downhill_skiing', 'Downhill Skiing', 'winter', 'descent', 5.3, { environments: ['snow'] }),
  base('snowboarding', 'Snowboarding', 'winter', 'descent', 5.3, { environments: ['snow'] }),
  base('xc_skiing', 'Cross-country Skiing', 'winter', 'distanceDuration', 9, { environments: ['snow'], defaultMetrics: ['elevationGain'], aliases: ['nordic'] }),
  base('ski_touring', 'Ski Touring', 'winter', 'distanceDuration', 8, { environments: ['snow'], defaultMetrics: ['elevationGain'], aliases: ['skimo', 'backcountry'] }),
  base('snowshoeing', 'Snowshoeing', 'winter', 'distanceDuration', 5.3, { environments: ['snow'], defaultMetrics: ['elevationGain'] }),
  base('ice_skating', 'Ice Skating', 'winter', 'session', 5.5, { environments: ['snow', 'indoor'] }),
  base('ice_hockey', 'Ice Hockey', 'winter', 'match', 8, { environments: ['snow', 'indoor'], ...label('Period', 'Periods') }),

  // ── Sports: racket
  base('tennis', 'Tennis', 'sports', 'match', 7.3, { environments: both, ...label('Set', 'Sets') }),
  base('padel', 'Padel', 'sports', 'match', 6, { environments: both, ...label('Set', 'Sets') }),
  base('badminton', 'Badminton', 'sports', 'match', 5.5, label('Game', 'Games')),
  base('squash', 'Squash', 'sports', 'match', 7.3, label('Game', 'Games')),
  base('table_tennis', 'Table Tennis', 'sports', 'match', 4, { ...label('Game', 'Games'), aliases: ['ping pong'] }),
  base('pickleball', 'Pickleball', 'sports', 'match', 4.5, { environments: both, ...label('Game', 'Games') }),
  // ── Sports: team
  base('soccer', 'Soccer', 'sports', 'match', 7, { environments: both, ...label('Half', 'Halves'), aliases: ['football', 'futsal'] }),
  base('basketball', 'Basketball', 'sports', 'match', 6.5, { environments: both, ...label('Game', 'Games') }),
  base('volleyball', 'Volleyball', 'sports', 'match', 4, { environments: both, ...label('Set', 'Sets'), aliases: ['beach volleyball'] }),
  base('american_football', 'American Football', 'sports', 'match', 8, { environments: outdoor, ...label('Quarter', 'Quarters') }),
  base('rugby', 'Rugby', 'sports', 'match', 8.3, { environments: outdoor, ...label('Half', 'Halves') }),
  base('field_hockey', 'Field Hockey', 'sports', 'match', 7.8, { environments: outdoor, ...label('Quarter', 'Quarters') }),
  base('handball', 'Handball', 'sports', 'match', 8, label('Half', 'Halves')),
  base('baseball', 'Baseball / Softball', 'sports', 'match', 5, { environments: outdoor, ...label('Game', 'Games') }),
  base('ultimate', 'Ultimate Frisbee', 'sports', 'match', 8, { environments: outdoor, ...label('Game', 'Games') }),
  // ── Sports: precision
  base('golf', 'Golf', 'sports', 'golfRound', 4.8, { environments: outdoor, defaultMetrics: ['par'], segmentLabel: { singular: 'Round', plural: 'Rounds' } }),
  base('bowling', 'Bowling', 'sports', 'scoredGame', 3.8, label('Game', 'Games')),
  base('archery', 'Archery', 'sports', 'scoredGame', 4.3, { environments: both, ...label('End', 'Ends') }),

  // ── Combat
  base('boxing', 'Boxing', 'combat', 'timedRounds', 7.8, { equipment: 'other', primaryMuscles: ['shoulders', 'abdominals'], aliases: ['bag work', 'pads'] }),
  base('kickboxing', 'Kickboxing', 'combat', 'timedRounds', 7.8, { primaryMuscles: ['fullBody'] }),
  base('muay_thai', 'Muay Thai', 'combat', 'timedRounds', 8, { primaryMuscles: ['fullBody'] }),
  base('bjj', 'Brazilian Jiu-Jitsu', 'combat', 'timedRounds', 10, { ...label('Roll', 'Rolls'), primaryMuscles: ['fullBody'], aliases: ['grappling'] }),
  base('wrestling', 'Wrestling', 'combat', 'timedRounds', 6, { primaryMuscles: ['fullBody'] }),
  base('judo', 'Judo', 'combat', 'timedRounds', 10, { ...label('Randori', 'Randori'), primaryMuscles: ['fullBody'] }),
  base('karate', 'Karate', 'combat', 'session', 10, { aliases: ['taekwondo', 'martial arts'] }),
  base('fencing', 'Fencing', 'combat', 'match', 6, label('Bout', 'Bouts')),

  // ── Climbing
  base('bouldering', 'Bouldering', 'climbing', 'climb', 7.5, { environments: both, gradeType: 'boulder', ...label('Problem', 'Problems'), primaryMuscles: ['forearms', 'lats'] }),
  base('sport_climbing', 'Sport Climbing (Lead)', 'climbing', 'climb', 8, { environments: both, gradeType: 'route', ...label('Route', 'Routes'), primaryMuscles: ['forearms', 'lats'] }),
  base('top_rope', 'Top Rope', 'climbing', 'climb', 7.3, { environments: both, gradeType: 'route', ...label('Route', 'Routes'), primaryMuscles: ['forearms', 'lats'] }),
  base('trad_climbing', 'Trad Climbing', 'climbing', 'climb', 8, { environments: outdoor, gradeType: 'route', ...label('Pitch', 'Pitches'), primaryMuscles: ['forearms', 'lats'] }),
  base('hangboard', 'Hangboard', 'climbing', 'durationHold', 4, { equipment: 'other', defaultMetrics: ['addedWeight'], primaryMuscles: ['forearms'], secondaryMuscles: ['lats'], aliases: ['fingerboard'] }),

  // ── Mobility & mind-body
  base('yoga', 'Yoga', 'mindBody', 'session', 2.5, { environments: both }),
  base('hot_yoga', 'Hot Yoga', 'mindBody', 'session', 4),
  base('pilates', 'Pilates', 'mindBody', 'session', 3, { primaryMuscles: ['abdominals'] }),
  base('tai_chi', 'Tai Chi', 'mindBody', 'session', 3, { environments: both }),
  base('stretching', 'Stretching', 'mindBody', 'session', 2.3),
  base('mobility_drill', 'Mobility Drill', 'mindBody', 'durationHold', 2.3, { defaultMetrics: ['side'], aliases: ['stretch hold'] }),
  base('foam_rolling', 'Foam Rolling', 'mindBody', 'session', 2),

  // ── Dance
  base('dance', 'Dance', 'dance', 'session', 5, { environments: both }),
  base('dance_fitness', 'Dance Fitness', 'dance', 'session', 6.5, { aliases: ['zumba'] }),
  base('ballet', 'Ballet', 'dance', 'session', 5),
  base('barre', 'Barre', 'dance', 'session', 4),
];
