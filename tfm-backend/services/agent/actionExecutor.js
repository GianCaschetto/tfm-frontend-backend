import { v4 as uuidv4 } from 'uuid';
import Product from '../../models/Product.js';
import Order from '../../models/Order.js';
import Category from '../../models/Category.js';
import Branch from '../../models/Branch.js';
import Settings from '../../models/Settings.js';
import User from '../../models/User.js';
import websocketService from '../websocketService.js';
import { predictDemand, predictRevenue } from './mlService.js';

async function resolveProduct(businessId, { productId, productName }) {
  if (productId) {
    return Product.findOne({ businessId, id: productId });
  }
  if (productName) {
    return Product.findOne({
      businessId,
      name: { $regex: productName, $options: 'i' }
    });
  }
  return null;
}

async function resolveCategory(businessId, { categoryId, categoryName }) {
  if (categoryId) {
    return Category.findOne({ businessId, id: categoryId });
  }
  if (categoryName) {
    return Category.findOne({
      businessId,
      name: { $regex: categoryName, $options: 'i' }
    });
  }
  return null;
}

async function resolveBranch(businessId, { branchId, branchName }) {
  if (branchId) {
    return Branch.findOne({ businessId, id: branchId });
  }
  if (branchName) {
    return Branch.findOne({
      businessId,
      name: { $regex: branchName, $options: 'i' }
    });
  }
  return null;
}

async function resolveOrder(businessId, { orderId, orderNumber }) {
  if (orderId) {
    return Order.findOne({ businessId, $or: [{ id: orderId }, { _id: orderId }] });
  }
  if (orderNumber) {
    return Order.findOne({ businessId, orderNumber });
  }
  return null;
}

function emitChange(businessId, event, data) {
  websocketService.emitToBusiness(businessId, event, {
    ...data,
    timestamp: new Date()
  });
}

// ────────────────────────────── PRODUCTS ──────────────────────────────

async function searchProducts(businessId, params) {
  const filter = { businessId };
  if (params.query) {
    filter.name = { $regex: params.query, $options: 'i' };
  }
  if (params.categoryId) {
    filter.categoryId = params.categoryId;
  }
  if (params.isActive !== undefined) {
    filter.isActive = params.isActive;
  }
  const limit = params.limit || 20;

  const products = await Product.find(filter).limit(limit).sort({ name: 1 });

  if (params.branchId) {
    return {
      products: products
        .filter(p => p.availability?.some(a => a.branchId === params.branchId && a.isAvailable))
        .map(p => ({ id: p.id, name: p.name, price: p.price, categoryId: p.categoryId, isActive: p.isActive })),
      total: products.length
    };
  }

  return {
    products: products.map(p => ({ id: p.id, name: p.name, price: p.price, categoryId: p.categoryId, isActive: p.isActive })),
    total: products.length
  };
}

async function getProductDetails(businessId, params) {
  const product = await resolveProduct(businessId, params);
  if (!product) return { error: 'Producto no encontrado' };
  const category = await Category.findOne({ businessId, id: product.categoryId });
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    categoryId: product.categoryId,
    categoryName: category?.name || 'Sin categoría',
    isActive: product.isActive,
    availability: product.availability,
    extras: product.extras,
    extraGroupIds: product.extraGroupIds,
    createdAt: product.createdAt
  };
}

async function createProduct(businessId, params) {
  let categoryId = params.categoryId;
  if (!categoryId && params.categoryName) {
    const cat = await resolveCategory(businessId, { categoryName: params.categoryName });
    if (cat) categoryId = cat.id;
    else return { error: `Categoría "${params.categoryName}" no encontrada` };
  }
  if (!categoryId) return { error: 'Se requiere una categoría para crear el producto' };

  const newProduct = new Product({
    businessId,
    id: uuidv4(),
    name: params.name,
    description: params.description || '',
    price: params.price,
    categoryId,
    isActive: true
  });
  await newProduct.save();

  await Category.findOneAndUpdate(
    { businessId, id: categoryId },
    { $inc: { productCount: 1 } }
  );

  emitChange(businessId, 'product-updated', { product: newProduct, operation: 'insert' });
  return { id: newProduct.id, name: newProduct.name, price: newProduct.price, categoryId };
}

async function updateProduct(businessId, params) {
  const product = await resolveProduct(businessId, params);
  if (!product) return { error: 'Producto no encontrado' };

  const updates = {};
  if (params.newName) updates.name = params.newName;
  if (params.newDescription) updates.description = params.newDescription;
  if (params.newCategoryId) updates.categoryId = params.newCategoryId;

  Object.assign(product, updates);
  await product.save();

  emitChange(businessId, 'product-updated', { product, operation: 'update' });
  return { id: product.id, name: product.name, updated: Object.keys(updates) };
}

async function updateProductPrice(businessId, params) {
  const product = await resolveProduct(businessId, params);
  if (!product) return { error: 'Producto no encontrado' };

  const oldPrice = product.price;
  product.price = params.newPrice;
  await product.save();

  emitChange(businessId, 'product-updated', { product, operation: 'update' });
  return { id: product.id, name: product.name, oldPrice, newPrice: params.newPrice };
}

async function updateProductAvailability(businessId, params) {
  const product = await resolveProduct(businessId, params);
  if (!product) return { error: 'Producto no encontrado' };

  const branch = await resolveBranch(businessId, params);
  if (!branch) return { error: 'Sucursal no encontrada' };

  const existing = product.availability.find(a => a.branchId === branch.id);
  if (existing) {
    existing.isAvailable = params.isAvailable;
  } else {
    product.availability.push({ branchId: branch.id, isAvailable: params.isAvailable });
  }
  await product.save();

  emitChange(businessId, 'product-updated', { product, operation: 'update' });
  return {
    id: product.id,
    name: product.name,
    branch: branch.name,
    isAvailable: params.isAvailable
  };
}

async function deleteProduct(businessId, params) {
  const product = await resolveProduct(businessId, params);
  if (!product) return { error: 'Producto no encontrado' };

  const categoryId = product.categoryId;
  const productName = product.name;
  await Product.deleteOne({ _id: product._id });

  await Category.findOneAndUpdate(
    { businessId, id: categoryId },
    { $inc: { productCount: -1 } }
  );

  emitChange(businessId, 'product-updated', { product: { id: product.id }, operation: 'delete' });
  return { deleted: true, name: productName, categoryId };
}

async function bulkUpdatePrices(businessId, params) {
  const filter = { businessId };
  if (params.categoryId) {
    filter.categoryId = params.categoryId;
  } else if (params.categoryName) {
    const cat = await resolveCategory(businessId, { categoryName: params.categoryName });
    if (!cat) return { error: `Categoría "${params.categoryName}" no encontrada` };
    filter.categoryId = cat.id;
  }
  if (params.productIds?.length) {
    filter.id = { $in: params.productIds };
  }

  const products = await Product.find(filter);
  if (!products.length) return { error: 'No se encontraron productos con los filtros dados' };

  const pct = params.percentageChange / 100;
  const updates = [];
  for (const product of products) {
    const oldPrice = product.price;
    product.price = Math.round(product.price * (1 + pct) * 100) / 100;
    await product.save();
    updates.push({ id: product.id, name: product.name, oldPrice, newPrice: product.price });
  }

  emitChange(businessId, 'document-change', { collection: 'products', operation: 'update' });
  return { updatedCount: updates.length, percentageChange: params.percentageChange, updates };
}

// ────────────────────────────── CATEGORIES ──────────────────────────────

async function listCategories(businessId, params) {
  const filter = { businessId };
  if (!params.includeInactive) filter.isActive = true;

  const categories = await Category.find(filter).sort({ order: 1 });
  return {
    categories: categories.map(c => ({
      id: c.id, name: c.name, description: c.description,
      productCount: c.productCount, order: c.order, isActive: c.isActive, color: c.color
    })),
    total: categories.length
  };
}

async function createCategory(businessId, params) {
  const maxOrder = await Category.findOne({ businessId }).sort({ order: -1 });
  const newCategory = new Category({
    businessId,
    id: uuidv4(),
    name: params.name,
    description: params.description || '',
    color: params.color || null,
    icon: params.icon || null,
    order: (maxOrder?.order || 0) + 1,
    isActive: true
  });
  await newCategory.save();
  emitChange(businessId, 'document-change', { collection: 'categories', operation: 'insert' });
  return { id: newCategory.id, name: newCategory.name, order: newCategory.order };
}

async function updateCategory(businessId, params) {
  const category = await resolveCategory(businessId, params);
  if (!category) return { error: 'Categoría no encontrada' };

  if (params.newName) category.name = params.newName;
  if (params.newDescription) category.description = params.newDescription;
  if (params.newColor) category.color = params.newColor;
  if (params.isActive !== undefined) category.isActive = params.isActive;
  await category.save();

  emitChange(businessId, 'document-change', { collection: 'categories', operation: 'update' });
  return { id: category.id, name: category.name, isActive: category.isActive };
}

async function deleteCategory(businessId, params) {
  const category = await resolveCategory(businessId, params);
  if (!category) return { error: 'Categoría no encontrada' };

  const productCount = await Product.countDocuments({ businessId, categoryId: category.id });
  const categoryName = category.name;
  await Category.deleteOne({ _id: category._id });

  emitChange(businessId, 'document-change', { collection: 'categories', operation: 'delete' });
  return { deleted: true, name: categoryName, productsAffected: productCount };
}

// ────────────────────────────── BRANCHES ──────────────────────────────

async function listBranches(businessId, params) {
  const filter = { businessId };
  if (!params.includeInactive) filter.isActive = true;

  const branches = await Branch.find(filter);
  return {
    branches: branches.map(b => ({
      id: b.id, name: b.name, address: b.address,
      isActive: b.isActive, zones: b.zones?.length || 0,
      schedule: b.schedule
    })),
    total: branches.length
  };
}

async function createBranch(businessId, params) {
  const newBranch = new Branch({
    businessId,
    id: uuidv4(),
    name: params.name,
    address: params.address,
    isActive: true,
    schedule: [],
    zones: []
  });
  await newBranch.save();
  emitChange(businessId, 'document-change', { collection: 'branches', operation: 'insert' });
  return { id: newBranch.id, name: newBranch.name, address: newBranch.address };
}

async function updateBranch(businessId, params) {
  const branch = await resolveBranch(businessId, params);
  if (!branch) return { error: 'Sucursal no encontrada' };

  if (params.newName) branch.name = params.newName;
  if (params.newAddress) branch.address = params.newAddress;
  await branch.save();

  emitChange(businessId, 'document-change', { collection: 'branches', operation: 'update' });
  return { id: branch.id, name: branch.name, address: branch.address };
}

async function updateBranchSchedule(businessId, params) {
  const branch = await resolveBranch(businessId, params);
  if (!branch) return { error: 'Sucursal no encontrada' };

  if (params.schedule) {
    branch.schedule = params.schedule.map(s => ({
      day: s.day,
      openTime: s.openTime,
      closeTime: s.closeTime,
      isClosed: s.isClosed || false,
      isOpen: !s.isClosed
    }));
    await branch.save();
  }

  emitChange(businessId, 'document-change', { collection: 'branches', operation: 'update' });
  return { id: branch.id, name: branch.name, schedule: branch.schedule };
}

async function toggleBranchActive(businessId, params) {
  const branch = await resolveBranch(businessId, params);
  if (!branch) return { error: 'Sucursal no encontrada' };

  branch.isActive = params.isActive;
  await branch.save();

  emitChange(businessId, 'document-change', { collection: 'branches', operation: 'update' });
  return { id: branch.id, name: branch.name, isActive: branch.isActive };
}

async function deleteBranch(businessId, params) {
  const branch = await resolveBranch(businessId, params);
  if (!branch) return { error: 'Sucursal no encontrada' };

  const branchName = branch.name;
  await Branch.deleteOne({ _id: branch._id });

  emitChange(businessId, 'document-change', { collection: 'branches', operation: 'delete' });
  return { deleted: true, name: branchName };
}

// ────────────────────────────── ORDERS ──────────────────────────────

async function searchOrders(businessId, params) {
  const filter = { businessId };
  if (params.status) filter.status = params.status;
  if (params.branchId) filter['branch.id'] = params.branchId;
  if (params.paymentStatus) filter.paymentStatus = params.paymentStatus;
  if (params.fromDate || params.toDate) {
    filter.createdAt = {};
    if (params.fromDate) filter.createdAt.$gte = new Date(params.fromDate);
    if (params.toDate) filter.createdAt.$lte = new Date(params.toDate + 'T23:59:59.999Z');
  }

  const limit = params.limit || 20;
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(limit);

  return {
    orders: orders.map(o => ({
      orderNumber: o.orderNumber,
      status: o.status,
      total: o.total,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      itemCount: o.items?.length || 0,
      customerName: o.userInfo?.name,
      branch: o.branch?.name,
      createdAt: o.createdAt
    })),
    total: orders.length
  };
}

async function getOrderDetails(businessId, params) {
  const order = await resolveOrder(businessId, params);
  if (!order) return { error: 'Pedido no encontrado' };

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    customer: order.userInfo,
    branch: { name: order.branch?.name, address: order.branch?.address },
    items: order.items?.map(i => ({
      name: i.product?.name,
      quantity: i.quantity,
      price: i.product?.price,
      extras: i.selectedExtras?.map(e => e.name)
    })),
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt
  };
}

async function updateOrderStatus(businessId, params) {
  const order = await resolveOrder(businessId, params);
  if (!order) return { error: 'Pedido no encontrado' };

  const validTransitions = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: []
  };

  const allowed = validTransitions[order.status] || [];
  if (!allowed.includes(params.newStatus)) {
    return { error: `No se puede cambiar de "${order.status}" a "${params.newStatus}". Transiciones válidas: ${allowed.join(', ') || 'ninguna'}` };
  }

  const oldStatus = order.status;
  order.status = params.newStatus;
  await order.save();

  emitChange(businessId, 'document-change', { collection: 'orders', operation: 'update' });
  websocketService.emitToOrder(order._id.toString(), 'order-update', { order, operation: 'update' });

  return { orderNumber: order.orderNumber, oldStatus, newStatus: params.newStatus };
}

async function cancelOrder(businessId, params) {
  const order = await resolveOrder(businessId, params);
  if (!order) return { error: 'Pedido no encontrado' };

  if (order.status === 'delivered') {
    return { error: 'No se puede cancelar un pedido ya entregado' };
  }
  if (order.status === 'cancelled') {
    return { error: 'El pedido ya está cancelado' };
  }

  const oldStatus = order.status;
  order.status = 'cancelled';
  await order.save();

  emitChange(businessId, 'document-change', { collection: 'orders', operation: 'update' });
  websocketService.emitToOrder(order._id.toString(), 'order-update', { order, operation: 'update' });

  return {
    orderNumber: order.orderNumber,
    oldStatus,
    total: order.total,
    customerName: order.userInfo?.name,
    reason: params.reason || 'Sin motivo especificado'
  };
}

async function getOrderStats(businessId, params) {
  const now = new Date();
  let fromDate;
  switch (params.period) {
    case 'today': fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
    case 'week': fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
    case 'month': fromDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'year': fromDate = new Date(now.getFullYear(), 0, 1); break;
    default: fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const filter = { businessId, createdAt: { $gte: fromDate } };
  if (params.branchId) filter['branch.id'] = params.branchId;

  const orders = await Order.find(filter);
  const statusCounts = {};
  let totalRevenue = 0;
  let paidCount = 0;
  const productCounts = {};

  for (const order of orders) {
    statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    if (order.status !== 'cancelled') {
      totalRevenue += order.total || 0;
    }
    if (order.paymentStatus === 'paid') paidCount++;
    for (const item of (order.items || [])) {
      const name = item.product?.name;
      if (name) {
        productCounts[name] = (productCounts[name] || 0) + (item.quantity || 1);
      }
    }
  }

  const topProducts = Object.entries(productCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    period: params.period || 'week',
    totalOrders: orders.length,
    statusBreakdown: statusCounts,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    averageOrderValue: orders.length ? Math.round((totalRevenue / orders.length) * 100) / 100 : 0,
    paidOrders: paidCount,
    topProducts
  };
}

// ────────────────────────────── SETTINGS ──────────────────────────────

async function getSettings(businessId, params) {
  const settings = await Settings.findOne({ businessId });
  if (!settings) return { error: 'Configuración no encontrada' };

  const section = params.section || 'all';
  if (section === 'all') {
    return {
      general: settings.general,
      payment: settings.payment,
      whatsapp: settings.whatsapp,
      appearance: settings.appearance,
      notifications: settings.notifications
    };
  }
  return { [section]: settings[section] || 'Sección no encontrada' };
}

async function updateGeneralSettings(businessId, params) {
  const settings = await Settings.findOne({ businessId });
  if (!settings) return { error: 'Configuración no encontrada' };

  const updates = {};
  if (params.restaurantName) { settings.general.restaurantName = params.restaurantName; updates.restaurantName = params.restaurantName; }
  if (params.phone) { settings.general.phone = params.phone; updates.phone = params.phone; }
  if (params.email) { settings.general.email = params.email; updates.email = params.email; }
  if (params.address) { settings.general.address = params.address; updates.address = params.address; }
  if (params.currency) { settings.general.currency = params.currency; updates.currency = params.currency; }
  await settings.save();

  emitChange(businessId, 'settings-updated', { settings, operation: 'update' });
  return { updated: Object.keys(updates), values: updates };
}

async function updatePaymentSettings(businessId, params) {
  const settings = await Settings.findOne({ businessId });
  if (!settings) return { error: 'Configuración no encontrada' };

  const updates = {};
  if (params.paymentMethods) { settings.payment.paymentMethods = params.paymentMethods; updates.paymentMethods = params.paymentMethods; }
  if (params.enableVenezuelanBs !== undefined) { settings.payment.enableVenezuelanBs = params.enableVenezuelanBs; updates.enableVenezuelanBs = params.enableVenezuelanBs; }
  if (params.customRate !== undefined) { settings.payment.customRate = params.customRate; updates.customRate = params.customRate; }
  if (params.pagoMovil !== undefined) { settings.payment.pagoMovil = params.pagoMovil; updates.pagoMovil = params.pagoMovil; }
  if (params.preferredRateSource) { settings.payment.preferredRateSource = params.preferredRateSource; updates.preferredRateSource = params.preferredRateSource; }
  await settings.save();

  emitChange(businessId, 'settings-updated', { settings, operation: 'update' });
  return { updated: Object.keys(updates), values: updates };
}

// ────────────────────────────── ML PREDICTIONS ──────────────────────────────

async function predictProductDemand(businessId, params) {
  const product = await resolveProduct(businessId, params);
  const productName = product?.name || params.productName || 'Producto desconocido';

  try {
    const result = await predictDemand({
      productName,
      productId: product?.id || params.productId,
      date: params.date,
      daysAhead: params.daysAhead || 7
    });
    return result;
  } catch (err) {
    return {
      productName,
      note: 'El servicio de predicción ML no está disponible actualmente. Asegúrate de que Python y las dependencias estén instalados.',
      error: err.message
    };
  }
}

async function predictRevenueHandler(businessId, params) {
  try {
    const result = await predictRevenue({
      date: params.date,
      daysAhead: params.daysAhead || 7
    });
    return result;
  } catch (err) {
    return {
      note: 'El servicio de predicción ML no está disponible actualmente. Asegúrate de que Python y las dependencias estén instalados.',
      error: err.message
    };
  }
}

async function getTopProducts(businessId, params) {
  const now = new Date();
  let fromDate;
  switch (params.period) {
    case 'week': fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
    case 'month': fromDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'quarter': fromDate = new Date(now.getFullYear(), now.getMonth() - 3, 1); break;
    case 'year': fromDate = new Date(now.getFullYear(), 0, 1); break;
    default: fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const filter = { businessId, createdAt: { $gte: fromDate }, status: { $ne: 'cancelled' } };
  if (params.branchId) filter['branch.id'] = params.branchId;

  const orders = await Order.find(filter);
  const productStats = {};

  for (const order of orders) {
    for (const item of (order.items || [])) {
      const name = item.product?.name;
      if (!name) continue;
      if (!productStats[name]) {
        productStats[name] = { name, totalQuantity: 0, totalRevenue: 0, orderCount: 0 };
      }
      productStats[name].totalQuantity += item.quantity || 1;
      productStats[name].totalRevenue += (item.product?.price || 0) * (item.quantity || 1);
      productStats[name].orderCount++;
    }
  }

  const limit = params.limit || 10;
  const sorted = Object.values(productStats)
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, limit)
    .map((p, i) => ({ rank: i + 1, ...p, totalRevenue: Math.round(p.totalRevenue * 100) / 100 }));

  return { period: params.period || 'month', topProducts: sorted, totalOrdersAnalyzed: orders.length };
}

// ────────────────────────────── HANDLER MAP ──────────────────────────────

const handlers = {
  search_products: searchProducts,
  get_product_details: getProductDetails,
  create_product: createProduct,
  update_product: updateProduct,
  update_product_price: updateProductPrice,
  update_product_availability: updateProductAvailability,
  delete_product: deleteProduct,
  bulk_update_prices: bulkUpdatePrices,
  list_categories: listCategories,
  create_category: createCategory,
  update_category: updateCategory,
  delete_category: deleteCategory,
  list_branches: listBranches,
  create_branch: createBranch,
  update_branch: updateBranch,
  update_branch_schedule: updateBranchSchedule,
  toggle_branch_active: toggleBranchActive,
  delete_branch: deleteBranch,
  search_orders: searchOrders,
  get_order_details: getOrderDetails,
  update_order_status: updateOrderStatus,
  cancel_order: cancelOrder,
  get_order_stats: getOrderStats,
  get_settings: getSettings,
  update_general_settings: updateGeneralSettings,
  update_payment_settings: updatePaymentSettings,
  predict_product_demand: predictProductDemand,
  predict_revenue: predictRevenueHandler,
  get_top_products: getTopProducts,
};

export async function executeAction(actionName, businessId, params) {
  const handler = handlers[actionName];
  if (!handler) {
    return { error: `Acción desconocida: ${actionName}` };
  }
  return handler(businessId, params || {});
}

export async function buildConfirmationDescription(actionName, businessId, params) {
  switch (actionName) {
    case 'delete_product': {
      const product = await resolveProduct(businessId, params);
      if (product) {
        const cat = await Category.findOne({ businessId, id: product.categoryId });
        return `Eliminar el producto "${product.name}" (precio: $${product.price}, categoría: ${cat?.name || 'N/A'}). Esta acción es irreversible.`;
      }
      return `Eliminar producto. Esta acción es irreversible.`;
    }
    case 'delete_category': {
      const cat = await resolveCategory(businessId, params);
      if (cat) {
        const count = await Product.countDocuments({ businessId, categoryId: cat.id });
        return `Eliminar la categoría "${cat.name}" que tiene ${count} producto(s). Los productos quedarán sin categoría.`;
      }
      return `Eliminar categoría. Los productos asociados quedarán sin categoría.`;
    }
    case 'delete_branch': {
      const branch = await resolveBranch(businessId, params);
      return branch
        ? `Eliminar la sucursal "${branch.name}" (${branch.address}). Los productos perderán disponibilidad en esta sucursal.`
        : `Eliminar sucursal. Esta acción es irreversible.`;
    }
    case 'cancel_order': {
      const order = await resolveOrder(businessId, params);
      return order
        ? `Cancelar el pedido #${order.orderNumber} (total: $${order.total}, cliente: ${order.userInfo?.name || 'N/A'}, estado actual: ${order.status}).`
        : `Cancelar pedido. Esta acción es irreversible.`;
    }
    case 'bulk_update_prices': {
      let scope = 'todos los productos filtrados';
      if (params.categoryName) scope = `todos los productos de la categoría "${params.categoryName}"`;
      else if (params.categoryId) scope = `todos los productos de la categoría ${params.categoryId}`;
      if (params.productIds?.length) scope = `${params.productIds.length} productos específicos`;
      return `Cambiar precios de ${scope} en ${params.percentageChange > 0 ? '+' : ''}${params.percentageChange}%.`;
    }
    case 'toggle_branch_active': {
      const branch = await resolveBranch(businessId, params);
      const action = params.isActive ? 'Activar' : 'Desactivar';
      return branch
        ? `${action} la sucursal "${branch.name}". ${!params.isActive ? 'La sucursal dejará de recibir pedidos.' : ''}`
        : `${action} sucursal.`;
    }
    case 'update_payment_settings':
      return `Cambiar configuración de pagos: ${Object.keys(params).filter(k => params[k] !== undefined).join(', ')}. Esto afecta todos los métodos de cobro del negocio.`;
    default:
      return `Ejecutar acción: ${actionName}`;
  }
}
