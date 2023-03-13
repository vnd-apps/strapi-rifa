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

    const sanitizedEntries = await this.sanitizeOutput(products, ctx);

    // 3
    return this.transformResponse(sanitizedEntries);

  },
  async findOne(ctx) {
    const product = await strapi.entityService.findOne(
      'api::product.product', ctx.params.id, { // populate all relations
      populate: '*',
    }
    )
    const orders = await strapi.entityService.findMany(
      'api::order.order', {
      populate: '*', // populate all relations
      filters: {
        $not: {
          status: 'cancelled',
        },
      }
    })

    const productItems = await getProductsWithStatus(orders, product);

    const sanitizedEntries = await this.sanitizeOutput(productItems, ctx);

    // 3
    return this.transformResponse(sanitizedEntries);

  }
}));

async function getProductsWithStatus(orders, product) {
  try {

    const productItems = product.items.map((item) => {
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
    return { ...product, items: productItems };
  } catch (error) {
    console.error(error);
  }
}