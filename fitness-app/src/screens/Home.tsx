import { useNow } from '../components/hooks';
import { formatDuration, formatDurationLong } from '../ontology';
import { useStore } from '../store/store';
import { WorkoutCard } from './History';

const WEEK = 7 * 24 * 3600 * 1000;

export function Home({ onStart, onResume, onOpenWorkout }: { onStart: () => void; onResume: () => void; onOpenWorkout: (id: string) => void }) {
  const { state } = useStore();
  const now = useNow();
  const thisWeek = state.history.filter((w) => (w.endedAt ?? 0) > now - WEEK);
  const activeSeconds = thisWeek.reduce((t, w) => t + ((w.endedAt ?? w.startedAt) - w.startedAt) / 1000, 0);

  return (
    <div className="screen">
      <header className="topbar">
        <h2>Workout</h2>
      </header>

      {state.active ? (
        <button className="card resume" onClick={onResume}>
          <span>
            <b>{state.active.name}</b>
            <small>In progress · {formatDuration((now - state.active.startedAt) / 1000)}</small>
          </span>
          <span className="btn primary small">Resume</span>
        </button>
      ) : (
        <button className="btn primary block big" onClick={onStart}>
          + Start Empty Workout
        </button>
      )}

      <div className="week">
        <div>
          <small>Last 7 days</small>
          <b>
            {thisWeek.length} {thisWeek.length === 1 ? 'workout' : 'workouts'}
          </b>
        </div>
        <div>
          <small>Active time</small>
          <b>{formatDurationLong(activeSeconds)}</b>
        </div>
      </div>

      <h3 className="group-title">Recent</h3>
      {state.history.length === 0 && <p className="empty">Your finished workouts will appear here.</p>}
      {state.history.slice(0, 3).map((w) => (
        <WorkoutCard key={w.id} workout={w} onOpen={() => onOpenWorkout(w.id)} />
      ))}
    </div>
  );
}
