import { Router } from 'express';
import { validate as uuidValidate, v4 as uuidv4 } from 'uuid';
import Order from './models/Order.js';
import Category from './models/Category.js';
import websocketService from './services/websocketService.js';

// Simple in-memory cache for analytics data
const analyticsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper function to generate cache key
const getCacheKey = (business, timeRange, branchId, dateFrom, dateTo) => {
    return `analytics_${business}_${timeRange}_${branchId}_${dateFrom || 'null'}_${dateTo || 'null'}`;
};

// Helper function to check if cache is valid
const isCacheValid = (cachedData) => {
    return cachedData && (Date.now() - cachedData.timestamp) < CACHE_TTL;
};

// Helper function to clear cache for a specific business
const clearAnalyticsCache = (business) => {
    const keysToDelete = [];
    for (const key of analyticsCache.keys()) {
        if (key.startsWith(`analytics_${business}_`)) {
            keysToDelete.push(key);
        }
    }
    keysToDelete.forEach(key => analyticsCache.delete(key));
};

const router = Router();

// GET /get-orders?business=businessName&page=1&limit=10&status=pending&branchId=123&search=term&dateFrom=2024-01-01&dateTo=2024-12-31&sortBy=createdAt&sortOrder=desc
router.get("/get-orders", async (req, res) => {
    try {
        const business = req.query.business;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        const branchId = req.query.branchId;
        const search = req.query.search;
        const dateFrom = req.query.dateFrom;
        const dateTo = req.query.dateTo;
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
      
        if (!business) {
            return res.status(400).json({ error: "Faltan datos (business)" });
        }

        // Construir filtros
        const filters = { businessId: business };

        // Filtro por estado
        if (status && status !== 'all') {
            filters.status = status;
        }

        // Filtro por sucursal
        if (branchId && branchId !== 'all') {
            filters['branch.id'] = branchId;
        }

        // Filtro por rango de fechas
        if (dateFrom || dateTo) {
            filters.createdAt = {};
            if (dateFrom) {
                filters.createdAt.$gte = new Date(dateFrom);
            }
            if (dateTo) {
                const endDate = new Date(dateTo);
                endDate.setHours(23, 59, 59, 999);
                filters.createdAt.$lte = endDate;
            }
        }

        // Filtro de búsqueda
        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), 'i');
            filters.$or = [
                { orderNumber: { $regex: searchRegex } },
                { 'userInfo.name': { $regex: searchRegex } },
                { 'userInfo.phone': { $regex: searchRegex } },
                { paymentMethod: { $regex: searchRegex } },
                { status: { $regex: searchRegex } }
            ];
        }

        // Calcular skip para paginación
        const skip = (page - 1) * limit;

        // Construir objeto de ordenamiento
        const sort = { [sortBy]: sortOrder };

        // Ejecutar consulta con paginación
        const [orders, totalCount] = await Promise.all([
            Order.find(filters)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(), // Usar lean() para mejor performance
            Order.countDocuments(filters)
        ]);

        // Calcular información de paginación
        const totalPages = Math.ceil(totalCount / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        res.status(200).json({ 
            orders,
            pagination: {
                currentPage: page,
                totalPages,
                totalCount,
                limit,
                hasNextPage,
                hasPrevPage
            }
        });
    } catch (err) {
        console.error("Error al consultar pedidos:", err);
        res.status(500).json({ error: "Error al consultar pedidos" });
    }
});

//Get order by id
router.get("/get-order/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const business = req.query.business;
        
        const order = await Order.findOne({ 
            id: id, // Buscar por campo 'id' en lugar de '_id'
            businessId: business 
        });
        
        if (!order) {
            return res.status(404).json({ error: "Pedido no encontrado" });
        }
        
        res.status(200).json({ order });
    } catch (error) {
        console.error('Error getting order by id:', error);
        res.status(500).json({ error: "Error al obtener pedido" });
    }
});

// POST /save-order?business=businessName
router.post("/save-order", async (req, res) => {
    try {
        const guestId = req.cookies.guest_id;
        const business = req.query.business;
        const orderData = req.body;
        
    
        
        if (!business) {
            return res.status(400).json({ error: "Business parameter is required" });
        }
        
        // Validar campos requeridos
        if (!orderData.userInfo?.name || !orderData.userInfo?.phone) {
            return res.status(400).json({ 
                error: "User name and phone are required" 
            });
        }
        
        if (!orderData.items || orderData.items.length === 0) {
            return res.status(400).json({ 
                error: "Order must have at least one item" 
            });
        }
        
        const order = new Order({
            businessId: business,
            guestId: guestId || null,
            ...orderData
        });
      
        const savedOrder = await order.save();
        
 
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'order-added', savedOrder);
        websocketService.emitToOrder(savedOrder._id, 'order-created', savedOrder);
        
        // Clear analytics cache for this business
        clearAnalyticsCache(business);
        
        res.status(200).json({ 
            success: true, 
            pedidoId: savedOrder._id,
            order: savedOrder 
        });
    } catch (err) {
        console.error("Error al guardar pedido:", err);
        
        // Manejar errores específicos de Mongoose
        if (err.name === 'ValidationError') {
            const validationErrors = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ 
                error: "Validation error", 
                details: validationErrors 
            });
        }
        
        if (err.code === 11000) {
            return res.status(400).json({ 
                error: "Order number already exists" 
            });
        }
        
        res.status(500).json({ error: "Error al guardar pedido" });
    }
});
  
// Update order
router.put("/update-order/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const orderData = req.body;
        const business = req.query.business;
        
        // Remover campos que no deberían actualizarse
        const { createdAt, _id, ...updateData } = orderData;
        
        const updatedOrder = await Order.findOneAndUpdate(
            { id: id, businessId: business }, // Buscar por campo 'id'
            {
                ...updateData,
                updatedAt: new Date()
            },
            { new: true }
        );
        
        if (!updatedOrder) {
            return res.status(404).json({ error: "Pedido no encontrado" });
        }
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'order-updated', updatedOrder);
        websocketService.emitToOrder(id, 'order-modified', updatedOrder);
        
        // Clear analytics cache for this business
        clearAnalyticsCache(business);
        
        res.status(200).json({ 
            success: true, 
            order: updatedOrder 
        });
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: "Error al actualizar pedido" });
    }
});

// Update order status
router.put("/update-order-status/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const status = req.body.status;
        const business = req.query.business;
        
        const updatedOrder = await Order.findOneAndUpdate(
            { id: id, businessId: business }, // Buscar por campo 'id'
            {
                status,
                updatedAt: new Date()
            },
            { new: true }
        );
        
        if (!updatedOrder) {
            return res.status(404).json({ error: "Pedido no encontrado" });
        }
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'order-status-updated', updatedOrder);
        websocketService.emitToOrder(id, 'order-status-changed', updatedOrder);
        
        // Clear analytics cache for this business
        clearAnalyticsCache(business);
        
        res.status(200).json({ 
            success: true, 
            order: updatedOrder 
        });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: "Error al actualizar estado del pedido" });
    }
});

// Update order payment status
router.put("/update-order-payment-status/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const paymentStatus = req.body.paymentStatus;
        const business = req.query.business;
        
        const updatedOrder = await Order.findOneAndUpdate(
            { id: id, businessId: business },
            {
                paymentStatus,
                updatedAt: new Date()
            },
            { new: true }
        );
        
        if (!updatedOrder) {
            return res.status(404).json({ error: "Pedido no encontrado" });
        }
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'order-payment-updated', updatedOrder);
        websocketService.emitToOrder(id, 'order-payment-changed', updatedOrder);
        
        // Clear analytics cache for this business
        clearAnalyticsCache(business);
        
        res.status(200).json({ 
            success: true, 
            order: updatedOrder 
        });
    } catch (error) {
        console.error('Error updating order payment status:', error);
        res.status(500).json({ error: "Error al actualizar estado de pago" });
    }
});

// Delete order
router.delete("/delete-order/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const business = req.query.business;
        
        const deletedOrder = await Order.findOneAndDelete({ 
            id: id, // Buscar por campo 'id'
            businessId: business 
        });
        
        if (!deletedOrder) {
            return res.status(404).json({ error: "Pedido no encontrado" });
        }
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'order-deleted', { id });
        websocketService.emitToOrder(id, 'order-removed', { id });
        
        // Clear analytics cache for this business
        clearAnalyticsCache(business);
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ error: "Error al eliminar pedido" });
    }
});

//Get orders length
router.get("/get-orders-length", async (req, res) => {
    try {
        const business = req.query.business;
        const length = await Order.countDocuments({ businessId: business });

        // WebSocket update
        websocketService.emitToBusiness(business, 'orders-length-updated', { length });

        res.status(200).json({ length });
    } catch (error) {
        console.error('Error getting orders length:', error);
        res.status(500).json({ error: "Error al obtener longitud de pedidos" });
    }
});

// GET /get-orders-stats?business=businessName - Estadísticas rápidas para contadores
router.get("/get-orders-stats", async (req, res) => {
    try {
        const business = req.query.business;
        
        if (!business) {
            return res.status(400).json({ error: "Faltan datos (business)" });
        }

        const baseFilter = { businessId: business };

        // Obtener estadísticas por estado
        const stats = await Order.aggregate([
            { $match: baseFilter },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ]);

        // Obtener total de órdenes
        const totalCount = await Order.countDocuments(baseFilter);

        // Obtener órdenes nuevas (últimas 24 horas)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const newOrdersCount = await Order.countDocuments({
            ...baseFilter,
            createdAt: { $gte: yesterday }
        });

        // Convertir array de stats a objeto
        const statusCounts = stats.reduce((acc, stat) => {
            acc[stat._id] = stat.count;
            return acc;
        }, {});

        res.status(200).json({
            totalCount,
            newOrdersCount,
            statusCounts: {
                pending: statusCounts.pending || 0,
                confirmed: statusCounts.confirmed || 0,
                preparing: statusCounts.preparing || 0,
                ready: statusCounts.ready || 0,
                delivered: statusCounts.delivered || 0,
                cancelled: statusCounts.cancelled || 0
            }
        });
    } catch (error) {
        console.error('Error getting orders stats:', error);
        res.status(500).json({ error: "Error al obtener estadísticas de pedidos" });
    }
});

// GET /get-orders-by-status?business=businessName&status=pending&paymentStatus=paid
router.get("/get-orders-by-status", async (req, res) => {
    try {
        const business = req.query.business;
        const status = req.query.status;
        const paymentStatus = req.query.paymentStatus;
        
        if (!business) {
            return res.status(400).json({ error: "Faltan datos (business)" });
        }

        // Construir filtros
        const filters = { businessId: business };

        // Filtro por estado de orden
        if (status) {
            filters.status = status;
        }

        // Filtro por estado de pago
        if (paymentStatus) {
            filters.paymentStatus = paymentStatus;
        }

        // Obtener todas las órdenes que coincidan con los filtros
        const orders = await Order.find(filters)
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({ 
            orders,
            count: orders.length
        });
    } catch (error) {
        console.error('Error getting orders by status:', error);
        res.status(500).json({ error: "Error al obtener pedidos por estado" });
    }
});

// GET /get-orders-summary?business=businessName - Resumen de pedidos
router.get("/get-orders-summary", async (req, res) => {
    try {
        const business = req.query.business;
        
        if (!business) {
            return res.status(400).json({ error: "Faltan datos (business)" });
        }

        const baseFilter = { businessId: business };

        // Obtener total de pedidos (sin importar el status)
        const totalOrders = await Order.countDocuments(baseFilter);

        // Obtener pedidos pendientes
        const pendingOrders = await Order.find({
            ...baseFilter,
            status: 'pending'
        })
        .sort({ createdAt: -1 })
        .lean();

        res.status(200).json({
            totalOrders,
            pendingOrders: {
                count: pendingOrders.length,
                orders: pendingOrders
            }
        });
    } catch (error) {
        console.error('Error getting orders summary:', error);
        res.status(500).json({ error: "Error al obtener resumen de pedidos" });
    }
});

// GET /get-popular-products?business=businessName&limit=5 - Productos más populares
router.get("/get-popular-products", async (req, res) => {
    try {
        const business = req.query.business;
        const limit = parseInt(req.query.limit) || 5;
        
        if (!business) {
            return res.status(400).json({ error: "Faltan datos (business)" });
        }

        // Agregación para obtener productos más populares
        const popularProducts = await Order.aggregate([
            // Filtrar por business
            { $match: { businessId: business } },
            
            // Descomponer el array de items
            { $unwind: "$items" },
            
            // Agrupar por producto y sumar cantidades
            {
                $group: {
                    _id: {
                        productId: "$items.product.id",
                        productName: "$items.product.name",
                        productPrice: "$items.product.price"
                    },
                    totalQuantity: { $sum: "$items.quantity" },
                    totalOrders: { $sum: 1 },
                    totalRevenue: { 
                        $sum: { 
                            $multiply: ["$items.product.price", "$items.quantity"] 
                        } 
                    }
                }
            },
            
            // Ordenar por cantidad total (más popular)
            { $sort: { totalQuantity: -1 } },
            
            // Limitar resultados
            { $limit: limit },
            
            // Formatear respuesta
            {
                $project: {
                    _id: 0,
                    productId: "$_id.productId",
                    productName: "$_id.productName",
                    productPrice: "$_id.productPrice",
                    totalQuantity: 1,
                    totalOrders: 1,
                    totalRevenue: { $round: ["$totalRevenue", 2] }
                }
            }
        ]);

        res.status(200).json({
            popularProducts,
            count: popularProducts.length
        });
    } catch (error) {
        console.error('Error getting popular products:', error);
        res.status(500).json({ error: "Error al obtener productos populares" });
    }
});

// GET /get-branches-performance?business=businessName - Rendimiento de sucursales
router.get("/get-branches-performance", async (req, res) => {
    try {
        const business = req.query.business;
        
        if (!business) {
            return res.status(400).json({ error: "Faltan datos (business)" });
        }

        // Agregación para obtener rendimiento por sucursal
        const branchesPerformance = await Order.aggregate([
            // Filtrar por business
            { $match: { businessId: business } },
            
            // Agrupar por sucursal
            {
                $group: {
                    _id: {
                        branchId: "$branch.id",
                        branchName: "$branch.name"
                    },
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: "$total" },
                    averageOrderValue: { $avg: "$total" },
                    // Contar por estado
                    pendingOrders: {
                        $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
                    },
                    confirmedOrders: {
                        $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] }
                    },
                    preparingOrders: {
                        $sum: { $cond: [{ $eq: ["$status", "preparing"] }, 1, 0] }
                    },
                    readyOrders: {
                        $sum: { $cond: [{ $eq: ["$status", "ready"] }, 1, 0] }
                    },
                    deliveredOrders: {
                        $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] }
                    },
                    cancelledOrders: {
                        $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] }
                    },
                    // Contar por método de pago
                    paidOrders: {
                        $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] }
                    },
                    pendingPayments: {
                        $sum: { $cond: [{ $eq: ["$paymentStatus", "pending"] }, 1, 0] }
                    },
                    // Fechas
                    firstOrder: { $min: "$createdAt" },
                    lastOrder: { $max: "$createdAt" }
                }
            },
            
            // Ordenar por total de pedidos (más activa primero)
            { $sort: { totalOrders: -1 } },
            
            // Formatear respuesta
            {
                $project: {
                    _id: 0,
                    branchId: "$_id.branchId",
                    branchName: "$_id.branchName",
                    totalOrders: 1,
                    totalRevenue: { $round: ["$totalRevenue", 2] },
                    averageOrderValue: { $round: ["$averageOrderValue", 2] },
                    ordersByStatus: {
                        pending: "$pendingOrders",
                        confirmed: "$confirmedOrders",
                        preparing: "$preparingOrders",
                        ready: "$readyOrders",
                        delivered: "$deliveredOrders",
                        cancelled: "$cancelledOrders"
                    },
                    ordersByPayment: {
                        paid: "$paidOrders",
                        pending: "$pendingPayments"
                    },
                    firstOrder: 1,
                    lastOrder: 1
                }
            }
        ]);

        res.status(200).json({
            branchesPerformance,
            count: branchesPerformance.length
        });
    } catch (error) {
        console.error('Error getting branches performance:', error);
        res.status(500).json({ error: "Error al obtener rendimiento de sucursales" });
    }
});

// GET /get-analytics-dashboard?business=businessName&timeRange=7days&branchId=all&dateFrom=2024-01-01&dateTo=2024-12-31
router.get("/get-analytics-dashboard", async (req, res) => {
    try {
        const business = req.query.business;
        const timeRange = req.query.timeRange || '7days';
        const branchId = req.query.branchId || 'all';
        const dateFrom = req.query.dateFrom;
        const dateTo = req.query.dateTo;

        console.log(dateFrom, dateTo);
        
        if (!business) {
            return res.status(400).json({ error: "Faltan datos (business)" });
        }

        // Check cache first
        const cacheKey = getCacheKey(business, timeRange, branchId, dateFrom, dateTo);
        const cachedData = analyticsCache.get(cacheKey);
        
        if (isCacheValid(cachedData)) {
            return res.status(200).json(cachedData.data);
        }

        // Calcular fechas basadas en timeRange
        let startDate, endDate;
        if (dateFrom && dateTo) {
            // Usar fechas específicas proporcionadas
            // Parsear fechas en timezone local para evitar problemas de UTC
            const [yearFrom, monthFrom, dayFrom] = dateFrom.split('-').map(Number);
            const [yearTo, monthTo, dayTo] = dateTo.split('-').map(Number);
            
            startDate = new Date(yearFrom, monthFrom - 1, dayFrom, 0, 0, 0, 0);
            endDate = new Date(yearTo, monthTo - 1, dayTo, 23, 59, 59, 999);
            
            // Verificar que las fechas son válidas
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                return res.status(400).json({ 
                    error: "Fechas inválidas", 
                    dateFrom, 
                    dateTo 
                });
            }
            
            console.log('Using specific dates (local timezone):', {
                dateFrom: dateFrom,
                dateTo: dateTo,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                startDateLocal: startDate.toString(),
                endDateLocal: endDate.toString(),
                timezoneOffset: startDate.getTimezoneOffset()
            });
        } else {
            // Usar timeRange para calcular fechas
            endDate = new Date();
            startDate = new Date();
            
            switch (timeRange) {
                case '7days':
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case '30days':
                    startDate.setDate(startDate.getDate() - 30);
                    break;
                case '90days':
                    startDate.setDate(startDate.getDate() - 90);
                    break;
                case 'year':
                    startDate.setFullYear(startDate.getFullYear() - 1);
                    break;
            }
            
            console.log('Using timeRange:', {
                timeRange: timeRange,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            });
        }

        // Construir filtros base
        const baseFilter = { 
            businessId: business,
            createdAt: { $gte: startDate, $lte: endDate }
        };

        // Filtro por sucursal
        if (branchId !== 'all') {
            baseFilter['branch.id'] = branchId;
        }

        console.log('Base filter:', JSON.stringify(baseFilter, null, 2));

        // Test: Verificar que el filtro de fechas funciona correctamente
        const testCount = await Order.countDocuments(baseFilter);
        console.log('Orders found with date filter:', testCount);

        // Test: Verificar algunas fechas de órdenes que coinciden
        const sampleOrders = await Order.find(baseFilter)
            .select('createdAt orderNumber')
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();
        
        console.log('Sample orders found:', sampleOrders.map(order => ({
            orderNumber: order.orderNumber,
            createdAt: order.createdAt.toISOString(),
            createdAtDate: order.createdAt.toISOString().split('T')[0]
        })));

        // Agregación principal para obtener todas las métricas en una sola consulta
        const analyticsData = await Order.aggregate([
            { $match: baseFilter },
            {
                $group: {
                    _id: null,
                    // Métricas básicas
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: "$total" },
                    averageOrderValue: { $avg: "$total" },
                    
                    // Órdenes por estado
                    pendingOrders: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
                    deliveredOrders: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
                    paidOrders: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] } },
                    
                    // Datos para gráficos
                    ordersByDate: {
                        $push: {
                            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                            total: "$total",
                            status: "$status",
                            paymentMethod: "$paymentMethod",
                            paymentStatus: "$paymentStatus",
                            hour: { $hour: "$createdAt" },
                            items: "$items"
                        }
                    }
                }
            }
        ]);

        const data = analyticsData[0] || {
            totalOrders: 0,
            totalRevenue: 0,
            averageOrderValue: 0,
            pendingOrders: 0,
            deliveredOrders: 0,
            paidOrders: 0,
            ordersByDate: []
        };

        console.log('Analytics data result:', {
            totalOrders: data.totalOrders,
            ordersByDateLength: data.ordersByDate.length,
            sampleDates: data.ordersByDate.slice(0, 3).map(order => ({
                date: order.date,
                createdAt: order.createdAt
            }))
        });

        // Procesar datos por fecha para gráficos
        const salesByDate = {};
        const hourlyOrders = Array(24).fill(0);
        const categorySales = {};
        const paymentMethods = {};
        const extrasStats = {};

        data.ordersByDate.forEach(order => {
            // Ventas por fecha
            const date = order.date;
            if (!salesByDate[date]) {
                salesByDate[date] = { sales: 0, orders: 0 };
            }
            salesByDate[date].sales += order.total;
            salesByDate[date].orders += 1;

            // Órdenes por hora
            hourlyOrders[order.hour] += 1;

            // Métodos de pago - acumular total de ventas por método
            const paymentMethod = order.paymentMethod;
            paymentMethods[paymentMethod] = (paymentMethods[paymentMethod] || 0) + order.total;

            // Procesar items para categorías y extras
            order.items.forEach(item => {
                // Categorías - usar categoryId directamente ya que es lo que tenemos
                const category = item.product.categoryId || 'Sin categoría';
                categorySales[category] = (categorySales[category] || 0) + (item.product.price * item.quantity);

                // Extras
                if (item.selectedExtras && item.selectedExtras.length > 0) {
                    item.selectedExtras.forEach(extra => {
                        if (!extrasStats[extra.name]) {
                            extrasStats[extra.name] = { quantity: 0, revenue: 0 };
                        }
                        extrasStats[extra.name].quantity += extra.quantity;
                        extrasStats[extra.name].revenue += extra.price * extra.quantity;
                    });
                }
            });
        });

        // Convertir datos de fechas a array ordenado
        const salesData = Object.entries(salesByDate)
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        // Obtener nombres de categorías
        const categoryIds = Object.keys(categorySales);
        const categories = await Category.find({ 
            id: { $in: categoryIds },
            businessId: business 
        }).lean();
        
        const categoryMap = {};
        categories.forEach(cat => {
            categoryMap[cat.id] = cat.name;
        });

        // Convertir categorías a array con nombres
        const categoryData = Object.entries(categorySales)
            .map(([categoryId, value]) => ({ 
                name: categoryMap[categoryId] || categoryId, 
                value 
            }))
            .sort((a, b) => b.value - a.value);

        // Convertir métodos de pago a array (ventas totales por método)
        const paymentMethodData = Object.entries(paymentMethods)
            .map(([name, value]) => ({ 
                name, 
                value: Math.round(value * 100) / 100 // Redondear a 2 decimales
            }))
            .sort((a, b) => b.value - a.value); // Ordenar por ventas descendente

    
     
        // Convertir extras a array
        const extrasData = Object.entries(extrasStats)
            .map(([name, stats]) => ({
                name,
                value: stats.quantity,
                revenue: stats.revenue,
                averagePrice: stats.quantity > 0 ? stats.revenue / stats.quantity : 0
            }))
            .sort((a, b) => b.value - a.value);

        // Datos por hora
        const hourlyOrdersData = hourlyOrders.map((orders, hour) => ({
            hour: `${hour}:00`,
            orders
        }));

        // Calcular métricas adicionales
        const totalVolume = salesData.reduce((sum, day) => sum + day.orders, 0);
        const averageOrderValue = data.totalOrders > 0 ? data.totalRevenue / data.totalOrders : 0;

        const responseData = {
            summary: {
                totalOrders: data.totalOrders,
                totalRevenue: Math.round(data.totalRevenue * 100) / 100,
                averageOrderValue: Math.round(averageOrderValue * 100) / 100,
                pendingOrders: data.pendingOrders,
                deliveredOrders: data.deliveredOrders,
                paidOrders: data.paidOrders,
                totalVolume: totalVolume
            },
            charts: {
                salesData,
                categoryData,
                paymentMethodData,
                extrasData,
                hourlyOrdersData
            }
        };

        // Cache the response
        analyticsCache.set(cacheKey, {
            data: responseData,
            timestamp: Date.now()
        });

        res.status(200).json(responseData);
    } catch (error) {
        console.error('Error getting analytics dashboard:', error);
        res.status(500).json({ error: "Error al obtener datos de analíticas" });
    }
});

// GET /get-analytics-products?business=businessName&timeRange=7days&branchId=all&limit=10
router.get("/get-analytics-products", async (req, res) => {
    try {
        const business = req.query.business;
        const timeRange = req.query.timeRange || '7days';
        const branchId = req.query.branchId || 'all';
        const limit = parseInt(req.query.limit) || 10;
        
        if (!business) {
            return res.status(400).json({ error: "Faltan datos (business)" });
        }

        // Calcular fechas
        const endDate = new Date();
        const startDate = new Date();
        
        switch (timeRange) {
            case '7days':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30days':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case '90days':
                startDate.setDate(startDate.getDate() - 90);
                break;
            case 'year':
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
        }

        const baseFilter = { 
            businessId: business,
            createdAt: { $gte: startDate, $lte: endDate }
        };

        if (branchId !== 'all') {
            baseFilter['branch.id'] = branchId;
        }

        // Agregación para productos más vendidos
        const popularProducts = await Order.aggregate([
            { $match: baseFilter },
            { $unwind: "$items" },
            {
                $group: {
                    _id: {
                        productId: "$items.product.id",
                        productName: "$items.product.name",
                        productPrice: "$items.product.price"
                    },
                    totalQuantity: { $sum: "$items.quantity" },
                    totalRevenue: { 
                        $sum: { 
                            $multiply: ["$items.product.price", "$items.quantity"] 
                        } 
                    },
                    totalOrders: { $sum: 1 }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: limit },
            {
                $project: {
                    _id: 0,
                    productId: "$_id.productId",
                    productName: "$_id.productName",
                    productPrice: "$_id.productPrice",
                    totalQuantity: 1,
                    totalRevenue: { $round: ["$totalRevenue", 2] },
                    totalOrders: 1,
                    averagePrice: { $round: [{ $divide: ["$totalRevenue", "$totalQuantity"] }, 2] }
                }
            }
        ]);

        res.status(200).json({
            popularProducts,
            count: popularProducts.length
        });
    } catch (error) {
        console.error('Error getting analytics products:', error);
        res.status(500).json({ error: "Error al obtener productos de analíticas" });
    }
});

// GET /get-analytics-branches?business=businessName&timeRange=7days
router.get("/get-analytics-branches", async (req, res) => {
    try {
        const business = req.query.business;
        const timeRange = req.query.timeRange || '7days';
        
        if (!business) {
            return res.status(400).json({ error: "Faltan datos (business)" });
        }

        // Calcular fechas
        const endDate = new Date();
        const startDate = new Date();
        
        switch (timeRange) {
            case '7days':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30days':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case '90days':
                startDate.setDate(startDate.getDate() - 90);
                break;
            case 'year':
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
        }

        const baseFilter = { 
            businessId: business,
            createdAt: { $gte: startDate, $lte: endDate }
        };

        // Agregación para rendimiento por sucursal
        const branchesPerformance = await Order.aggregate([
            { $match: baseFilter },
            {
                $group: {
                    _id: {
                        branchId: "$branch.id",
                        branchName: "$branch.name"
                    },
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: "$total" },
                    averageOrderValue: { $avg: "$total" },
                    deliveredOrders: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
                    paidOrders: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] } },
                    // Agregar datos por fecha para calcular volumen
                    ordersByDate: {
                        $push: {
                            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                            total: "$total",
                            orders: 1
                        }
                    }
                }
            },
            { $sort: { totalOrders: -1 } },
            {
                $project: {
                    _id: 0,
                    branchId: "$_id.branchId",
                    branchName: "$_id.branchName",
                    totalOrders: 1,
                    totalRevenue: { $round: ["$totalRevenue", 2] },
                    averageOrderValue: { $round: ["$averageOrderValue", 2] },
                    deliveredOrders: 1,
                    paidOrders: 1,
                    ordersByDate: 1
                }
            }
        ]);

        // Procesar datos por fecha para cada sucursal
        const processedBranches = branchesPerformance.map(branch => {
            const salesByDate = {};
            branch.ordersByDate.forEach(order => {
                const date = order.date;
                if (!salesByDate[date]) {
                    salesByDate[date] = { sales: 0, orders: 0 };
                }
                salesByDate[date].sales += order.total;
                salesByDate[date].orders += 1;
            });

            const salesData = Object.entries(salesByDate)
                .map(([date, data]) => ({ date, ...data }))
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            const totalVolume = salesData.reduce((sum, day) => sum + day.orders, 0);

            return {
                ...branch,
                totalVolume,
                salesData
            };
        });

        res.status(200).json({
            branchesPerformance: processedBranches,
            count: processedBranches.length
        });
    } catch (error) {
        console.error('Error getting analytics branches:', error);
        res.status(500).json({ error: "Error al obtener datos de sucursales" });
    }
});

// POST /clear-analytics-cache?business=businessName - Limpiar caché de analíticas
router.post("/clear-analytics-cache", async (req, res) => {
    try {
        const business = req.query.business;
        
        if (!business) {
            return res.status(400).json({ error: "Faltan datos (business)" });
        }

        clearAnalyticsCache(business);
        
        res.status(200).json({ 
            success: true, 
            message: "Caché de analíticas limpiado exitosamente" 
        });
    } catch (error) {
        console.error('Error clearing analytics cache:', error);
        res.status(500).json({ error: "Error al limpiar caché de analíticas" });
    }
});

export default router;