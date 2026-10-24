import { useQuery } from '@tanstack/react-query';
import { useRepositories } from '../store/useStore';

export function useHomeData() {
  const { catalogue, content } = useRepositories();
  return useQuery({
    queryKey: ['home'],
    queryFn: async ({ signal }) => {
      const options = { signal };
      const [settings, banners, categories, images, configuration] = await Promise.all([
        content.getSiteSettings(options),
        content.getBanners(options),
        catalogue.listCategories(options),
        catalogue.listImages(options),
        content.getCheckoutConfiguration(options),
      ]);
      const products = await Promise.all(
        settings.collections.featured.map((id) => catalogue.getProductById(id, options)),
      );
      const reviews = (
        await Promise.all(
          products.slice(0, 3).map((product) => catalogue.getReviews(product.id, options)),
        )
      )
        .flat()
        .slice(0, 3);
      return { settings, banners, categories, images, configuration, products, reviews };
    },
  });
}
