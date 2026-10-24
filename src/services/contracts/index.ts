import type {
  Address,
  AddressInput,
  Banner,
  Brand,
  Cart,
  Category,
  ChangePasswordInput,
  CheckoutInput,
  ContentPage,
  Coupon,
  LoginInput,
  NavigationItem,
  Order,
  Page,
  PaymentMethod,
  Preferences,
  Product,
  ProductImage,
  ProductQuery,
  ProductSummary,
  ProfileInput,
  Quote,
  RegisterInput,
  ResetPasswordInput,
  Review,
  Session,
  ShippingMethod,
  TrackingEvent,
  User,
  Variant,
  Wishlist,
} from '../../types';

export interface ReadOptions {
  signal?: AbortSignal;
}
export interface PageQuery {
  page?: number;
  pageSize?: number;
}
export interface CheckoutConfiguration {
  shipping: ShippingMethod[];
  payments: PaymentMethod[];
  coupons: Coupon[];
  minimumOrder: number;
  taxInclusive: true;
}
export interface VariantProduct {
  variant: Variant;
  product: Product;
}

export interface CatalogueRepository {
  listProducts(query: ProductQuery, options?: ReadOptions): Promise<Page<ProductSummary>>;
  getProduct(slug: string, options?: ReadOptions): Promise<ProductSummary>;
  getProductById(id: string, options?: ReadOptions): Promise<ProductSummary>;
  getVariant(id: string, options?: ReadOptions): Promise<VariantProduct>;
  listCategories(options?: ReadOptions): Promise<Category[]>;
  listBrands(options?: ReadOptions): Promise<Brand[]>;
  listImages(options?: ReadOptions): Promise<ProductImage[]>;
  getReviews(productId: string, options?: ReadOptions): Promise<Review[]>;
}

export interface ContentRepository {
  getAccountNavigation(options?: ReadOptions): Promise<NavigationItem[]>;
  getSiteSettings(options?: ReadOptions): Promise<import('../../types').SiteSettings>;
  getNavigation(options?: ReadOptions): Promise<NavigationItem[]>;
  getBanners(options?: ReadOptions): Promise<Banner[]>;
  getPage(slug: string, options?: ReadOptions): Promise<ContentPage>;
  getCheckoutConfiguration(options?: ReadOptions): Promise<CheckoutConfiguration>;
  getCoupons(options?: ReadOptions): Promise<Coupon[]>;
  getDefaultPreferences(options?: ReadOptions): Promise<Preferences>;
}

export interface ResetRequestResult {
  message: string;
  demoIntentId: string;
}
export interface VerificationStatus {
  status: 'guest' | 'unverified' | 'verified';
  demoOnly: true;
}
export interface DemoAccess {
  email: string;
  passphrase: string;
  demoOnly: true;
}
export interface AuthRepository {
  getDemoAccess(options?: ReadOptions): Promise<DemoAccess | null>;
  getSession(options?: ReadOptions): Promise<Session | null>;
  login(input: LoginInput): Promise<Session>;
  register(input: RegisterInput): Promise<Session>;
  logout(): Promise<void>;
  requestReset(email: string): Promise<ResetRequestResult>;
  resetDemoPassword(input: ResetPasswordInput): Promise<void>;
  getVerificationStatus(options?: ReadOptions): Promise<VerificationStatus>;
  changeDemoPassword(input: ChangePasswordInput): Promise<void>;
}

/** Account identity is resolved inside adapters, never trusted from a caller's userId. */
export interface CustomerRepository {
  getProfile(options?: ReadOptions): Promise<User>;
  updateProfile(input: ProfileInput): Promise<User>;
  listAddresses(options?: ReadOptions): Promise<Address[]>;
  getAddress(id: string, options?: ReadOptions): Promise<Address>;
  saveAddress(input: AddressInput, id?: string): Promise<Address>;
  deleteAddress(id: string): Promise<Address[]>;
  getPreferences(options?: ReadOptions): Promise<Preferences>;
  updatePreferences(input: Preferences): Promise<Preferences>;
}

export interface CartMergeResult {
  cart: Cart;
  notices: string[];
}
export interface CartRepository {
  getCart(options?: ReadOptions): Promise<Cart>;
  add(variantId: string, quantity: number): Promise<Cart>;
  setQuantity(variantId: string, quantity: number): Promise<Cart>;
  removeLine(variantId: string): Promise<Cart>;
  clear(): Promise<Cart>;
  mergeGuestCart(): Promise<CartMergeResult>;
}

export interface WishlistRepository {
  list(options?: ReadOptions): Promise<Wishlist>;
  toggle(productId: string): Promise<Wishlist>;
  mergeGuestWishlist(): Promise<Wishlist>;
}

/** Retain the same submission key while retrying a reviewed checkout, including after reload. */
export interface CheckoutAttemptRepository {
  getOrCreate(quoteId: string): Promise<string>;
}

export interface OrderRepository {
  quote(input: CheckoutInput, options?: ReadOptions): Promise<Quote>;
  placeOrder(input: CheckoutInput, idempotencyKey: string): Promise<Order>;
  listOrders(query?: PageQuery, options?: ReadOptions): Promise<Page<Order>>;
  getOrder(id: string, options?: ReadOptions): Promise<Order>;
  getTracking(id: string, options?: ReadOptions): Promise<TrackingEvent[]>;
}

export interface Repositories {
  catalogue: CatalogueRepository;
  content: ContentRepository;
  auth: AuthRepository;
  customers: CustomerRepository;
  cart: CartRepository;
  wishlist: WishlistRepository;
  orders: OrderRepository;
}

export interface Runtime {
  now(): Date;
  id(prefix?: string): string;
}
