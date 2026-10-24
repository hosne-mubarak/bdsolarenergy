import { useAuth } from './useAuth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RegisterInput } from '../../types';
import { useShoppingServices } from '../store/useShoppingServices';
import { completeSignIn } from './complete-sign-in';

export function useRegister() {
  const transition = useAuth();
  const services = useShoppingServices();
  const { auth } = services;
  const client = useQueryClient();
  return useMutation({
    mutationKey: ['auth', 'transition'],
    onMutate: () => transition.beginTransition(),
    onSettled: () => transition.endTransition(),
    mutationFn: (input: RegisterInput) => auth.register(input),
    onSuccess: () => completeSignIn(services, client),
  });
}
