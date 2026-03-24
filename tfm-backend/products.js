import { Router } from 'express';
import mongoose from 'mongoose';
import Product from './models/Product.js';
import websocketService from './services/websocketService.js';
import { requirePermissionAccess } from './middleware/auth.js';
import crypto from 'crypto';

const router = Router();

// Add product
router.post("/add-product", requirePermissionAccess('canManageProducts'), async (req, res) => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    
    try {

        
        const productData = req.body;
        const business = req.query.business;
        
      
        
        // Medir tiempo de creación del modelo
        const modelStartTime = Date.now();

        console.time("product");
        const product = new Product({
            businessId: business,
            id: productData.id || null,
            name: productData.name,
            description: productData.description || '',
            price: productData.price,
            image: productData.image || { src: '', width: 0, height: 0 },
            categoryId: productData.categoryId,
            availability: productData.availability || [],
            extras: productData.extras || [],
            stockId: productData.stockId || null,
            extraGroupIds: productData.extraGroupIds || []
        });
        console.timeEnd("product");
        const modelTime = Date.now() - modelStartTime;
        console.log(`⚡ [${requestId}] Modelo creado en: ${modelTime}ms`);
        
        // Medir tiempo de guardado en base de datos
        const saveStartTime = Date.now();
        console.log(`💾 [${requestId}] Guardando producto en base de datos...`);
        
        console.time("save");
        const savedProduct = await product.save();
        console.timeEnd("save");
        const saveTime = Date.now() - saveStartTime;
      
      
        console.log(`✅ [${requestId}] Producto guardado en: ${saveTime}ms`);
        console.log(`📊 [${requestId}] Producto guardado:`, {
            id: savedProduct.id,
            name: savedProduct.name,
            businessId: savedProduct.businessId,
            timestamp: savedProduct.createdAt
        });
        
        // Medir tiempo de emisión WebSocket
        const wsStartTime = Date.now();
        console.log(`📡 [${requestId}] Emitiendo evento WebSocket...`);
        websocketService.emitToBusiness(business, 'product-added', savedProduct);
        const wsTime = Date.now() - wsStartTime;
        console.log(`📤 [${requestId}] Evento WebSocket emitido en: ${wsTime}ms`);
        
        // Calcular tiempo total
        const totalTime = Date.now() - startTime;
   
        res.status(200).json({ 
            success: true, 
            product: savedProduct,
            performance: {
                requestId,
                totalTime,
                breakdown: {
                    modelCreation: modelTime,
                    databaseSave: saveTime,
                    websocketEmit: wsTime
                }
            }
        });
        
    } catch (error) {
        const totalTime = Date.now() - startTime;
        console.error(`❌ [${requestId}] Error creando producto después de ${totalTime}ms:`, error);
        console.error(`📊 [${requestId}] Stack trace:`, error.stack);
        
        res.status(500).json({ 
            error: "Error al agregar producto",
            requestId,
            executionTime: totalTime,
            timestamp: new Date().toISOString()
        });
    }
});

// Update product
router.put("/update-product/:id", requirePermissionAccess('canManageProducts'), async (req, res) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substr(2, 9);
    
    try {
        const id = req.params.id;
        const productData = req.body;
        const business = req.query.business;
        
        console.log(`🔄 [${requestId}] Iniciando actualización de producto...`);
        console.log(`⏱️ [${requestId}] Timestamp inicio: ${new Date().toISOString()}`);
        console.log(`📋 [${requestId}] Datos de actualización:`, {
            productId: id,
            business: business,
            fieldsToUpdate: Object.keys(productData),
            timestamp: new Date().toISOString()
        });
        
        // Medir tiempo de búsqueda y actualización
        const updateStartTime = Date.now();
        console.log(`🔍 [${requestId}] Buscando y actualizando producto en base de datos...`);
        
        const updatedProduct = await Product.findOneAndUpdate(
            { id: id, businessId: business },
            { 
                ...productData,
                updatedAt: new Date()
            },
            { new: true }
        );
        
        const updateTime = Date.now() - updateStartTime;
        console.log(`✅ [${requestId}] Producto actualizado en: ${updateTime}ms`);
        
        if (!updatedProduct) {
            const totalTime = Date.now() - startTime;
            console.log(`❌ [${requestId}] Producto no encontrado después de ${totalTime}ms`);
            return res.status(404).json({ 
                error: "Producto no encontrado",
                requestId,
                executionTime: totalTime
            });
        }
        
        console.log(`📊 [${requestId}] Producto actualizado:`, {
            id: updatedProduct.id,
            name: updatedProduct.name,
            businessId: updatedProduct.businessId,
            updatedAt: updatedProduct.updatedAt
        });
        
        // Medir tiempo de emisión WebSocket
        const wsStartTime = Date.now();
        console.log(`📡 [${requestId}] Emitiendo evento WebSocket...`);
        websocketService.emitToBusiness(business, 'product-updated', updatedProduct);
        const wsTime = Date.now() - wsStartTime;
        console.log(`📤 [${requestId}] Evento WebSocket emitido en: ${wsTime}ms`);
        
        // Calcular tiempo total
        const totalTime = Date.now() - startTime;
        
        console.log(`🎯 [${requestId}] PRODUCTO ACTUALIZADO EXITOSAMENTE`);
        console.log(`⏱️ [${requestId}] TIEMPOS DE EJECUCIÓN:`);
        console.log(`   • Búsqueda y actualización: ${updateTime}ms`);
        console.log(`   • Evento WebSocket: ${wsTime}ms`);
        console.log(`   • TIEMPO TOTAL: ${totalTime}ms`);
        console.log(`📈 [${requestId}] Rendimiento: ${totalTime < 100 ? '🚀 Excelente' : totalTime < 500 ? '✅ Bueno' : totalTime < 1000 ? '⚠️ Regular' : '🐌 Lento'}`);
       
        res.status(200).json({ 
            success: true, 
            product: updatedProduct,
            performance: {
                requestId,
                totalTime,
                breakdown: {
                    databaseUpdate: updateTime,
                    websocketEmit: wsTime
                }
            }
        });
        
    } catch (error) {
        const totalTime = Date.now() - startTime;
        console.error(`❌ [${requestId}] Error actualizando producto después de ${totalTime}ms:`, error);
        console.error(`📊 [${requestId}] Stack trace:`, error.stack);
        
        res.status(500).json({ 
            error: "Error al actualizar producto",
            requestId,
            executionTime: totalTime,
            timestamp: new Date().toISOString()
        });
    }
});

// Update product extras
router.put("/update-product-extras/:id", requirePermissionAccess('canManageProducts'), async (req, res) => {
    try {
        const id = req.params.id;
        const extras = req.body;
        const business = req.query.business;
        
        // Validate and process extras
        let processedExtras = extras;
        
        // If extras is a string (JSON), parse it
        if (typeof extras === 'string') {
            try {
                processedExtras = JSON.parse(extras);
            } catch (parseError) {
                return res.status(400).json({ error: "Formato de extras inválido" });
            }
        }
        
        // Validate that extras is an array
        if (!Array.isArray(processedExtras)) {
            return res.status(400).json({ error: "Extras debe ser un array" });
        }
        
        // Validate each extra object
        for (let i = 0; i < processedExtras.length; i++) {
            const extra = processedExtras[i];
            if (!extra.id || !extra.name || typeof extra.price !== 'number') {
                return res.status(400).json({ 
                    error: `Extra en la posición ${i} debe tener id, name y price válidos` 
                });
            }
        }
        
        const updatedProduct = await Product.findOneAndUpdate(
            { id: id, businessId: business },
            { 
                extras: processedExtras,
                updatedAt: new Date()
            },
            { new: true }
        );
        
        if (!updatedProduct) {
            return res.status(404).json({ error: "Producto no encontrado" });
        }
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'product-updated', updatedProduct);
        
        res.status(200).json({ 
            success: true, 
            product: updatedProduct 
        });
    } catch (error) {
        console.error('Error updating product extras:', error);
        res.status(500).json({ error: "Error al actualizar extras del producto" });
    }
});

// Update product availability for specific branch
router.put("/update-product-availability/:id", requirePermissionAccess('canManageProducts'), async (req, res) => {
    try {
        const id = req.params.id;
        const { branchId, isAvailable } = req.body;
        const business = req.query.business;
        
        // ✅ OPTIMIZADO: Usar operadores de MongoDB para actualizar arrays
        const updatedProduct = await Product.findOneAndUpdate(
            { 
                id: id, 
                businessId: business 
            },
            {
                $set: {
                    'availability.$[elem].isAvailable': isAvailable,
                    updatedAt: new Date()
                }
            },
            {
                arrayFilters: [{ 'elem.branchId': branchId }],
                new: true
            }
        );
        
        if (!updatedProduct) {
            return res.status(404).json({ error: "Producto no encontrado" });
        }
        
        // Si no se encontró el branchId, agregarlo
        if (!updatedProduct.availability.some(avail => avail.branchId === branchId)) {
            updatedProduct.availability.push({ branchId, isAvailable });
            await updatedProduct.save();
        }
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'product-updated', updatedProduct);
        
        res.status(200).json({ 
            success: true, 
            product: updatedProduct 
        });
    } catch (error) {
        console.error('Error updating product availability:', error);
        res.status(500).json({ error: "Error al actualizar disponibilidad del producto" });
    }
});

// Update product availability for multiple branches
router.put("/update-product-availability-bulk/:id", requirePermissionAccess('canManageProducts'), async (req, res) => {
    try {
        const id = req.params.id;
        const availability = req.body.availability; // Array of {branchId, isAvailable}
        const business = req.query.business;
        
        const updatedProduct = await Product.findOneAndUpdate(
            { id: id, businessId: business },
            { 
                availability: availability,
                updatedAt: new Date()
            },
            { new: true }
        );
        
        if (!updatedProduct) {
            return res.status(404).json({ error: "Producto no encontrado" });
        }
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'product-updated', updatedProduct);
        
        res.status(200).json({ 
            success: true, 
            product: updatedProduct 
        });
    } catch (error) {
        console.error('Error updating product availability bulk:', error);
        res.status(500).json({ error: "Error al actualizar disponibilidad del producto" });
    }
});

// Delete product
router.delete("/delete-product/:id", requirePermissionAccess('canManageProducts'), async (req, res) => {
    try {
        const id = req.params.id;
        const business = req.query.business;
        console.log("id", id);
        console.log("business", business);
        const deletedProduct = await Product.findOneAndDelete({ 
            id: id, 
            businessId: business 
        });
        console.log("deletedProduct", deletedProduct);
        if (!deletedProduct) {
            return res.status(404).json({ error: "Producto no encontrado" });
        }
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'product-deleted', { id });
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: "Error al eliminar producto" });
    }
});

// Get product by id
router.get("/get-product/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const business = req.query.business;
        
        const product = await Product.findOne({ 
            id: id, 
            businessId: business 
        });
        
        if (!product) {
            return res.status(404).json({ error: "Producto no encontrado" });
        }
        
        res.status(200).json({ product });
    } catch (error) {
        console.error('Error getting product:', error);
        res.status(500).json({ error: "Error al obtener producto" });
    }
});

// Get all products - ✅ OPTIMIZADO con paginación y filtros en base de datos
router.get("/get-all-products", async (req, res) => {
    try {
        const business = req.query.business;
        const categoryId = req.query.categoryId;
        const branchId = req.query.branchId;
        
        // ✅ OPTIMIZADO: Paginación
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50; // Límite por defecto más razonable
        const skip = (page - 1) * limit;
        
        // ✅ OPTIMIZADO: Construir filtro completo para MongoDB
        const filter = { 
            businessId: business,
            isActive: true 
        };
        
        if (categoryId) {
            filter.categoryId = categoryId;
        }
        
        // ✅ OPTIMIZADO: Filtro de disponibilidad en base de datos
        if (branchId) {
            filter['availability.branchId'] = branchId;
            filter['availability.isAvailable'] = true;
        }
        
        // ✅ OPTIMIZADO: Consulta con paginación y filtros en MongoDB
        const [products, totalCount] = await Promise.all([
            Product.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(), // ✅ Usar lean() para mejor rendimiento
            Product.countDocuments(filter)
        ]);
        
        res.status(200).json({ 
            products,
            pagination: {
                page,
                limit,
                total: totalCount,
                pages: Math.ceil(totalCount / limit),
                hasNext: page * limit < totalCount,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Error getting all products:', error);
        res.status(500).json({ error: "Error al obtener productos" });
    }
});

// Get products by category - ✅ OPTIMIZADO
router.get("/get-products-by-category/:categoryId", async (req, res) => {
    try {
        const categoryId = req.params.categoryId;
        const business = req.query.business;
        const branchId = req.query.branchId;
        
        // ✅ OPTIMIZADO: Paginación
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        
        // ✅ OPTIMIZADO: Filtro completo en MongoDB
        const filter = { 
            businessId: business,
            categoryId: categoryId,
            isActive: true 
        };
        
        // ✅ OPTIMIZADO: Filtro de disponibilidad en base de datos
        if (branchId) {
            filter['availability.branchId'] = branchId;
            filter['availability.isAvailable'] = true;
        }
        
        // ✅ OPTIMIZADO: Consulta optimizada con paginación
        const [products, totalCount] = await Promise.all([
            Product.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Product.countDocuments(filter)
        ]);
        
        res.status(200).json({ 
            products,
            pagination: {
                page,
                limit,
                total: totalCount,
                pages: Math.ceil(totalCount / limit),
                hasNext: page * limit < totalCount,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Error getting products by category:', error);
        res.status(500).json({ error: "Error al obtener productos por categoría" });
    }
});

// Get available products for a specific branch - ✅ OPTIMIZADO con agregación
router.get("/get-available-products/:branchId", async (req, res) => {
    try {
        const branchId = req.params.branchId;
        const business = req.query.business;
        const categoryId = req.query.categoryId;
        
        // ✅ OPTIMIZADO: Paginación
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        
        // ✅ OPTIMIZADO: Pipeline de agregación para mejor rendimiento
        const pipeline = [
            { 
                $match: { 
                    businessId: business,
                    isActive: true,
                    'availability.branchId': branchId,
                    'availability.isAvailable': true
                } 
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit }
        ];
        
        // ✅ OPTIMIZADO: Agregar filtro de categoría si se especifica
        if (categoryId) {
            pipeline[0].$match.categoryId = categoryId;
        }
        
        // ✅ OPTIMIZADO: Consulta con agregación para mejor rendimiento
        const [products, totalCount] = await Promise.all([
            Product.aggregate(pipeline),
            Product.countDocuments({
                businessId: business,
                isActive: true,
                'availability.branchId': branchId,
                'availability.isAvailable': true,
                ...(categoryId && { categoryId })
            })
        ]);
        
        res.status(200).json({ 
            products,
            pagination: {
                page,
                limit,
                total: totalCount,
                pages: Math.ceil(totalCount / limit),
                hasNext: page * limit < totalCount,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Error getting available products:', error);
        res.status(500).json({ error: "Error al obtener productos disponibles" });
    }
});

// ✅ NUEVO: Endpoint para crear índices de rendimiento
router.post("/create-indexes", requirePermissionAccess('canManageProducts'), async (req, res) => {
    try {
        const business = req.query.business;
        
        // ✅ Crear índices compuestos para optimizar consultas frecuentes
        await Promise.all([
            Product.collection.createIndex({ 
                businessId: 1, 
                isActive: 1,
                createdAt: -1 
            }),
            Product.collection.createIndex({ 
                businessId: 1, 
                categoryId: 1, 
                isActive: 1,
                createdAt: -1 
            }),
            Product.collection.createIndex({ 
                businessId: 1, 
                'availability.branchId': 1, 
                'availability.isAvailable': 1,
                isActive: 1 
            }),
            Product.collection.createIndex({ 
                businessId: 1, 
                categoryId: 1,
                'availability.branchId': 1, 
                'availability.isAvailable': 1,
                isActive: 1 
            })
        ]);
        
        res.status(200).json({ 
            success: true, 
            message: "Índices de rendimiento creados exitosamente" 
        });
    } catch (error) {
        console.error('Error creating indexes:', error);
        res.status(500).json({ error: "Error al crear índices" });
    }
});

export default router;