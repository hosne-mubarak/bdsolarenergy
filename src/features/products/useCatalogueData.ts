import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router';
import { productQuerySchema } from '../../schemas';
import { resolveCategoryRoute } from '../../domain/catalogue/query';
import type { ProductQuery } from '../../types';
import { RepositoryError } from '../../services/errors';
import { useRepositories } from '../store/useStore';

export function useCatalogueData({
  categorySlug,
  subcategorySlug,
  query = {},
}: {
  categorySlug?: string;
  subcategorySlug?: string;
  query?: Partial<ProductQuery>;
}) {
  const repositories = useRepositories();
  const { pathname } = useLocation();
  const normalized = productQuerySchema.parse(query);
  return useQuery({
    queryKey: [
      'catalogue',
      'list',
      pathname,
      categorySlug ?? '',
      subcategorySlug ?? '',
      normalized,
    ],
    queryFn: async ({ signal }) => {
      const options = { signal };
      const [categories, images, brands, settings] = await Promise.all([
        repositories.catalogue.listCategories(options),
        repositories.catalogue.listImages(options),
        repositories.catalogue.listBrands(options),
        repositories.content.getSiteSettings(options),
      ]);
      const category = categorySlug
        ? resolveCategoryRoute(categories, categorySlug, subcategorySlug)
        : undefined;
      if (categorySlug && !category)
        throw new RepositoryError('not_found', 'This category could not be found.');
      const page = await repositories.catalogue.listProducts(
        { ...normalized, categoryId: category?.id ?? normalized.categoryId },
        options,
      );
      return { page, categories, images, brands, settings, category };
    },
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === pathname ? previous : undefined,
  });
}
