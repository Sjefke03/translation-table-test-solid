import { categoryIcon, formatDate, formatSegment, formatTime } from '../components/format';
import { Sheet } from '../components/Sheet';
import { formatDurationLong, formatQuantity, layoutFor, METRICS } from '../ontology';
import { entryStats, formatStat, recordsSetIn, workoutVolume } from '../model/stats';
import { estimateCalories, SET_TYPES, visibleColumns, type Workout } from '../model/workout';
import { useActivityLookup, useStore } from '../store/store';

export function WorkoutCard({ workout, onOpen }: { workout: Workout; onOpen: () => void }) {
  const { state } = useStore();
  const lookup = useActivityLookup();
  const volume = workoutVolume(workout, lookup);
  const prs = recordsSetIn(workout, state.history, lookup);
  const prCount = [...prs.values()].reduce((n, s) => n + s.length, 0);
  return (
    <button className="card workout-card" onClick={onOpen}>
      <div className="workout-card-head">
        <b>{workout.name}</b>
        <small>{formatDate(workout.startedAt)}</small>
      </div>
      <div className="workout-card-stats">
        <span>
          <small>Time</small> {formatDurationLong(((workout.endedAt ?? workout.startedAt) - workout.startedAt) / 1000)}
        </span>
        {volume > 0 && (
          <span>
            <small>Volume</small> {formatQuantity(volume, 'mass', state.settings.unitSystem)}
          </span>
        )}
        {prCount > 0 && (
          <span>
            <small>Records</small> 🏆 {prCount}
          </span>
        )}
      </div>
      <ul className="workout-card-entries">
        {workout.entries.slice(0, 5).map((e) => {
          const a = lookup(e.activityId);
          if (!a) return null;
          const l = layoutFor(a);
          return (
            <li key={e.id}>
              {categoryIcon(a)} {e.segments.length} {(e.segments.length === 1 ? l.segmentLabel.singular : l.segmentLabel.plural).toLowerCase()} · {a.name}
            </li>
          );
        })}
        {workout.entries.length > 5 && <li className="muted">+{workout.entries.length - 5} more</li>}
      </ul>
    </button>
  );
}

export function History({ onOpenWorkout }: { onOpenWorkout: (id: string) => void }) {
  const { state } = useStore();
  return (
    <div className="screen">
      <header className="topbar">
        <h2>History</h2>
      </header>
      {state.history.length === 0 && <p className="empty">No workouts yet. Finished workouts show up here.</p>}
      {state.history.map((w) => (
        <WorkoutCard key={w.id} workout={w} onOpen={() => onOpenWorkout(w.id)} />
      ))}
    </div>
  );
}

export function WorkoutDetail({ workoutId, onClose, onRepeat, onOpenActivity }: { workoutId: string; onClose: () => void; onRepeat: (ids: string[]) => void; onOpenActivity: (id: string) => void }) {
  const { state, dispatch } = useStore();
  const lookup = useActivityLookup();
  const w = state.history.find((x) => x.id === workoutId);
  if (!w) return null;
  const { settings } = state;
  const prs = recordsSetIn(w, state.history, lookup);
  const volume = workoutVolume(w, lookup);

  return (
    <Sheet
      title="Workout"
      onClose={onClose}
      footer={
        <div className="form-actions">
          <button
            className="btn danger-ghost"
            onClick={() => {
              if (confirm('Delete this workout?')) {
                dispatch({ type: 'deleteWorkout', workoutId });
                onClose();
              }
            }}
          >
            Delete
          </button>
          <button className="btn primary" disabled={!!state.active} title={state.active ? 'Finish the current workout first' : ''} onClick={() => onRepeat(w.entries.map((e) => e.activityId))}>
            Repeat workout
          </button>
        </div>
      }
    >
      <h1 className="detail-title">{w.name}</h1>
      <p className="muted">
        {formatDate(w.startedAt)} · {formatTime(w.startedAt)}
      </p>
      <div className="logger-stats">
        <div>
          <small>Duration</small>
          <b>{formatDurationLong(((w.endedAt ?? w.startedAt) - w.startedAt) / 1000)}</b>
        </div>
        <div>
          <small>Volume</small>
          <b>{formatQuantity(volume, 'mass', settings.unitSystem)}</b>
        </div>
        <div>
          <small>kcal (est.)</small>
          <b>{estimateCalories(w, settings.bodyMassKg, state.customActivities)}</b>
        </div>
      </div>
      {w.notes && <p className="note-text">{w.notes}</p>}

      {w.entries.map((e) => {
        const a = lookup(e.activityId);
        if (!a) return null;
        const layout = layoutFor(a);
        const cols = visibleColumns(layout, e);
        const entryPrs = prs.get(e.id) ?? [];
        let n = 0;
        return (
          <section key={e.id} className="card">
            <button className="entry-title" onClick={() => onOpenActivity(a.id)}>
              <span className="entry-icon">{categoryIcon(a)}</span>
              <span className="entry-name">{a.name}</span>
            </button>
            {e.notes && <p className="note-text">{e.notes}</p>}
            {layout.session.some((m) => e.sessionValues[m] !== undefined) && (
              <p className="muted">
                {layout.session
                  .filter((m) => e.sessionValues[m] !== undefined)
                  .map((m) => `${METRICS[m].label}: ${formatSegment([m], e.sessionValues, a, settings)}`)
                  .join(' · ')}
              </p>
            )}
            <ol className="segment-list">
              {e.segments.map((s) => {
                const badge = layout.profile.setTypes && s.type !== 'normal' ? SET_TYPES[s.type].badge : String(++n);
                return (
                  <li key={s.id} className={`type-${s.type}`}>
                    <span className="seg-badge static">{badge}</span>
                    {formatSegment(cols, s.values, a, settings)}
                  </li>
                );
              })}
            </ol>
            <div className="entry-stats">
              {entryStats(e, a).map((s) => (
                <span key={s.id} className={entryPrs.some((p) => p.id === s.id) ? 'is-pr' : ''}>
                  <small>{s.label}</small> {formatStat(s, a, settings)} {entryPrs.some((p) => p.id === s.id) && '🏆'}
                </span>
              ))}
            </div>
          </section>
        );
      })}
    </Sheet>
  );
}
