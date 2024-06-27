// api/order/routes/order.config.js
module.exports = {
    routes: [
      {
        method: 'GET',
        path: '/orders/:userId',
        handler: 'order.findOneByUserId',
        config: {
          policies: [],
          auth: false,
        },
      },
    ],
  }