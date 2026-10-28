import { useState } from 'react';
import {
  ACTIVITIES,
  CATEGORIES,
  ENVIRONMENTS,
  EQUIPMENT,
  layoutFor,
  METRICS,
  MUSCLES,
  PROFILES,
  validateActivities,
  type ActivityDef,
  type CategoryId,
  type Environment,
  type EquipmentId,
  type GradeType,
  type MuscleId,
  type ProfileId,
} from '../ontology';
import { newId } from '../model/workout';
import { useStore } from '../store/store';
import { columnHeader } from './format';

const SUGGESTED_PROFILE: Record<CategoryId, ProfileId> = {
  strength: 'weightReps',
  conditioning: 'timedRounds',
  cardio: 'distanceDuration',
  water: 'distanceDuration',
  winter: 'descent',
  sports: 'match',
  combat: 'timedRounds',
  climbing: 'climb',
  mindBody: 'session',
  dance: 'session',
};

function medianMet(category: CategoryId): number {
  const mets = ACTIVITIES.filter((a) => a.category === category)
    .map((a) => a.met)
    .sort((a, b) => a - b);
  return mets[Math.floor(mets.length / 2)] ?? 5;
}

const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

export function CustomActivityForm({ onDone, onCancel }: { onDone: (id: string) => void; onCancel: () => void }) {
  const { state, dispatch } = useStore();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<CategoryId>('strength');
  const [profile, setProfile] = useState<ProfileId>('weightReps');
  const [equipment, setEquipment] = useState<EquipmentId>('none');
  const [muscles, setMuscles] = useState<MuscleId[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>(['indoor']);
  const [gradeType, setGradeType] = useState<GradeType>('boulder');

  const draft: ActivityDef = {
    id: `custom_${newId()}`,
    name: name.trim(),
    category,
    profile,
    equipment,
    environments,
    met: medianMet(category),
    primaryMuscles: muscles,
    secondaryMuscles: [],
    gradeType: profile === 'climb' ? gradeType : undefined,
    custom: true,
  };
  const layout = layoutFor(draft);
  const errors = [
    ...(name.trim() ? [] : ['Give it a name.']),
    ...(environments.length ? [] : ['Pick at least one environment.']),
    ...validateActivities([...state.customActivities, draft]).filter((e) => e.startsWith(draft.id)),
  ];

  return (
    <div className="form">
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Landmine Press" autoFocus />
      </label>

      <div className="field">
        <span>Category</span>
        <div className="chips wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chip ${category === c.id ? 'on' : ''}`}
              onClick={() => {
                setCategory(c.id);
                setProfile(SUGGESTED_PROFILE[c.id]);
              }}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>How do you track it?</span>
        <div className="profile-options">
          {Object.values(PROFILES).map((p) => (
            <button key={p.id} type="button" className={`profile-option ${profile === p.id ? 'on' : ''}`} onClick={() => setProfile(p.id)}>
              <b>{p.label}</b>
              <small>{p.description}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="preview">
        <small>You will log, per {layout.segmentLabel.singular.toLowerCase()}:</small>
        <div className="preview-cols">
          {layout.core.map((m) => (
            <span key={m} className="col-pill">
              {columnHeader(m, state.settings)}
            </span>
          ))}
          {layout.optional.map((m) => (
            <span key={m} className="col-pill optional">
              + {METRICS[m].label}
            </span>
          ))}
        </div>
        {layout.session.length > 0 && <small>Once per session: {layout.session.map((m) => METRICS[m].label).join(', ')}</small>}
      </div>

      {profile === 'climb' && (
        <div className="field">
          <span>Grades</span>
          <div className="chips">
            {(['boulder', 'route'] as GradeType[]).map((g) => (
              <button key={g} type="button" className={`chip ${gradeType === g ? 'on' : ''}`} onClick={() => setGradeType(g)}>
                {g === 'boulder' ? 'Boulder grades' : 'Route grades'}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="field">
        <span>Equipment</span>
        <select value={equipment} onChange={(e) => setEquipment(e.target.value as EquipmentId)}>
          {Object.entries(EQUIPMENT).map(([id, l]) => (
            <option key={id} value={id}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <div className="field">
        <span>Environment</span>
        <div className="chips wrap">
          {(Object.keys(ENVIRONMENTS) as Environment[]).map((e) => (
            <button key={e} type="button" className={`chip ${environments.includes(e) ? 'on' : ''}`} onClick={() => setEnvironments(toggle(environments, e))}>
              {ENVIRONMENTS[e]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>Main muscles (optional)</span>
        <div className="chips wrap">
          {(Object.keys(MUSCLES) as MuscleId[]).map((m) => (
            <button key={m} type="button" className={`chip small ${muscles.includes(m) ? 'on' : ''}`} onClick={() => setMuscles(toggle(muscles, m))}>
              {MUSCLES[m]}
            </button>
          ))}
        </div>
      </div>

      {errors.length > 0 && name && <p className="error">{errors.join(' ')}</p>}

      <div className="form-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={errors.length > 0}
          onClick={() => {
            dispatch({ type: 'addCustomActivity', activity: draft });
            onDone(draft.id);
          }}
        >
          Create
        </button>
      </div>
    </div>
  );
}
