import type { ReactNode } from 'react';

/** Full-screen sheet with a title bar, used for pickers and forms. */
export function Sheet({ title, onClose, action, children, footer }: { title: string; onClose: () => void; action?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
      <header className="topbar">
        <button className="link" onClick={onClose}>
          Cancel
        </button>
        <h2>{title}</h2>
        <span className="topbar-action">{action}</span>
      </header>
      <div className="sheet-body">{children}</div>
      {footer && <footer className="sheet-footer">{footer}</footer>}
    </div>
  );
}
