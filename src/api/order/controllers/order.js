'use strict';

/**
 * order controller
 */

const mercadoPago = require('mercadopago');
mercadoPago.configure({
  access_token: process.env.MERCADOPAGO_ACCESS_TOKEN
});

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::order.order', ({strapi}) => ({
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

    const newData = {
      data: {
        user: user.id,
        total: total,
        products: products.map(product => {
          return {
            productID: product.id,
            items: product.items.map(item => {
              return {
                number: item.number,
              }
            })
          }
        })
      }
    };
 
    try {
      const data = await mercadoPago.payment.create(payment_data);
      newData.data.qr_code = data.response.point_of_interaction.transaction_data.qr_code;
      newData.data.qr_code_base64 = data.response.point_of_interaction.transaction_data.qr_code_base64;
    } catch (error) {
      console.log(error);
    }

    ctx.request.body.data = newData.data;
    
    const response = await super.create(ctx);

    return response;
  },

  async find(ctx) {
    const { user } = ctx.state;
    const orders = await strapi.entityService.findMany(
      'api::order.order', {
      populate: '*', // populate all relations
      filters: {
        user: user.id,
      }
    })
    const sanitizedEntries = await this.sanitizeOutput(orders, ctx);

    return this.transformResponse(sanitizedEntries);
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