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

    if (await checkExistsProductsNumbers(products)) {
      return ctx.badRequest('Product number already exists');
    }

    const orderIDs = await createOrders(strapi, products);

    const total = await getTotal(products);

    try {
      const {response} = await createMercadoPagoPix(total, user)
      const payment = await createPayment(strapi, user.id, response, total)

      for(const orderID of orderIDs) {
        await updateOrderPayment(strapi, orderID, payment.id)
      }
      return await getPayment(payment.id);

    } catch (error) {
      return error
    }    
  }
}));

// Methods

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

const createOrders = async (strapi, products) => {
  const orderIDs = [];
  for (const product of products) {
    const order = await strapi.entityService.create('api::order.order', {
      data: {
        product: product.id,
        numbers: product.items,
      },
    });
    orderIDs.push(order.id);
  }
  return orderIDs;
};

const createPayment = async (strapi, userID, response, total) => {
  return strapi.entityService.create('api::payment.payment', {
    data: {
      qr_code: response.point_of_interaction.transaction_data.qr_code,
      qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64,
      total: total,
      user: userID,
      publishedAt: new Date().getTime(),
    },
  })
};

const updateOrderPayment = async (strapi, orderID, paymentID) => {
  return strapi.entityService.update('api::order.order', orderID, {
    data: {
      payment: paymentID,
      publishedAt: new Date().getTime(),
    },
  });
}

const getPayment = async (paymentID) => {
  return strapi.entityService.findOne('api::payment.payment', paymentID, {
    populate: '*',
  });
}

const createMercadoPagoPix = async (total, user) => {
  return await mercadoPago.payment.create({
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
  });
}