'use strict';

/**
 * payment controller
 */

const mercadoPago = require('mercadopago');
mercadoPago.configure({
  access_token: process.env.MERCADOPAGO_ACCESS_TOKEN
});

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::payment.payment', ({ strapi }) => ({
  async create(ctx) {
    const { user } = ctx.state;
    const { products } = ctx.request.body;


    const total = await getTotal(products);

    const payment_data = {
      transaction_amount: total,
      description: "description",
      payment_method_id: 'pix',
      payer: {
        email: user.email,
        first_name: "user.fullName",
        last_name: "user.fullName",
        identification: {
          type: 'E-MAIL',
          number: user.email
        },
      }
    };

    try {
      const {response} = await mercadoPago.payment.create(payment_data);
      const entity = await strapi.entityService.create('api::payment.payment', {
        data: {
          qr_code: response.point_of_interaction.transaction_data.qr_code,
          qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64,
          total: total,
          user: user.id,
        },
      });
      for (const product of products) {
        await strapi.entityService.create('api::order.order', {
          data: {
            product: product.id,
            numbers: product.items,
            payment: entity.id
          },
        });
      }
      return await strapi.entityService.findOne('api::payment.payment', entity.id, {
        populate: '*',
      });

    } catch (error) {
      return error
    }    
  }
}));

async function getTotal(products) {
  let totalPrice = 0;
  for (const product of products) {
    const entry = await strapi.entityService.findOne('api::product.product', product.id);
    totalPrice += entry.price * product.items.length;
  }
  return totalPrice;
}