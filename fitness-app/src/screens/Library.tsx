import { useState } from 'react';
import { ActivityBrowser } from '../components/ActivityBrowser';
import { CustomActivityForm } from '../components/CustomActivityForm';
import { Sheet } from '../components/Sheet';
import {
  allActivities,
  CATEGORIES,
  GRADE_SCALES,
  METRICS,
  PROFILES,
  unitFor,
  validateActivities,
  validateVocabulary,
} from '../ontology';
import { useStore } from '../store/store';

export function Library({ onOpenActivity }: { onOpenActivity: (id: string) => void }) {
  const [tab, setTab] = useState<'activities' | 'ontology'>('activities');
  const [creating, setCreating] = useState(false);
  return (
    <div className="screen">
      <header className="topbar">
        <h2>Library</h2>
        <button className="link topbar-action" onClick={() => setCreating(true)}>
          + Custom
        </button>
      </header>
      <div className="segmented">
        <button className={tab === 'activities' ? 'on' : ''} onClick={() => setTab('activities')}>
          Activities
        </button>
        <button className={tab === 'ontology' ? 'on' : ''} onClick={() => setTab('ontology')}>
          Ontology
        </button>
      </div>
      {tab === 'activities' ? <ActivityBrowser onOpen={onOpenActivity} /> : <Ontology />}
      {creating && (
        <Sheet title="New activity" onClose={() => setCreating(false)}>
          <CustomActivityForm
            onCancel={() => setCreating(false)}
            onDone={(id) => {
              setCreating(false);
              onOpenActivity(id);
            }}
          />
        </Sheet>
      )}
    </div>
  );
}

function Ontology() {
  const { state } = useStore();
  const activities = allActivities(state.customActivities);
  const problems = [...validateVocabulary(), ...validateActivities(activities)];
  const sys = state.settings.unitSystem;

  return (
    <div className="ontology">
      <section className="card">
        <h3>How activities are modelled</h3>
        <ol className="layers">
          <li>
            <b>Metrics</b> are the atoms: weight, reps, time, distance, grade, score… Each has a kind (number, time, choice, grade) that picks the input
            widget, and a physical dimension that picks the unit. Values are stored in SI units and converted for display.
          </li>
          <li>
            <b>Tracking profiles</b> say what repeats (a set, an interval, a climb, a game) and which metrics go in each row, which are optional, and
            which are recorded once per session.
          </li>
          <li>
            <b>Activities</b> pick one profile, can refine it (default columns, extra metrics, their own name for a row), and are classified by
            category, equipment, environment, movement pattern and muscles.
          </li>
          <li>
            <b>Stats</b> are derived from metrics, not from activities: anything with weight and reps gets volume and an estimated 1RM, anything with
            distance and time gets pace.
          </li>
        </ol>
        <p className={problems.length ? 'error' : 'ok'}>
          {problems.length
            ? `⚠ ${problems.length} consistency problems: ${problems.join('; ')}`
            : `✓ Consistent: ${activities.length} activities, ${Object.keys(PROFILES).length} profiles, ${Object.keys(METRICS).length} metrics.`}
        </p>
      </section>

      <section className="card">
        <h3>Tracking profiles</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Profile</th>
                <th>Row</th>
                <th>Columns</th>
                <th>Optional</th>
                <th>Session</th>
                <th>#</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(PROFILES).map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.label}</b>
                  </td>
                  <td>{p.segment}</td>
                  <td>{p.segmentMetrics.map((m) => METRICS[m].label).join(', ')}</td>
                  <td className="muted">{p.optionalMetrics.map((m) => METRICS[m].label).join(', ')}</td>
                  <td className="muted">{p.sessionMetrics.map((m) => METRICS[m].label).join(', ')}</td>
                  <td>{activities.filter((a) => a.profile === p.id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h3>Metrics</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Kind</th>
                <th>Dimension</th>
                <th>Unit ({sys})</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(METRICS).map((m) => (
                <tr key={m.id}>
                  <td title={m.description}>
                    <b>{m.label}</b>
                  </td>
                  <td>{m.kind}</td>
                  <td className="muted">{m.dimension ?? (m.options ? m.options.map((o) => o.label).join(' / ') : m.kind === 'grade' ? 'difficulty rank' : '')}</td>
                  <td>{m.dimension ? unitFor(m.dimension, sys).symbol || '—' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h3>Categories</h3>
        <ul className="plain">
          {CATEGORIES.map((c) => (
            <li key={c.id}>
              {c.icon} <b>{c.label}</b> <span className="muted">— {c.description}</span> ({activities.filter((a) => a.category === c.id).length})
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3>Climbing grade scales</h3>
        <p className="muted">Grades are stored as a rank on an aligned ladder and shown in your preferred scale (Settings).</p>
        <ul className="plain">
          {Object.values(GRADE_SCALES).map((s) => (
            <li key={s.id}>
              <b>{s.label}</b> ({s.type}): {s.grades[0]} … {s.grades[s.grades.length - 1]}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
