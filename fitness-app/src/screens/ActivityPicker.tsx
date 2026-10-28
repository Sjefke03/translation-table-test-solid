import { useState } from 'react';
import { ActivityBrowser } from '../components/ActivityBrowser';
import { CustomActivityForm } from '../components/CustomActivityForm';
import { Sheet } from '../components/Sheet';

export function ActivityPicker({ onAdd, onClose, onOpenActivity }: { onAdd: (ids: string[]) => void; onClose: () => void; onOpenActivity: (id: string) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  if (creating) {
    return (
      <Sheet title="New activity" onClose={() => setCreating(false)}>
        <CustomActivityForm
          onCancel={() => setCreating(false)}
          onDone={(id) => {
            setSelected((s) => [...s, id]);
            setCreating(false);
          }}
        />
      </Sheet>
    );
  }

  return (
    <Sheet
      title="Add activity"
      onClose={onClose}
      action={
        <button className="link" onClick={() => setCreating(true)}>
          Create
        </button>
      }
      footer={
        selected.length > 0 && (
          <button className="btn primary block" onClick={() => onAdd(selected)}>
            Add {selected.length} {selected.length === 1 ? 'activity' : 'activities'}
          </button>
        )
      }
    >
      <ActivityBrowser selected={selected} onToggle={(id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))} onOpen={onOpenActivity} />
    </Sheet>
  );
}
