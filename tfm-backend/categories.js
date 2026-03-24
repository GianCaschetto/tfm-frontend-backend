import { Router } from 'express';
import Category from './models/Category.js';
import websocketService from './services/websocketService.js';
import { requirePermissionAccess } from './middleware/auth.js';

const router = Router();

// Add category
router.post("/add-category", requirePermissionAccess('canManageCategories'), async (req, res) => {
    try {
        const categoryData = req.body;
        const business = req.query.business;
        
        const category = new Category({
            businessId: business,
            id: categoryData.id,
            name: categoryData.name,
            description: categoryData.description,
            image: categoryData.image,
            order: categoryData.order || 0,
            color: categoryData.color,
            icon: categoryData.icon,
            availability: {
                always: categoryData.availability?.always ?? true,
                days: categoryData.availability?.days || []
            }
        });

        const savedCategory = await category.save();
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'category-added', savedCategory);
        
        res.status(200).json({ 
            success: true, 
            category: savedCategory 
        });
    } catch (error) {
        console.error('Error adding category:', error);
        res.status(500).json({ error: "Error al agregar categoría" });
    }
});

// Delete category
router.delete("/delete-category/:id", requirePermissionAccess('canManageCategories'), async (req, res) => {
    try {
        const id = req.params.id;
        const business = req.query.business;
        
        const deletedCategory = await Category.findOneAndDelete({ 
            id: id, 
            businessId: business 
        });
        
        if (!deletedCategory) {
            return res.status(404).json({ error: "Categoría no encontrada" });
        }
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'category-deleted', { id });
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: "Error al eliminar categoría" });
    }
});

// Update category
router.put("/update-category/:id", requirePermissionAccess('canManageCategories'), async (req, res) => {
    try {
        const id = req.params.id;
        const categoryData = req.body;
        const business = req.query.business;
        
        // Preparar datos de actualización
        const updateData = {
            ...categoryData,
            updatedAt: new Date()
        };
        
        // Manejar availability si está presente
        if (categoryData.availability !== undefined) {
            updateData.availability = {
                always: categoryData.availability.always ?? true,
                days: categoryData.availability.days || []
            };
        }
        
        const updatedCategory = await Category.findOneAndUpdate(
            { id: id, businessId: business },
            updateData,
            { new: true }
        );
        
        if (!updatedCategory) {
            return res.status(404).json({ error: "Categoría no encontrada" });
        }
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'category-updated', updatedCategory);
        
        res.status(200).json({ 
            success: true, 
            category: updatedCategory 
        });
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ error: "Error al actualizar categoría" });
    }
});

// Update order of categories
router.put("/update-order-categories", requirePermissionAccess('canManageCategories'), async (req, res) => {
    try {
        const categories = req.body;
        const business = req.query.business;
        
        // Update each category order
        for (const category of categories) {
            await Category.findOneAndUpdate(
                { id: category.id, businessId: business },
                { 
                    order: category.order,
                    updatedAt: new Date()
                }
            );
        }
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'categories-order-updated', categories);
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error updating categories order:', error);
        res.status(500).json({ error: "Error al actualizar orden de categorías" });
    }
});

// Get category
router.get("/get-category/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const business = req.query.business;
        
        const category = await Category.findOne({ 
            id: id, 
            businessId: business 
        });
        
        if (!category) {
            return res.status(404).json({ error: "Categoría no encontrada" });
        }
        
        res.status(200).json({ category });
    } catch (error) {
        console.error('Error getting category:', error);
        res.status(500).json({ error: "Error al obtener categoría" });
    }
});

// Get all categories
router.get("/get-all-categories", async (req, res) => {
    try {
        const business = req.query.business;
        
        const categories = await Category.find({ 
            businessId: business,
            isActive: true 
        }).sort({ order: 1, createdAt: -1 });
        
        res.status(200).json({ categories });
    } catch (error) {
        console.error('Error getting all categories:', error);
        res.status(500).json({ error: "Error al obtener categorías" });
    }
});

// Get categories by availability (nuevo endpoint)
router.get("/get-categories-by-availability", async (req, res) => {
    try {
        const business = req.query.business;
        const { day, always } = req.query;
        
        let query = { 
            businessId: business,
            isActive: true 
        };
        
        // Filtrar por disponibilidad
        if (always === 'false' && day) {
            // Categorías que NO están siempre disponibles y están disponibles en el día específico
            query['availability.always'] = false;
            query['availability.days'] = day;
        } else if (always === 'true') {
            // Categorías que están siempre disponibles
            query['availability.always'] = true;
        }
        
        const categories = await Category.find(query).sort({ order: 1, createdAt: -1 });
        
        res.status(200).json({ 
            categories,
            filters: { day, always },
            total: categories.length
        });
    } catch (error) {
        console.error('Error getting categories by availability:', error);
        res.status(500).json({ error: "Error al obtener categorías por disponibilidad" });
    }
});

// Update category availability (nuevo endpoint)
router.put("/update-category-availability/:id", requirePermissionAccess('canManageCategories'), async (req, res) => {
    try {

        const id = req.params.id;
        const { availability } = req.body;
        const business = req.query.business;

        if (!availability || typeof availability.always !== 'boolean') {
            return res.status(400).json({ 
                error: "availability.always es requerido y debe ser boolean" 
            });
        }
        
        const updateData = {
            availability: {
                always: availability.always,
                days: availability.days || []
            },
            updatedAt: new Date()
        };

       

        const updatedCategory = await Category.findOneAndUpdate(
            { id: id, businessId: business },
            updateData,
            { new: true }
        );
        
        if (!updatedCategory) {
            return res.status(404).json({ error: "Categoría no encontrada" });
        }
  
        // Emit real-time update
        websocketService.emitToBusiness(business, 'category-availability-updated', updatedCategory);
        
        res.status(200).json({ 
            success: true, 
            category: updatedCategory 
        });
    } catch (error) {
        console.error('Error updating category availability:', error);
        res.status(500).json({ error: "Error al actualizar disponibilidad de categoría" });
    }
});

export default router;

