import { createContext } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Session } from '../../types';
export const AuthContext = createContext<
  | (UseQueryResult<Session | null, Error> & {
      isTransitioning: boolean;
      beginTransition: () => void;
      endTransition: () => void;
    })
  | null
>(null);
