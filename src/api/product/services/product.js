'use strict';

/**
 * product service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::product.product', ({ strapi }) => ({
  async createItemsService(result) {
    const items = Array.from({ length: result.quantity }, (_, i) => ({ number: i + 1 }));

    await strapi.entityService.update('api::product.product', result.id, {
      data: {
        items: items,
      },
    });
  },
}));