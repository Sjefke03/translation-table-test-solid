// One activity inside the active workout. The layout (columns, segment name,
// optional fields, session fields) comes entirely from the ontology, so every
// activity type gets the same interaction: fill a row, tick it, rest, repeat.

import { Fragment, useMemo, useState } from 'react';
import { findActivity, formatDuration, layoutFor, METRICS, type MetricId } from '../ontology';
import { isSegmentComplete, previousEntry, SET_TYPES, visibleColumns, type ActivityEntry, type SetType, type Values } from '../model/workout';
import { entryStats, formatStat } from '../model/stats';
import { useStore } from '../store/store';
import { categoryIcon, columnHeader, formatSegment } from './format';
import { MetricInput } from './MetricInput';

const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];

interface Props {
  entry: ActivityEntry;
  isFirst: boolean;
  isLast: boolean;
  onStartRest: (seconds: number) => void;
  onOpenActivity: (activityId: string) => void;
}

export function EntryCard({ entry, isFirst, isLast, onStartRest, onOpenActivity }: Props) {
  const { state, dispatch } = useStore();
  const { settings } = state;
  const activity = findActivity(entry.activityId, state.customActivities);
  const [menuOpen, setMenuOpen] = useState(false);
  const [segmentMenu, setSegmentMenu] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const prev = useMemo(() => previousEntry(state.history, entry.activityId), [state.history, entry.activityId]);

  if (!activity) {
    return (
      <div className="card">
        Unknown activity <code>{entry.activityId}</code>{' '}
        <button className="link danger" onClick={() => dispatch({ type: 'removeEntry', entryId: entry.id })}>
          Remove
        </button>
      </div>
    );
  }

  const layout = layoutFor(activity);
  const { profile } = layout;
  const columns = visibleColumns(layout, entry);
  const stats = entryStats(entry, activity);
  const ids = { entryId: entry.id };

  // Hint for row i: same row last time, else the row above in this workout.
  const hintFor = (i: number): Values => prev?.segments[i]?.values ?? entry.segments[i - 1]?.values ?? {};

  let workingIndex = 0;
  const badges = entry.segments.map((s) => {
    if (profile.setTypes && s.type !== 'normal') return SET_TYPES[s.type].badge;
    workingIndex += 1;
    return String(workingIndex);
  });

  const toggleDone = (segmentId: string, i: number) => {
    const seg = entry.segments[i];
    if (seg.done) return dispatch({ type: 'uncompleteSegment', ...ids, segmentId });
    const hint = hintFor(i);
    const fill: Values = {};
    for (const c of columns) if (seg.values[c] === undefined && hint[c] !== undefined) fill[c] = hint[c];
    if (!isSegmentComplete(layout, { ...fill, ...seg.values })) {
      setInvalid(segmentId);
      setTimeout(() => setInvalid(null), 800);
      return;
    }
    dispatch({ type: 'completeSegment', ...ids, segmentId, fill });
    if (entry.restSeconds > 0) onStartRest(entry.restSeconds);
  };

  const grid = { gridTemplateColumns: `2.25rem minmax(4.5rem, 1.3fr) repeat(${columns.length}, minmax(3.6rem, 1fr)) 2.6rem` };

  return (
    <section className="card entry">
      <header className="entry-head">
        <button className="entry-title" onClick={() => onOpenActivity(activity.id)}>
          <span className="entry-icon">{categoryIcon(activity)}</span>
          <span>
            <span className="entry-name">{activity.name}</span>
            <span className="entry-sub">{profile.label}</span>
          </span>
        </button>
        <div className="menu-wrap">
          <button className="icon-btn" aria-label="Activity options" onClick={() => setMenuOpen((o) => !o)}>
            ⋯
          </button>
          {menuOpen && (
            <div className="menu" onClick={() => setMenuOpen(false)}>
              <button disabled={isFirst} onClick={() => dispatch({ type: 'moveEntry', ...ids, by: -1 })}>
                Move up
              </button>
              <button disabled={isLast} onClick={() => dispatch({ type: 'moveEntry', ...ids, by: 1 })}>
                Move down
              </button>
              <button className="danger" onClick={() => dispatch({ type: 'removeEntry', ...ids })}>
                Remove {activity.name}
              </button>
            </div>
          )}
        </div>
      </header>

      <input
        className="notes"
        placeholder="Add notes here…"
        value={entry.notes}
        onChange={(e) => dispatch({ type: 'patchEntry', ...ids, patch: { notes: e.target.value } })}
      />

      {layout.session.length > 0 && (
        <div className="session-fields">
          {layout.session.map((m) => (
            <label key={m} className="session-field">
              <span>{columnHeader(m, settings)}</span>
              <MetricInput
                metric={m}
                value={entry.sessionValues[m]}
                hint={prev?.sessionValues[m]}
                activity={activity}
                settings={settings}
                onChange={(value) => dispatch({ type: 'setSessionValue', ...ids, metric: m, value })}
              />
            </label>
          ))}
        </div>
      )}

      <label className="rest-select">
        <span>⏱ Rest timer</span>
        <select value={entry.restSeconds} onChange={(e) => dispatch({ type: 'patchEntry', ...ids, patch: { restSeconds: Number(e.target.value) } })}>
          {[...new Set([...REST_OPTIONS, entry.restSeconds])].sort((a, b) => a - b).map((s) => (
            <option key={s} value={s}>
              {s === 0 ? 'Off' : formatDuration(s)}
            </option>
          ))}
        </select>
      </label>

      <div className="seg-table" role="table" aria-label={`${activity.name} ${layout.segmentLabel.plural}`}>
        <div className="seg-row seg-header" style={grid} role="row">
          <span role="columnheader" title={layout.segmentLabel.singular}>
            {layout.segmentLabel.singular.length <= 4 ? layout.segmentLabel.singular.toUpperCase() : '#'}
          </span>
          <span role="columnheader">PREVIOUS</span>
          {columns.map((c) => (
            <span key={c} role="columnheader" title={METRICS[c].description}>
              {columnHeader(c, settings).toUpperCase()}
            </span>
          ))}
          <span role="columnheader" aria-label="Done">
            ✓
          </span>
        </div>

        {entry.segments.map((seg, i) => {
          const p = prev?.segments[i];
          const hint = hintFor(i);
          return (
            <Fragment key={seg.id}>
              <div
                className={`seg-row ${seg.done ? 'is-done' : ''} ${invalid === seg.id ? 'is-invalid' : ''} type-${seg.type}`}
                style={grid}
                role="row"
              >
                <button
                  className="seg-badge"
                  aria-label={`${layout.segmentLabel.singular} ${i + 1} options`}
                  onClick={() => setSegmentMenu(segmentMenu === seg.id ? null : seg.id)}
                >
                  {badges[i]}
                </button>
                <button
                  className="seg-prev"
                  disabled={!p || seg.done}
                  title="Copy previous values"
                  onClick={() => {
                    if (!p) return;
                    for (const c of columns) {
                      if (p.values[c] !== undefined) dispatch({ type: 'setValue', ...ids, segmentId: seg.id, metric: c, value: p.values[c] });
                    }
                  }}
                >
                  {p ? formatSegment(columns, p.values, activity, settings) || '–' : '–'}
                </button>
                {columns.map((c) => (
                  <MetricInput
                    key={c}
                    metric={c}
                    value={seg.values[c]}
                    hint={hint[c]}
                    activity={activity}
                    settings={settings}
                    ariaLabel={`${METRICS[c].label}, ${layout.segmentLabel.singular.toLowerCase()} ${i + 1}`}
                    onChange={(value) => dispatch({ type: 'setValue', ...ids, segmentId: seg.id, metric: c, value })}
                  />
                ))}
                <button
                  className={`check ${seg.done ? 'on' : ''}`}
                  aria-label={seg.done ? 'Mark not done' : 'Mark done'}
                  aria-pressed={seg.done}
                  onClick={() => toggleDone(seg.id, i)}
                >
                  ✓
                </button>
              </div>
              {segmentMenu === seg.id && (
                <div className="seg-menu" onClick={() => setSegmentMenu(null)}>
                  {profile.setTypes &&
                    (Object.keys(SET_TYPES) as SetType[]).map((t) => (
                      <button
                        key={t}
                        className={seg.type === t ? 'active' : ''}
                        onClick={() => dispatch({ type: 'setSetType', ...ids, segmentId: seg.id, setType: t })}
                      >
                        {SET_TYPES[t].badge && <b>{SET_TYPES[t].badge}</b>} {SET_TYPES[t].label}
                      </button>
                    ))}
                  <button className="danger" onClick={() => dispatch({ type: 'removeSegment', ...ids, segmentId: seg.id })}>
                    Remove {layout.segmentLabel.singular.toLowerCase()}
                  </button>
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      <button className="add-seg" onClick={() => dispatch({ type: 'addSegment', ...ids })}>
        + Add {layout.segmentLabel.singular}
      </button>

      {layout.optional.length > 0 && (
        <div className="chips optional-chips" aria-label="Optional fields">
          {layout.optional.map((m: MetricId) => {
            const on = entry.visibleMetrics.includes(m);
            return (
              <button key={m} className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => dispatch({ type: 'toggleMetric', ...ids, metric: m })}>
                {on ? '✓ ' : '+ '}
                {METRICS[m].label}
              </button>
            );
          })}
        </div>
      )}

      {stats.length > 0 && (
        <div className="entry-stats">
          {stats.map((s) => (
            <span key={s.id}>
              <small>{s.label}</small> {formatStat(s, activity, settings)}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
