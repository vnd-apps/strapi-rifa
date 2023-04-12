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
    const orderIDs = [];

    if (await checkExistsProductsNumbers(products)) {
      return ctx.badRequest('Product number already exists');
    }

    for (const product of products) {
      const order = await strapi.entityService.create('api::order.order', {
        data: {
          product: product.id,
          numbers: product.items,
          publishedAt: new Date().getTime(),
        },
      });
      orderIDs.push(order.id);
    }

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
          publishedAt: new Date().getTime(),
        },
      });

      for(const orderID of orderIDs) {
        await strapi.entityService.update('api::order.order', orderID, {
          data: {
            payment: entity.id,
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

const getTotal = async (products) => {
  let totalPrice = 0;
  for (const product of products) {
    const entry = await strapi.entityService.findOne('api::product.product', product.id);
    totalPrice += entry.price * product.items.length;
  }
  return totalPrice;
}

const checkExistsProductsNumbers = async (products) => {
  for(const product of products) {
    const orders = await strapi.entityService.findMany(
      'api::order.order', {
      populate: 'numbers.item,payment', // populate all relations
      filters: {
        product: {
          id: {
            $eq: product.id
          }
        },
        numbers: {
          number: {
            $in: product.items.map((item) => item.number)
          }
        },
        payment: {
          status: {
            $not: 'cancelled'
          },
        },
      },
    })

    if (orders.length > 0){
      return true;
    }
  }
  
  return false;
}
