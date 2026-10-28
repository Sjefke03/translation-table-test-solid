import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react';
import { findActivity, type ActivityDef, type MetricId, type MetricValue } from '../ontology';
import {
  DEFAULT_SETTINGS,
  finalizeWorkout,
  newEntry,
  newSegment,
  newWorkout,
  previousEntry,
  type ActivityEntry,
  type Settings,
  type SetType,
  type Values,
  type Workout,
} from '../model/workout';

export interface State {
  settings: Settings;
  active: Workout | null;
  history: Workout[];
  customActivities: ActivityDef[];
}

export type Action =
  | { type: 'start'; activityIds?: string[] }
  | { type: 'addActivities'; activityIds: string[] }
  | { type: 'removeEntry'; entryId: string }
  | { type: 'moveEntry'; entryId: string; by: -1 | 1 }
  | { type: 'patchEntry'; entryId: string; patch: Partial<Pick<ActivityEntry, 'notes' | 'restSeconds'>> }
  | { type: 'toggleMetric'; entryId: string; metric: MetricId }
  | { type: 'addSegment'; entryId: string }
  | { type: 'removeSegment'; entryId: string; segmentId: string }
  | { type: 'setValue'; entryId: string; segmentId: string; metric: MetricId; value: MetricValue | undefined }
  | { type: 'setSessionValue'; entryId: string; metric: MetricId; value: MetricValue | undefined }
  | { type: 'setSetType'; entryId: string; segmentId: string; setType: SetType }
  | { type: 'completeSegment'; entryId: string; segmentId: string; fill: Values }
  | { type: 'uncompleteSegment'; entryId: string; segmentId: string }
  | { type: 'patchWorkout'; patch: Partial<Pick<Workout, 'name' | 'notes'>> }
  | { type: 'finish' }
  | { type: 'discard' }
  | { type: 'deleteWorkout'; workoutId: string }
  | { type: 'updateSettings'; patch: Partial<Settings> }
  | { type: 'addCustomActivity'; activity: ActivityDef }
  | { type: 'deleteCustomActivity'; activityId: string }
  | { type: 'replaceAll'; state: State };

const STORAGE_KEY = 'fitness-app/v1';

export const INITIAL_STATE: State = { settings: DEFAULT_SETTINGS, active: null, history: [], customActivities: [] };

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STATE;
    const parsed = JSON.parse(raw) as Partial<State>;
    return { ...INITIAL_STATE, ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } };
  } catch {
    return INITIAL_STATE;
  }
}

function setValue(values: Values, metric: MetricId, value: MetricValue | undefined): Values {
  const next = { ...values };
  if (value === undefined || value === '') delete next[metric];
  else next[metric] = value;
  return next;
}

function withEntries(state: State, fn: (entries: ActivityEntry[]) => ActivityEntry[]): State {
  if (!state.active) return state;
  return { ...state, active: { ...state.active, entries: fn(state.active.entries) } };
}

function withEntry(state: State, entryId: string, fn: (e: ActivityEntry) => ActivityEntry): State {
  return withEntries(state, (entries) => entries.map((e) => (e.id === entryId ? fn(e) : e)));
}

function withSegment(state: State, entryId: string, segmentId: string, fn: (s: ActivityEntry['segments'][number]) => ActivityEntry['segments'][number]): State {
  return withEntry(state, entryId, (e) => ({ ...e, segments: e.segments.map((s) => (s.id === segmentId ? fn(s) : s)) }));
}

function entriesFor(state: State, activityIds: string[]): ActivityEntry[] {
  return activityIds.flatMap((id) => {
    const a = findActivity(id, state.customActivities);
    return a ? [newEntry(a, previousEntry(state.history, id))] : [];
  });
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'start': {
      const w = newWorkout();
      return { ...state, active: { ...w, entries: entriesFor(state, action.activityIds ?? []) } };
    }
    case 'addActivities':
      return withEntries(state, (entries) => [...entries, ...entriesFor(state, action.activityIds)]);
    case 'removeEntry':
      return withEntries(state, (entries) => entries.filter((e) => e.id !== action.entryId));
    case 'moveEntry':
      return withEntries(state, (entries) => {
        const i = entries.findIndex((e) => e.id === action.entryId);
        const j = i + action.by;
        if (i < 0 || j < 0 || j >= entries.length) return entries;
        const next = [...entries];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      });
    case 'patchEntry':
      return withEntry(state, action.entryId, (e) => ({ ...e, ...action.patch }));
    case 'toggleMetric':
      return withEntry(state, action.entryId, (e) => ({
        ...e,
        visibleMetrics: e.visibleMetrics.includes(action.metric)
          ? e.visibleMetrics.filter((m) => m !== action.metric)
          : [...e.visibleMetrics, action.metric],
      }));
    case 'addSegment':
      return withEntry(state, action.entryId, (e) => {
        const last = e.segments[e.segments.length - 1];
        // Carry over the type of the last set unless it was a warm-up.
        return { ...e, segments: [...e.segments, newSegment(last && last.type !== 'warmup' ? last.type : 'normal')] };
      });
    case 'removeSegment':
      return withEntry(state, action.entryId, (e) => ({ ...e, segments: e.segments.filter((s) => s.id !== action.segmentId) }));
    case 'setValue':
      return withSegment(state, action.entryId, action.segmentId, (s) => ({ ...s, values: setValue(s.values, action.metric, action.value) }));
    case 'setSessionValue':
      return withEntry(state, action.entryId, (e) => ({ ...e, sessionValues: setValue(e.sessionValues, action.metric, action.value) }));
    case 'setSetType':
      return withSegment(state, action.entryId, action.segmentId, (s) => ({ ...s, type: action.setType }));
    case 'completeSegment':
      return withSegment(state, action.entryId, action.segmentId, (s) => ({ ...s, values: { ...action.fill, ...s.values }, done: true }));
    case 'uncompleteSegment':
      return withSegment(state, action.entryId, action.segmentId, (s) => ({ ...s, done: false }));
    case 'patchWorkout':
      return state.active ? { ...state, active: { ...state.active, ...action.patch } } : state;
    case 'finish': {
      if (!state.active) return state;
      const done = finalizeWorkout(state.active);
      return { ...state, active: null, history: done.entries.length ? [done, ...state.history] : state.history };
    }
    case 'discard':
      return { ...state, active: null };
    case 'deleteWorkout':
      return { ...state, history: state.history.filter((w) => w.id !== action.workoutId) };
    case 'updateSettings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'addCustomActivity':
      return { ...state, customActivities: [...state.customActivities, action.activity] };
    case 'deleteCustomActivity':
      return { ...state, customActivities: state.customActivities.filter((a) => a.id !== action.activityId) };
    case 'replaceAll':
      return action.state;
  }
}

const StoreContext = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full or unavailable: keep working in memory
    }
  }, [state]);
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore outside StoreProvider');
  return ctx;
}

/** Look up an activity including the user's custom ones. */
export function useActivityLookup() {
  const { state } = useStore();
  return (id: string) => findActivity(id, state.customActivities);
}
