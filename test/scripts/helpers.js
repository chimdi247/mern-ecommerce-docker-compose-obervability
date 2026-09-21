// Shared helpers imported by every scenario script in test/scripts/.
//
// NOTE on scope: this app's authentication is entirely delegated to
// Clerk (see docker/README.md), which requires a full browser-based
// sign-in flow (or Clerk's Backend API with a real secret key) to get
// a session token -- there's no username/password endpoint a script
// can call directly. So these scripts only exercise the app's public,
// unauthenticated endpoints (product/category browsing) -- the
// realistic read-heavy traffic most of a storefront's load actually
// is. They deliberately don't attempt checkout/cart/admin flows.
import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Exercises the storefront's public browsing endpoints -- home page
// data, category list, and product list -- then, if the catalog has
// at least one product (it won't on a totally fresh install until an
// admin adds one -- see docker/README.md), a product detail lookup
// too.
export function browseStorefront() {
  const responses = http.batch([
    ['GET', `${BASE_URL}/health`, null, { tags: { name: 'GET /health' } }],
    ['GET', `${BASE_URL}/customer/home`, null, { tags: { name: 'GET /customer/home' } }],
    ['GET', `${BASE_URL}/customer/categories`, null, { tags: { name: 'GET /customer/categories' } }],
    ['GET', `${BASE_URL}/customer/products`, null, { tags: { name: 'GET /customer/products' } }],
  ]);

  responses.forEach((res) => {
    check(res, { 'status is 200': (r) => r.status === 200 });
  });

  const productsRes = responses[3];
  try {
    const body = JSON.parse(productsRes.body);
    const products = body?.data?.products || body?.data || [];
    if (Array.isArray(products) && products.length > 0) {
      const sample = products[Math.floor(Math.random() * products.length)];
      const productId = sample?._id || sample?.id;
      if (productId) {
        const detailRes = http.get(`${BASE_URL}/customer/products/${productId}`, {
          tags: { name: 'GET /customer/products/:id' },
        });
        check(detailRes, { 'product detail status is 200': (r) => r.status === 200 });
      }
    }
  } catch (e) {
    // Response shape didn't match what we expected -- not fatal, just
    // skip the product-detail follow-up request for this iteration.
  }

  return responses;
}
