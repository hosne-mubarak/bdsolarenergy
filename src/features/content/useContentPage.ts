import { useQuery } from '@tanstack/react-query';
import { useRepositories } from '../store/useStore';
export function useContentPage(slug: string) {
  const { content } = useRepositories();
  return useQuery({
    queryKey: ['content', 'page', slug],
    queryFn: ({ signal }) => content.getPage(slug, { signal }),
  });
}
