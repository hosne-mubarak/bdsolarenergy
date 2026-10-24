import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ToastContext } from './toast-context';

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const notify = useCallback((text: string) => setMessage(text), []);
  const value = useMemo(() => ({ notify }), [notify]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region">
        <div role="status" aria-live="polite" aria-atomic="true">
          {message}
        </div>
        {message && (
          <button type="button" onClick={() => setMessage('')} aria-label="Dismiss notification">
            ×
          </button>
        )}
      </div>
    </ToastContext.Provider>
  );
}
