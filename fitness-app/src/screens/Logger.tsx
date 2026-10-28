import { useState } from 'react';
import { EntryCard } from '../components/EntryCard';
import { useNow } from '../components/hooks';
import { RestTimer, type Rest } from '../components/RestTimer';
import { findActivity, formatDuration, formatQuantity } from '../ontology';
import { workoutVolume } from '../model/stats';
import { countDone, estimateCalories } from '../model/workout';
import { useStore } from '../store/store';
import { ActivityPicker } from './ActivityPicker';

export function Logger({ onMinimize, onFinished, onOpenActivity }: { onMinimize: () => void; onFinished: (workoutId: string | null) => void; onOpenActivity: (id: string) => void }) {
  const { state, dispatch } = useStore();
  const now = useNow();
  const [picking, setPicking] = useState(false);
  const [rest, setRest] = useState<Rest | null>(null);
  const w = state.active;
  if (!w) return null;

  const done = countDone(w);
  const volume = workoutVolume(w, (id) => findActivity(id, state.customActivities));

  const finish = () => {
    if (done === 0) {
      if (confirm('Nothing is ticked off yet, so there is nothing to save. Discard this workout?')) {
        dispatch({ type: 'discard' });
        onFinished(null);
      }
      return;
    }
    const open = w.entries.reduce((n, e) => n + e.segments.filter((s) => !s.done).length, 0);
    if (open > 0 && !confirm(`${open} unfinished ${open === 1 ? 'row' : 'rows'} will be dropped. Finish workout?`)) return;
    const id = w.id;
    dispatch({ type: 'finish' });
    onFinished(id);
  };

  return (
    <div className="screen logger">
      <header className="topbar sticky">
        <button className="icon-btn" aria-label="Minimise" onClick={onMinimize}>
          ⌄
        </button>
        <h2>Log Workout</h2>
        <button className="btn primary small" onClick={finish}>
          Finish
        </button>
      </header>

      <div className="logger-stats">
        <div>
          <small>Duration</small>
          <b className="accent">{formatDuration((now - w.startedAt) / 1000)}</b>
        </div>
        <div>
          <small>Volume</small>
          <b>{formatQuantity(volume, 'mass', state.settings.unitSystem)}</b>
        </div>
        <div>
          <small>Done</small>
          <b>{done}</b>
        </div>
        <div>
          <small>kcal (est.)</small>
          <b>{estimateCalories(w, state.settings.bodyMassKg, state.customActivities)}</b>
        </div>
      </div>

      <input className="workout-name" value={w.name} aria-label="Workout name" onChange={(e) => dispatch({ type: 'patchWorkout', patch: { name: e.target.value } })} />

      {w.entries.length === 0 && (
        <div className="empty-state">
          <div className="big-icon">🏁</div>
          <h3>Get started</h3>
          <p>Add an activity to start your workout. Lifting, running, climbing, a tennis match: it all goes in the same log.</p>
        </div>
      )}

      {w.entries.map((e, i) => (
        <EntryCard key={e.id} entry={e} isFirst={i === 0} isLast={i === w.entries.length - 1} onStartRest={(s) => setRest({ endsAt: Date.now() + s * 1000, total: s })} onOpenActivity={onOpenActivity} />
      ))}

      <button className="btn primary block" onClick={() => setPicking(true)}>
        + Add Activity
      </button>
      <textarea className="notes" placeholder="Workout notes…" value={w.notes} onChange={(e) => dispatch({ type: 'patchWorkout', patch: { notes: e.target.value } })} />
      <button
        className="btn danger-ghost block"
        onClick={() => {
          if (confirm('Discard this workout? Nothing will be saved.')) {
            dispatch({ type: 'discard' });
            onFinished(null);
          }
        }}
      >
        Discard Workout
      </button>

      {rest && <RestTimer rest={rest} onChange={setRest} />}

      {picking && (
        <ActivityPicker
          onClose={() => setPicking(false)}
          onOpenActivity={onOpenActivity}
          onAdd={(ids) => {
            dispatch({ type: 'addActivities', activityIds: ids });
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}
