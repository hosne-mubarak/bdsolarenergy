import { z } from 'zod';
import * as schemas from '../../schemas';
import { validateFixtureIntegrity, type FixtureSet } from '../../schemas/fixture-integrity';
import type { Preferences, NavigationItem } from '../../types';
import { validateInput } from '../validation';
import { RepositoryError } from '../errors';
import productsData from '../../data/products.json';
import categoriesData from '../../data/categories.json';
import brandsData from '../../data/brands.json';
import imagesData from '../../data/images.json';
import reviewsData from '../../data/reviews.json';
import bannersData from '../../data/banners.json';
import navigationData from '../../data/navigation.json';
import usersData from '../../data/users.json';
import addressesData from '../../data/addresses.json';
import ordersData from '../../data/orders.json';
import couponsData from '../../data/coupons.json';
import shippingData from '../../data/shipping.json';
import paymentMethodsData from '../../data/payment-methods.json';
import pagesData from '../../data/pages.json';
import settingsData from '../../data/site-settings.json';
import preferencesData from '../../data/preferences.json';
import accountNavigationData from '../../data/account-navigation.json';

export interface FixtureData {
  fixtures: FixtureSet;
  preferences: Preferences;
  accountNavigation: NavigationItem[];
}
export function loadFixtureData(): FixtureData {
  const fixtures: FixtureSet = {
    products: validateInput(z.array(schemas.productSchema), productsData),
    categories: validateInput(z.array(schemas.categorySchema), categoriesData),
    brands: validateInput(z.array(schemas.brandSchema), brandsData),
    images: validateInput(z.array(schemas.imageSchema), imagesData),
    reviews: validateInput(z.array(schemas.reviewSchema), reviewsData),
    banners: validateInput(z.array(schemas.bannerSchema), bannersData),
    navigation: validateInput(z.array(schemas.navigationSchema), navigationData),
    users: validateInput(z.array(schemas.userSchema), usersData),
    addresses: validateInput(z.array(schemas.addressSchema), addressesData),
    orders: validateInput(z.array(schemas.orderSchema), ordersData),
    coupons: validateInput(z.array(schemas.couponSchema), couponsData),
    shipping: validateInput(z.array(schemas.shippingSchema), shippingData),
    paymentMethods: validateInput(z.array(schemas.paymentMethodSchema), paymentMethodsData),
    pages: validateInput(z.array(schemas.contentPageSchema), pagesData),
    settings: validateInput(schemas.siteSettingsSchema, settingsData),
  };
  const errors = validateFixtureIntegrity(fixtures);
  if (errors.length)
    throw new RepositoryError('validation', 'The demo fixture relationships are invalid.');
  return {
    fixtures,
    preferences: validateInput(schemas.preferencesSchema, preferencesData),
    accountNavigation: validateInput(z.array(schemas.navigationSchema), accountNavigationData),
  };
}
