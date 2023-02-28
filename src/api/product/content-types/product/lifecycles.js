module.exports = {
  afterCreate(event) {
    const { result } = event;
    strapi.service('api::product.product').createItemsService(result);
  },
};