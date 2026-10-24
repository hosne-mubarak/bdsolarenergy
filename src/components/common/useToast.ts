import { useContext } from 'react';
import { ToastContext } from '../../app/providers/toast-context';
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast requires ToastProvider');
  return context;
}
