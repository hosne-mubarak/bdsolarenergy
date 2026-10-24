import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RepositoryContext } from '../../app/providers/repository-context';
export function useRepositories() {
  const context = useContext(RepositoryContext);
  if (!context) throw new Error('RepositoryProvider is required');
  return context;
}
export function useSiteSettings() {
  const { content } = useRepositories();
  return useQuery({
    queryKey: ['content', 'settings'],
    queryFn: ({ signal }) => content.getSiteSettings({ signal }),
  });
}
export function useNavigation() {
  const { content } = useRepositories();
  return useQuery({
    queryKey: ['content', 'navigation'],
    queryFn: ({ signal }) => content.getNavigation({ signal }),
  });
}
export function useCategories() {
  const { catalogue } = useRepositories();
  return useQuery({
    queryKey: ['catalogue', 'categories'],
    queryFn: ({ signal }) => catalogue.listCategories({ signal }),
  });
}
export function useImages() {
  const { catalogue } = useRepositories();
  return useQuery({
    queryKey: ['catalogue', 'images'],
    queryFn: ({ signal }) => catalogue.listImages({ signal }),
  });
}
export function useBrands() {
  const { catalogue } = useRepositories();
  return useQuery({
    queryKey: ['catalogue', 'brands'],
    queryFn: ({ signal }) => catalogue.listBrands({ signal }),
  });
}
