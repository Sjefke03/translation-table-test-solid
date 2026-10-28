import { useRef } from 'react';
import { MetricInput } from '../components/MetricInput';
import { ACTIVITIES, GRADE_SCALES, scalesFor, type UnitSystem } from '../ontology';
import { INITIAL_STATE, useStore, type State } from '../store/store';

export function Settings() {
  const { state, dispatch } = useStore();
  const { settings } = state;
  const fileRef = useRef<HTMLInputElement>(null);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workouts-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="screen">
      <header className="topbar">
        <h2>Settings</h2>
      </header>

      <section className="card form">
        <div className="field">
          <span>Units</span>
          <div className="segmented">
            {(['metric', 'imperial'] as UnitSystem[]).map((u) => (
              <button key={u} className={settings.unitSystem === u ? 'on' : ''} onClick={() => dispatch({ type: 'updateSettings', patch: { unitSystem: u } })}>
                {u === 'metric' ? 'Metric (kg, km)' : 'Imperial (lb, mi)'}
              </button>
            ))}
          </div>
          <small className="muted">Everything is stored in metric; switching only changes how it is shown.</small>
        </div>

        <label className="field">
          <span>Body weight (for calorie estimates)</span>
          <MetricInput
            metric="weight"
            value={settings.bodyMassKg}
            activity={ACTIVITIES[0]}
            settings={settings}
            onChange={(v) => typeof v === 'number' && v > 0 && dispatch({ type: 'updateSettings', patch: { bodyMassKg: v } })}
          />
        </label>

        <label className="field">
          <span>Boulder grades</span>
          <select value={settings.boulderScale} onChange={(e) => dispatch({ type: 'updateSettings', patch: { boulderScale: e.target.value } })}>
            {scalesFor('boulder').map((s) => (
              <option key={s.id} value={s.id}>
                {GRADE_SCALES[s.id].label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Route grades</span>
          <select value={settings.routeScale} onChange={(e) => dispatch({ type: 'updateSettings', patch: { routeScale: e.target.value } })}>
            {scalesFor('route').map((s) => (
              <option key={s.id} value={s.id}>
                {GRADE_SCALES[s.id].label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card form">
        <h3>Data</h3>
        <p className="muted">
          {state.history.length} workouts, {state.customActivities.length} custom activities, stored in this browser.
        </p>
        <button className="btn ghost block" onClick={exportData}>
          Export JSON
        </button>
        <button className="btn ghost block" onClick={() => fileRef.current?.click()}>
          Import JSON
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const parsed = JSON.parse(await f.text()) as State;
              if (!Array.isArray(parsed.history)) throw new Error('missing history');
              if (confirm(`Replace current data with ${parsed.history.length} workouts from ${f.name}?`)) {
                dispatch({ type: 'replaceAll', state: { ...INITIAL_STATE, ...parsed, settings: { ...INITIAL_STATE.settings, ...parsed.settings } } });
              }
            } catch (err) {
              alert(`Could not import: ${(err as Error).message}`);
            }
            e.target.value = '';
          }}
        />
        <button
          className="btn danger-ghost block"
          onClick={() => confirm('Delete all workouts, custom activities and settings?') && dispatch({ type: 'replaceAll', state: INITIAL_STATE })}
        >
          Reset all data
        </button>
      </section>
    </div>
  );
}
