// Climbing difficulty. Like units, a grade is stored as a canonical rank (an index
// into an aligned difficulty ladder) and shown in whichever scale the climber
// prefers. The scales are aligned with the commonly used conversion charts; the
// alignment is approximate by nature.

export type GradeType = 'boulder' | 'route';

export interface GradeScale {
  id: string;
  label: string;
  type: GradeType;
  /** grades[rank] is the label for that rank */
  grades: string[];
}

export const GRADE_SCALES: Record<string, GradeScale> = {
  v: {
    id: 'v',
    label: 'V-scale (Hueco)',
    type: 'boulder',
    grades: ['VB', 'V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12', 'V13', 'V14', 'V15', 'V16', 'V17'],
  },
  font: {
    id: 'font',
    label: 'Fontainebleau',
    type: 'boulder',
    grades: ['3', '4', '5', '5+', '6A', '6B', '6C', '7A', '7A+', '7B', '7C', '7C+', '8A', '8A+', '8B', '8B+', '8C', '8C+', '9A'],
  },
  yds: {
    id: 'yds',
    label: 'YDS (5.x)',
    type: 'route',
    grades: [
      '5.5', '5.6', '5.7', '5.8', '5.9', '5.10a', '5.10b', '5.10c', '5.10d', '5.11a', '5.11b', '5.11c', '5.11d',
      '5.12a', '5.12b', '5.12c', '5.12d', '5.13a', '5.13b', '5.13c', '5.13d', '5.14a', '5.14b', '5.14c', '5.14d',
      '5.15a', '5.15b', '5.15c',
    ],
  },
  french: {
    id: 'french',
    label: 'French',
    type: 'route',
    grades: [
      '4c', '5a', '5b', '5c', '6a', '6a+', '6b', '6b+', '6c', '6c+', '7a', '7a+', '7b', '7b+', '7c', '7c+', '8a',
      '8a+', '8b', '8b+', '8c', '8c+', '9a', '9a+', '9b', '9b+', '9c', '9c+',
    ],
  },
};

export function scalesFor(type: GradeType): GradeScale[] {
  return Object.values(GRADE_SCALES).filter((s) => s.type === type);
}

export function gradeLabel(rank: number, scaleId: string): string {
  const scale = GRADE_SCALES[scaleId];
  return scale.grades[Math.max(0, Math.min(scale.grades.length - 1, Math.round(rank)))];
}
