import { createContext } from 'react';
import type { ShoppingServices } from '../../services/shopping';
export const ShoppingContext = createContext<ShoppingServices | null>(null);
