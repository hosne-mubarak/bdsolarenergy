import { useQuery } from '@tanstack/react-query';
import type { Cart } from '../../types';
import { calculateCart } from '../../domain/cart/rules';
import { couponDiscount, findCoupon } from '../../domain/checkout/rules';
import { normalizeRepositoryError } from '../../services/errors';
import { useRepositories } from '../store/useStore';
import { useShoppingServices } from './useCart';

export function useCartView(cart: Cart | undefined, code: string) {
  const { catalogue, content } = useRepositories();
  const { runtime, store } = useShoppingServices();
  return useQuery({
    queryKey: ['shopping', 'cart-view', cart?.ownerKey, cart?.lines, code],
    enabled: cart !== undefined,
    queryFn: async ({ signal }) => {
      const [resolved, images, coupons] = await Promise.all([
        Promise.all(
          (cart?.lines ?? []).map((line) => catalogue.getVariant(line.variantId, { signal })),
        ),
        catalogue.listImages({ signal }),
        content.getCoupons({ signal }),
      ]);
      const products = resolved.map((item) => item.product);
      const result = calculateCart(cart?.lines ?? [], products);
      let discount = 0;
      let couponError: string | null = null;
      let couponApplied = false;
      try {
        const coupon = findCoupon(coupons, code);
        if (coupon) {
          discount = couponDiscount(coupon, result.items, products, result.subtotal, runtime.now());
          couponApplied = true;
        }
      } catch (error) {
        couponError = normalizeRepositoryError(error).message;
      }
      return {
        ...result,
        products,
        images,
        discount,
        couponError,
        couponApplied,
        notices: store.notices(),
      };
    },
  });
}
