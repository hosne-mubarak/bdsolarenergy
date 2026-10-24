import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productQuerySchema } from '../../schemas';
import { useRepositories } from '../store/useStore';
export function useSuggestions(value: string) {
  const { catalogue } = useRepositories();
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), 180);
    return () => clearTimeout(timer);
  }, [value]);
  const query = useQuery({
    queryKey: ['catalogue', 'suggestions', debounced],
    enabled: debounced.trim().length >= 2,
    queryFn: ({ signal }) =>
      catalogue.listProducts(productQuerySchema.parse({ text: debounced, pageSize: 5 }), {
        signal,
      }),
  });
  return { ...query, matchesInput: debounced === value };
}
