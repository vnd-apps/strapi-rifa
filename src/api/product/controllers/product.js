'use strict';

/**
 * product controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::product.product', ({ strapi }) => ({
  async find(ctx) {
    const products = await strapi.entityService.findMany(
      'api::product.product', {
      populate: '*', // populate all relations
      filters: {
        status: 'Open'
      }
    })
    const orders = await strapi.entityService.findMany(
      'api::order.order', {
      populate: '*', // populate all relations
      filters: {
        $not: {
          status: 'cancelled',
        },
      }
    })

    const productItems = await getProductsWithStatus(orders, products);

    const sanitizedEntries = await this.sanitizeOutput(productItems, ctx);

    // 3
    return this.transformResponse(sanitizedEntries);

  }
}));

async function getProductsWithStatus(orders, products) {
  try {

    const productItems = products.map((product) => {
      const itemsWithStatus = product.items.map((item) => {
        const isItemReserved = orders.some(
          (order) =>
            order.products.some(
              (orderProduct) =>
                orderProduct.productID === product.id &&
                orderProduct.items.some((i) => i.number === item.number)
            )
        );
        const status = isItemReserved ? "unavailable" : "available";
        return { ...item, status };
      });
      return { ...product, items: itemsWithStatus };
    });

    return productItems;
  } catch (error) {
    console.error(error);
  }
}