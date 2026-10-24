import { useContext } from 'react';
import { ShoppingContext } from '../../app/providers/shopping-context';
export function useShoppingServices() {
  const context = useContext(ShoppingContext);
  if (!context) throw new Error('ShoppingProvider is required');
  return context;
}
