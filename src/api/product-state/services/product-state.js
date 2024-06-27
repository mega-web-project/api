'use strict';

/**
 * product-state service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::product-state.product-state');
