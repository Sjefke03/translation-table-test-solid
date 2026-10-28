import { useState } from 'react';
import { useStore } from './store/store';
import { ActivityDetail } from './screens/ActivityDetail';
import { WorkoutDetail, History } from './screens/History';
import { Home } from './screens/Home';
import { Library } from './screens/Library';
import { Logger } from './screens/Logger';
import { Settings } from './screens/Settings';

type Tab = 'home' | 'history' | 'library' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Workout', icon: '🏋️' },
  { id: 'history', label: 'History', icon: '📅' },
  { id: 'library', label: 'Library', icon: '📚' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export function App() {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState<Tab>('home');
  const [logging, setLogging] = useState(!!state.active);
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [activityId, setActivityId] = useState<string | null>(null);

  const start = (activityIds?: string[]) => {
    dispatch({ type: 'start', activityIds });
    setWorkoutId(null);
    setLogging(true);
  };

  return (
    <div className="app">
      {logging && state.active ? (
        <Logger
          onMinimize={() => setLogging(false)}
          onOpenActivity={setActivityId}
          onFinished={(id) => {
            setLogging(false);
            setTab('home');
            setWorkoutId(id);
          }}
        />
      ) : (
        <>
          <main>
            {tab === 'home' && <Home onStart={() => start()} onResume={() => setLogging(true)} onOpenWorkout={setWorkoutId} />}
            {tab === 'history' && <History onOpenWorkout={setWorkoutId} />}
            {tab === 'library' && <Library onOpenActivity={setActivityId} />}
            {tab === 'settings' && <Settings />}
          </main>
          {state.active && tab !== 'home' && (
            <button className="resume-pill" onClick={() => setLogging(true)}>
              Workout in progress · Resume
            </button>
          )}
          <nav className="tabbar">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
                <span aria-hidden>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>
        </>
      )}
      {workoutId && <WorkoutDetail workoutId={workoutId} onClose={() => setWorkoutId(null)} onRepeat={(ids) => start(ids)} onOpenActivity={setActivityId} />}
      {activityId && <ActivityDetail activityId={activityId} onClose={() => setActivityId(null)} />}
    </div>
  );
}
