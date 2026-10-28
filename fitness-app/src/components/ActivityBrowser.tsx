import { useMemo, useState } from 'react';
import {
  allActivities,
  CATEGORIES,
  ENVIRONMENTS,
  EQUIPMENT,
  MUSCLES,
  PROFILES,
  type ActivityDef,
  type CategoryId,
  type EquipmentId,
  type MuscleId,
} from '../ontology';
import { useStore } from '../store/store';

interface Props {
  /** When set, rows are toggleable and show a check. */
  selected?: string[];
  onToggle?: (id: string) => void;
  onOpen?: (id: string) => void;
}

export function searchText(a: ActivityDef): string {
  const cat = CATEGORIES.find((c) => c.id === a.category)?.label ?? '';
  return [
    a.name,
    ...(a.aliases ?? []),
    cat,
    PROFILES[a.profile].label,
    EQUIPMENT[a.equipment],
    ...a.environments.map((e) => ENVIRONMENTS[e]),
    ...[...a.primaryMuscles, ...a.secondaryMuscles].map((m) => MUSCLES[m]),
  ]
    .join(' ')
    .toLowerCase();
}

export function matches(a: ActivityDef, query: string): boolean {
  const text = searchText(a);
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((tok) => text.includes(tok));
}

export function activitySubtitle(a: ActivityDef): string {
  const parts = [PROFILES[a.profile].label];
  if (a.category === 'strength' || a.category === 'conditioning') {
    if (a.primaryMuscles.length) parts.push(a.primaryMuscles.map((m) => MUSCLES[m]).join(', '));
  } else {
    parts.push(a.environments.map((e) => ENVIRONMENTS[e]).join(' / '));
  }
  return parts.join(' · ');
}

export function ActivityBrowser({ selected, onToggle, onOpen }: Props) {
  const { state } = useStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [equipment, setEquipment] = useState<EquipmentId | ''>('');
  const [muscle, setMuscle] = useState<MuscleId | ''>('');

  const recentIds = useMemo(() => {
    const ids: string[] = [];
    for (const w of state.history) for (const e of w.entries) if (!ids.includes(e.activityId)) ids.push(e.activityId);
    return ids.slice(0, 8);
  }, [state.history]);

  const list = allActivities(state.customActivities).filter(
    (a) =>
      (category === 'all' || a.category === category) &&
      (!equipment || a.equipment === equipment) &&
      (!muscle || a.primaryMuscles.includes(muscle) || a.secondaryMuscles.includes(muscle)) &&
      matches(a, query),
  );

  const filtering = query || category !== 'all' || equipment || muscle;
  const groups: { title: string; items: ActivityDef[] }[] = [];
  if (!filtering && recentIds.length) {
    groups.push({ title: 'Recent', items: recentIds.map((id) => list.find((a) => a.id === id)).filter((a): a is ActivityDef => !!a) });
  }
  for (const c of CATEGORIES) {
    const items = list.filter((a) => a.category === c.id).sort((x, y) => x.name.localeCompare(y.name));
    if (items.length) groups.push({ title: `${c.icon} ${c.label}`, items });
  }

  return (
    <div className="browser">
      <input className="search" type="search" placeholder="Search activities, muscles, equipment…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus={!!onToggle} />
      <div className="chips scroll-x">
        <button className={`chip ${category === 'all' ? 'on' : ''}`} onClick={() => setCategory('all')}>
          All
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.id} className={`chip ${category === c.id ? 'on' : ''}`} onClick={() => setCategory(category === c.id ? 'all' : c.id)}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>
      <div className="filters">
        <select value={equipment} onChange={(e) => setEquipment(e.target.value as EquipmentId | '')} aria-label="Equipment">
          <option value="">All equipment</option>
          {Object.entries(EQUIPMENT).map(([id, l]) => (
            <option key={id} value={id}>
              {l}
            </option>
          ))}
        </select>
        <select value={muscle} onChange={(e) => setMuscle(e.target.value as MuscleId | '')} aria-label="Muscle">
          <option value="">All muscles</option>
          {Object.entries(MUSCLES).map(([id, l]) => (
            <option key={id} value={id}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {groups.length === 0 && <p className="empty">No activities match. Try fewer words, or create a custom activity.</p>}
      {groups.map((g) => (
        <div key={g.title} className="group">
          <h3 className="group-title">{g.title}</h3>
          {g.items.map((a) => {
            const isSel = selected?.includes(a.id);
            return (
              <div key={`${g.title}-${a.id}`} className={`activity-row ${isSel ? 'is-selected' : ''}`}>
                <button className="activity-main" onClick={() => (onToggle ? onToggle(a.id) : onOpen?.(a.id))}>
                  <span className="activity-name">
                    {a.name}
                    {a.custom && <span className="tag">Custom</span>}
                  </span>
                  <span className="activity-sub">{activitySubtitle(a)}</span>
                </button>
                {onToggle && onOpen && (
                  <button className="icon-btn" aria-label={`About ${a.name}`} onClick={() => onOpen(a.id)}>
                    ⓘ
                  </button>
                )}
                {onToggle && <span className={`select-dot ${isSel ? 'on' : ''}`} aria-hidden />}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
