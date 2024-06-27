// 'use strict';

// /**
//  * order controller
//  */

// const { createCoreController } = require('@strapi/strapi').factories;

// module.exports = createCoreController('api::order.order');
// // 

'use strict';

const paystack = require("paystack")(process.env.PAYSTACK_KEY);

const generateUniqueReference = () => {
    const prefix = 'ORDER'; // Prefix for the reference
    const timestamp = Date.now(); // Current timestamp
    const randomString = Math.random().toString(36).substring(7); // Random string

    // Concatenate the prefix, timestamp, and random string to generate the reference
    return `${prefix}_${timestamp}_${randomString}`;
}

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::order.order', ({ strapi }) => ({
    async create(ctx) {
        const { products } = ctx.request.body;
        const user = ctx.state.user;

        try {
            if (!products || !Array.isArray(products) || products.length === 0) {
                ctx.throw(400, 'Invalid or empty products array');
            }

            if (!user) {
                ctx.throw(400, 'User information is missing');
            }

            const lineItems = await Promise.all(
                products.map(async (product) => {
                    const item = await strapi
                        .service('api::product.product')
                        .findOne(product.id);

                    if (!item) {
                        ctx.throw(404, `Product with ID ${product.id} not found`);
                    }

                    return {
                        price_data: {
                            currency: "GH",
                            product_data: {
                                name: item.title,
                            },
                            unit_amount: item.price * 100,
                        },
                        quantity: product.quantity,
                    };
                })
            );

            const amount = lineItems.reduce((total, item) => total + item.price_data.unit_amount * item.quantity, 0);

            console.log("Initializing Paystack Transaction with amount:", amount);

            const paystackOrder = await paystack.transaction.initialize({
                amount,
                email: user.email,
                reference: generateUniqueReference(), // Generate a unique reference for the transaction
                name: "Order Payment", // Provide a name for the transaction
                metadata: {
                    custom_fields: [
                        {
                            display_name: "Ordered products",
                            variable_name: "products",
                            value: JSON.stringify(products)
                        }
                    ]
                }
            });

            console.log("Paystack Order:", paystackOrder);

            const newOrder = await strapi.service("api::order.order").create({
                data: {
                    email: user.email,
                    user: [{
                        fullname: user.fullname,
                        phone: user.phone,
                        region: user.region,
                        town: user.town,
                        gender: user.gender
                    }],
                    user_id: user.id, // Add the user ID here
                    products,
                    paystackId: paystackOrder.data.reference, // Assuming Paystack's reference is unique and can be used as the paystackId
                    status: "pending" // Initial status
                }
            });

            console.log("New Order:", newOrder);

            // Respond with success message or data
            ctx.send({
                message: "Order created successfully",
                order: newOrder
            });
        } catch (error) {
            console.error('Error creating order:', error);
            ctx.throw(error.status || 500, error.message || 'Internal Server Error');
        }
    },

    async find(ctx) {
        try {
            const orders = await strapi.service('api::order.order').find({
                populate: {
                    products: true,
                },
            });

            ctx.send(orders);
        } catch (error) {
            console.error('Error fetching orders:', error);
            ctx.throw(error.status || 500, error.message || 'Internal Server Error');
        }
    },


    async findOneByUserId(ctx) {
        try {
          const { userId } = ctx.params;
          const order = await strapi.db.query('api::order.order').findMany({ where: { user_id: userId } });
          if (!order) {
            return ctx.throw(404, `Order for user ID ${userId} not found`);
          }
          return order;
        } catch (error) {
          console.error(error);
          return ctx.throw(500, 'Internal Server Error');
        }
      }

}));
