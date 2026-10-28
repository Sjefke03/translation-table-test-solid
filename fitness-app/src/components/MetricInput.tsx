// One input widget per metric kind. Values in and out are canonical; conversion
// to the user's units happens here, so the rest of the app never sees display units.

import { useEffect, useState } from 'react';
import {
  durationToDigits,
  fromDisplay,
  GRADE_SCALES,
  maskDurationDigits,
  METRICS,
  parseDurationDigits,
  toDisplay,
  type ActivityDef,
  type MetricId,
  type MetricValue,
} from '../ontology';
import type { Settings } from '../model/workout';
import { formatValue, gradeScaleFor } from './format';

interface Props {
  metric: MetricId;
  value: MetricValue | undefined;
  /** Previous value, shown greyed out as a hint. */
  hint?: MetricValue;
  onChange: (value: MetricValue | undefined) => void;
  activity: ActivityDef;
  settings: Settings;
  disabled?: boolean;
  ariaLabel?: string;
}

export function MetricInput(props: Props) {
  const m = METRICS[props.metric];
  switch (m.kind) {
    case 'quantity':
      return <QuantityInput {...props} />;
    case 'duration':
      return <DurationInput {...props} />;
    case 'choice':
    case 'grade':
      return <ChoiceInput {...props} />;
  }
}

function QuantityInput({ metric, value, hint, onChange, settings, disabled, ariaLabel }: Props) {
  const m = METRICS[metric];
  const dim = m.dimension!;
  const show = (v: MetricValue | undefined) => (typeof v === 'number' ? String(toDisplay(v, dim, settings.unitSystem)) : '');
  const [text, setText] = useState(show(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(show(value));
  }, [value, focused, settings.unitSystem]);

  return (
    <input
      className="cell-input"
      type="text"
      inputMode={m.integer ? 'numeric' : 'decimal'}
      aria-label={ariaLabel ?? m.label}
      placeholder={show(hint) || '–'}
      value={text}
      disabled={disabled}
      onFocus={(e) => {
        setFocused(true);
        e.target.select();
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const t = e.target.value.replace(',', '.').replace(m.integer ? /[^\d]/g : /[^\d.]/g, '');
        setText(t);
        const n = parseFloat(t);
        if (t === '' || Number.isNaN(n)) return onChange(undefined);
        const clamped = Math.min(m.max ?? Infinity, Math.max(m.min ?? 0, n));
        onChange(fromDisplay(clamped, dim, settings.unitSystem));
      }}
    />
  );
}

/** Timer-style: digits fill from the right, so typing 1-3-0 gives 1:30. */
function DurationInput({ value, hint, onChange, disabled, ariaLabel }: Props) {
  const digits = typeof value === 'number' ? durationToDigits(value) : '';
  const hintDigits = typeof hint === 'number' ? durationToDigits(hint) : '';
  return (
    <input
      className="cell-input"
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel ?? 'Time'}
      placeholder={hintDigits ? maskDurationDigits(hintDigits) : '0:00'}
      value={maskDurationDigits(digits)}
      disabled={disabled}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, '');
        // Deleting the colon only removes a formatting character: treat as backspace.
        const next = raw === digits && e.target.value.length < maskDurationDigits(digits).length ? raw.slice(0, -1) : raw;
        onChange(parseDurationDigits(next));
      }}
    />
  );
}

function ChoiceInput({ metric, value, hint, onChange, activity, settings, disabled, ariaLabel }: Props) {
  const m = METRICS[metric];
  const options =
    m.kind === 'grade'
      ? GRADE_SCALES[gradeScaleFor(activity, settings)].grades.map((g, rank) => ({ value: String(rank), label: g }))
      : m.options!;
  const hintLabel = hint !== undefined ? formatValue(metric, hint, activity, settings) : '';
  return (
    <select
      className={`cell-input cell-select ${value === undefined ? 'is-empty' : ''}`}
      aria-label={ariaLabel ?? m.label}
      value={value === undefined ? '' : String(value)}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        if (v === '') return onChange(undefined);
        onChange(m.kind === 'grade' ? Number(v) : v);
      }}
    >
      <option value="">{hintLabel || '–'}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
