import { useQuery } from '@tanstack/react-query';
import { useRepositories } from '../store/useStore';
export function useProductDetail(slug: string) {
  const { catalogue, content } = useRepositories();
  return useQuery({
    queryKey: ['catalogue', 'detail', slug],
    queryFn: async ({ signal }) => {
      const options = { signal };
      const product = await catalogue.getProduct(slug, options);
      const [images, reviews, configuration, warranty] = await Promise.all([
        catalogue.listImages(options),
        catalogue.getReviews(product.id, options),
        content.getCheckoutConfiguration(options),
        content.getPage('warranty', options),
      ]);
      return {
        product,
        images: images.filter((image) => product.imageIds.includes(image.id)),
        reviews,
        configuration,
        warranty,
      };
    },
  });
}
