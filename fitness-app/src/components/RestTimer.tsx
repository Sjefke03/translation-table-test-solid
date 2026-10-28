import { useEffect, useRef } from 'react';
import { formatDuration } from '../ontology';
import { useNow } from './hooks';

export interface Rest {
  endsAt: number;
  total: number;
}

export function RestTimer({ rest, onChange }: { rest: Rest; onChange: (rest: Rest | null) => void }) {
  const now = useNow(250);
  const left = Math.max(0, Math.ceil((rest.endsAt - now) / 1000));
  const fired = useRef(false);

  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      navigator.vibrate?.([200, 100, 200]);
      const t = setTimeout(() => onChange(null), 1500);
      return () => clearTimeout(t);
    }
  }, [left, onChange]);

  const adjust = (by: number) => onChange({ endsAt: rest.endsAt + by * 1000, total: Math.max(1, rest.total + by) });

  return (
    <div className={`rest-bar ${left === 0 ? 'is-over' : ''}`} role="timer" aria-live="polite">
      <div className="rest-progress" style={{ width: `${(left / rest.total) * 100}%` }} />
      <button className="btn ghost small" onClick={() => adjust(-15)}>
        −15
      </button>
      <span className="rest-time">{left === 0 ? 'Rest over' : formatDuration(left)}</span>
      <button className="btn ghost small" onClick={() => adjust(15)}>
        +15
      </button>
      <button className="btn primary small" onClick={() => onChange(null)}>
        Skip
      </button>
    </div>
  );
}
