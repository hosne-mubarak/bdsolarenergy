import { createContext } from 'react';
export const ToastContext = createContext<{ notify: (message: string) => void } | null>(null);
