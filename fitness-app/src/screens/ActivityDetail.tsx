import { columnHeader, formatDate, formatSegment } from '../components/format';
import { Sheet } from '../components/Sheet';
import { categoryOf, ENVIRONMENTS, EQUIPMENT, layoutFor, METRICS, MOVEMENT_PATTERNS, MUSCLES, unitFor } from '../ontology';
import { entryStats, formatStat, personalRecords } from '../model/stats';
import { visibleColumns } from '../model/workout';
import { useActivityLookup, useStore } from '../store/store';

export function ActivityDetail({ activityId, onClose }: { activityId: string; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const lookup = useActivityLookup();
  const a = lookup(activityId);
  if (!a) return null;
  const { settings } = state;
  const layout = layoutFor(a);
  const cat = categoryOf(a);
  const records = personalRecords(a, state.history);
  const past = state.history.flatMap((w) => w.entries.filter((e) => e.activityId === a.id).map((e) => ({ w, e })));

  const inUse = past.length > 0 || !!state.active?.entries.some((e) => e.activityId === a.id);

  const unitNote = (m: (typeof layout.core)[number]) => {
    const d = METRICS[m].dimension;
    if (!d || ['count', 'rating', 'level', 'duration'].includes(d)) return '';
    const u = unitFor(d, settings.unitSystem);
    return u.symbol ? ` (${u.symbol})` : '';
  };

  return (
    <Sheet title={a.name} onClose={onClose} action={null}>
      <div className="detail-head">
        <span className="big-icon">{cat.icon}</span>
        <div>
          <h1 className="detail-title">{a.name}</h1>
          <p className="muted">
            {cat.label}
            {a.custom && ' · Custom'}
            {a.aliases?.length ? ` · also: ${a.aliases.join(', ')}` : ''}
          </p>
        </div>
      </div>

      <section className="card">
        <h3>How it’s logged</h3>
        <p>
          <b>{layout.profile.label}</b>: {layout.profile.description}
        </p>
        <dl className="facts">
          <dt>Each {layout.segmentLabel.singular.toLowerCase()}</dt>
          <dd>
            {layout.core.map((m) => (
              <span key={m} className="col-pill">
                {METRICS[m].label}
                {unitNote(m)}
              </span>
            ))}
          </dd>
          {layout.optional.length > 0 && (
            <>
              <dt>Optional</dt>
              <dd>
                {layout.optional.map((m) => (
                  <span key={m} className={`col-pill optional ${layout.defaultVisible.includes(m) ? 'default' : ''}`}>
                    {METRICS[m].label}
                    {unitNote(m)}
                  </span>
                ))}
              </dd>
            </>
          )}
          {layout.session.length > 0 && (
            <>
              <dt>Per session</dt>
              <dd>
                {layout.session.map((m) => (
                  <span key={m} className="col-pill">
                    {columnHeader(m, settings)}
                  </span>
                ))}
              </dd>
            </>
          )}
          <dt>Complete when</dt>
          <dd>{layout.profile.completion === 'all' ? 'every main field is filled' : 'any main field is filled'}</dd>
          {layout.profile.restSeconds > 0 && (
            <>
              <dt>Default rest</dt>
              <dd>{layout.profile.restSeconds}s</dd>
            </>
          )}
        </dl>
      </section>

      <section className="card">
        <h3>Classification</h3>
        <dl className="facts">
          <dt>Equipment</dt>
          <dd>{EQUIPMENT[a.equipment]}</dd>
          <dt>Environment</dt>
          <dd>{a.environments.map((e) => ENVIRONMENTS[e]).join(', ')}</dd>
          {a.pattern && (
            <>
              <dt>Movement</dt>
              <dd>{MOVEMENT_PATTERNS[a.pattern]}</dd>
            </>
          )}
          {a.primaryMuscles.length > 0 && (
            <>
              <dt>Primary</dt>
              <dd>{a.primaryMuscles.map((m) => MUSCLES[m]).join(', ')}</dd>
            </>
          )}
          {a.secondaryMuscles.length > 0 && (
            <>
              <dt>Secondary</dt>
              <dd>{a.secondaryMuscles.map((m) => MUSCLES[m]).join(', ')}</dd>
            </>
          )}
          <dt>Intensity</dt>
          <dd>{a.met} MET (used for calorie estimates)</dd>
        </dl>
      </section>

      {records.length > 0 && (
        <section className="card">
          <h3>🏆 Personal records</h3>
          <dl className="facts">
            {records.map((r) => (
              <div key={r.stat.id} className="fact-row">
                <dt>{r.stat.label}</dt>
                <dd>
                  {formatStat(r.stat, a, settings)} <small className="muted">{formatDate(r.date)}</small>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {past.length > 0 && (
        <section className="card">
          <h3>History</h3>
          {past.slice(0, 10).map(({ w, e }) => (
            <div key={e.id} className="history-item">
              <small className="muted">{formatDate(w.startedAt)}</small>
              <div>{e.segments.map((s) => formatSegment(visibleColumns(layout, e), s.values, a, settings)).join('  ·  ')}</div>
              <div className="entry-stats">
                {entryStats(e, a).map((s) => (
                  <span key={s.id}>
                    <small>{s.label}</small> {formatStat(s, a, settings)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {a.custom && (
        <button
          className="btn danger-ghost block"
          disabled={inUse}
          title={inUse ? 'Used in a logged or active workout' : ''}
          onClick={() => {
            if (confirm(`Delete custom activity “${a.name}”?`)) {
              dispatch({ type: 'deleteCustomActivity', activityId: a.id });
              onClose();
            }
          }}
        >
          {inUse ? 'Used in workouts, cannot be deleted' : 'Delete custom activity'}
        </button>
      )}
    </Sheet>
  );
}
