// Classification facets. An activity has exactly one category (what kind of
// training it is) and any number of the other facets, which are used for
// browsing and filtering rather than for deciding what gets logged.

export type CategoryId =
  | 'strength'
  | 'conditioning'
  | 'cardio'
  | 'water'
  | 'winter'
  | 'sports'
  | 'combat'
  | 'climbing'
  | 'mindBody'
  | 'dance';

export interface Category {
  id: CategoryId;
  label: string;
  icon: string;
  description: string;
}

export const CATEGORIES: Category[] = [
  { id: 'strength', label: 'Strength', icon: '🏋️', description: 'Resistance training with external load or bodyweight.' },
  { id: 'conditioning', label: 'Conditioning', icon: '🔥', description: 'HIIT, circuits, plyometrics and metcons.' },
  { id: 'cardio', label: 'Cardio & Endurance', icon: '🏃', description: 'Running, cycling, walking, hiking and cardio machines.' },
  { id: 'water', label: 'Water', icon: '🏊', description: 'Swimming, paddling, rowing and board sports.' },
  { id: 'winter', label: 'Winter', icon: '⛷️', description: 'Snow and ice sports.' },
  { id: 'sports', label: 'Sports', icon: '🎾', description: 'Racket, team and precision sports.' },
  { id: 'combat', label: 'Combat', icon: '🥊', description: 'Striking, grappling and fencing.' },
  { id: 'climbing', label: 'Climbing', icon: '🧗', description: 'Bouldering, roped climbing and climbing-specific training.' },
  { id: 'mindBody', label: 'Mobility & Mind-Body', icon: '🧘', description: 'Yoga, pilates, stretching and mobility work.' },
  { id: 'dance', label: 'Dance', icon: '💃', description: 'Dance styles and dance fitness classes.' },
];

export type Environment = 'indoor' | 'outdoor' | 'water' | 'snow';

export const ENVIRONMENTS: Record<Environment, string> = {
  indoor: 'Indoor',
  outdoor: 'Outdoor',
  water: 'Water',
  snow: 'Snow & ice',
};

export type MuscleId =
  | 'abdominals'
  | 'abductors'
  | 'adductors'
  | 'biceps'
  | 'calves'
  | 'chest'
  | 'forearms'
  | 'fullBody'
  | 'glutes'
  | 'hamstrings'
  | 'lats'
  | 'lowerBack'
  | 'neck'
  | 'quadriceps'
  | 'shoulders'
  | 'traps'
  | 'triceps'
  | 'upperBack';

export const MUSCLES: Record<MuscleId, string> = {
  abdominals: 'Abdominals',
  abductors: 'Abductors',
  adductors: 'Adductors',
  biceps: 'Biceps',
  calves: 'Calves',
  chest: 'Chest',
  forearms: 'Forearms',
  fullBody: 'Full body',
  glutes: 'Glutes',
  hamstrings: 'Hamstrings',
  lats: 'Lats',
  lowerBack: 'Lower back',
  neck: 'Neck',
  quadriceps: 'Quadriceps',
  shoulders: 'Shoulders',
  traps: 'Traps',
  triceps: 'Triceps',
  upperBack: 'Upper back',
};

export type EquipmentId =
  | 'none'
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'machine'
  | 'cable'
  | 'plate'
  | 'band'
  | 'suspension'
  | 'medicineBall'
  | 'sled'
  | 'pullUpBar'
  | 'treadmill'
  | 'bike'
  | 'rower'
  | 'jumpRope'
  | 'other';

export const EQUIPMENT: Record<EquipmentId, string> = {
  none: 'Bodyweight',
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  kettlebell: 'Kettlebell',
  machine: 'Machine',
  cable: 'Cable',
  plate: 'Plate',
  band: 'Resistance band',
  suspension: 'Suspension trainer',
  medicineBall: 'Medicine ball',
  sled: 'Sled',
  pullUpBar: 'Pull-up bar',
  treadmill: 'Treadmill',
  bike: 'Bike',
  rower: 'Rower / erg',
  jumpRope: 'Jump rope',
  other: 'Other',
};

export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'horizontalPush'
  | 'verticalPush'
  | 'horizontalPull'
  | 'verticalPull'
  | 'carry'
  | 'core'
  | 'isolation'
  | 'olympic'
  | 'plyometric';

export const MOVEMENT_PATTERNS: Record<MovementPattern, string> = {
  squat: 'Squat',
  hinge: 'Hinge',
  lunge: 'Lunge',
  horizontalPush: 'Horizontal push',
  verticalPush: 'Vertical push',
  horizontalPull: 'Horizontal pull',
  verticalPull: 'Vertical pull',
  carry: 'Carry',
  core: 'Core',
  isolation: 'Isolation',
  olympic: 'Olympic lift',
  plyometric: 'Plyometric',
};
