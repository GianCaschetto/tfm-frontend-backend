import { Router } from 'express';
import ExtraGroup from './models/ExtraGroups.js';
import websocketService from './services/websocketService.js';
import { requirePermissionAccess } from './middleware/auth.js';

const router = Router();

// Add extra group
router.post("/add-extra-group", requirePermissionAccess('canManageExtras'), async (req, res) => {
    try {
        const extraGroupData = req.body;
        const business = req.query.business;
        
        const extraGroup = new ExtraGroup({
            id: extraGroupData.id, // Usar el id que viene del frontend
            businessId: business,
            name: extraGroupData.name,
            type: extraGroupData.type || 'quantity',
            description: extraGroupData.description || '',
            categoryIds: extraGroupData.categoryIds || [],
            extras: extraGroupData.extras || [],
            maxSelectable: extraGroupData.maxSelectable || null,
            required: extraGroupData.required || false,
            isActive: extraGroupData.isActive !== undefined ? extraGroupData.isActive : true
        });

        const savedExtraGroup = await extraGroup.save();
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'extra-group-added', savedExtraGroup);

        res.status(200).json({ 
            success: true, 
            extraGroup: savedExtraGroup 
        });
    } catch (error) {
        console.error('Error adding extra group:', error);
        res.status(500).json({ error: "Error al agregar grupo de extras" });
    }
});

// Update extra group
router.put("/update-extra-group/:id", requirePermissionAccess('canManageExtras'), async (req, res) => {
    try {
        const id = req.params.id;
        const extraGroupData = req.body;
        const business = req.query.business;

        // Preparar los datos para actualización
        const updateData = {
            name: extraGroupData.name,
            type: extraGroupData.type,
            description: extraGroupData.description,
            categoryIds: extraGroupData.categoryIds,
            extras: extraGroupData.extras,
            maxSelectable: extraGroupData.maxSelectable,
            required: extraGroupData.required,
            isActive: extraGroupData.isActive,
            updatedAt: new Date()
        };
        
        // Remover campos undefined para no sobrescribir con undefined
        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) {
                delete updateData[key];
            }
        });
        
        const updatedExtraGroup = await ExtraGroup.findOneAndUpdate(
            { id: id, businessId: business },
            updateData,
            { new: true }
        );
        
        if (!updatedExtraGroup) {
            return res.status(404).json({ error: "Grupo de extras no encontrado" });
        }
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'extra-group-updated', updatedExtraGroup);
        
        res.status(200).json({ 
            success: true, 
            extraGroup: updatedExtraGroup 
        });
    } catch (error) {
        console.error('Error updating extra group:', error);
        res.status(500).json({ error: "Error al actualizar grupo de extras" });
    }
});

// Delete extra group
router.delete("/delete-extra-group/:id", requirePermissionAccess('canManageExtras'), async (req, res) => {
    try {
        const id = req.params.id;
        const business = req.query.business;
        
        const deletedExtraGroup = await ExtraGroup.findOneAndDelete({ 
            id: id, 
            businessId: business 
        });
        
        if (!deletedExtraGroup) {
            return res.status(404).json({ error: "Grupo de extras no encontrado" });
        }
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'extra-group-deleted', { id });
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error deleting extra group:', error);
        res.status(500).json({ error: "Error al eliminar grupo de extras" });
    }
});

// Get extra group by id
router.get("/get-extra-group/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const business = req.query.business;
        
        const extraGroup = await ExtraGroup.findOne({ 
            id: id, 
            businessId: business 
        });
        
        if (!extraGroup) {
            return res.status(404).json({ error: "Grupo de extras no encontrado" });
        }
        
        res.status(200).json({ extraGroup });
    } catch (error) {
        console.error('Error getting extra group:', error);
        res.status(500).json({ error: "Error al obtener grupo de extras" });
    }
});

// Get all extra groups (for frontend compatibility)
router.get("/get-all-extra-groups", async (req, res) => {
    try {
        const business = req.query.business;
        
        
        // Primero buscar sin filtros para debug
        const allExtraGroups = await ExtraGroup.find({});
        
        // Buscar con filtros
        const extraGroups = await ExtraGroup.find({ 
            businessId: business,
            isActive: true
        }).sort({ createdAt: -1 });
        
   
        if (extraGroups.length === 0) {
            // Debug adicional si no hay resultados
            const byBusinessOnly = await ExtraGroup.find({ businessId: business });
            const byActiveOnly = await ExtraGroup.find({ isActive: true });
            
        }
        
        res.status(200).json({ extraGroups });

    } catch (error) {
        console.error('Error getting all extra groups:', error);
        res.status(500).json({ error: "Error al obtener grupos de extras" });
    }
});

// Get extra groups by category
router.get("/get-extra-groups-by-category/:categoryId", async (req, res) => {
    try {
        const categoryId = req.params.categoryId;
        const business = req.query.business;
        
        const extraGroups = await ExtraGroup.find({ 
            businessId: business,
            isActive: true,
            categoryIds: categoryId
        }).sort({ createdAt: -1 });
        
        res.status(200).json({ extraGroups });
    } catch (error) {
        console.error('Error getting extra groups by category:', error);
        res.status(500).json({ error: "Error al obtener grupos de extras por categoría" });
    }
});

// Get all extra groups (alternative endpoint for frontend)
router.get("/", async (req, res) => {
    try {
        const business = req.query.business;
        
        const extraGroups = await ExtraGroup.find({ 
            businessId: business,
            isActive: true 
        }).sort({ createdAt: -1 });
        
        res.status(200).json({ extraGroups });
    } catch (error) {
        console.error('Error getting all extra groups:', error);
        res.status(500).json({ error: "Error al obtener grupos de extras" });
    }
});

// Legacy endpoints for backward compatibility
// Add extra (now creates an extra group with a single extra)
router.post("/add-extra", async (req, res) => {
    try {
        const extraData = req.body;
        const business = req.query.business;
        
        const extraGroup = new ExtraGroup({
            businessId: business,
            name: extraData.name,
            description: extraData.description || '',
            extras: [{
                id: extraData.id || Date.now().toString(),
                name: extraData.name,
                price: extraData.price,
                min: extraData.min || 0,
                max: extraData.max || null,
                required: extraData.required || false
            }],
            isActive: true
        });

        const savedExtraGroup = await extraGroup.save();
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'extra-added', savedExtraGroup);
        
        res.status(200).json({ 
            success: true, 
            extra: savedExtraGroup 
        });
    } catch (error) {
        console.error('Error adding extra:', error);
        res.status(500).json({ error: "Error al agregar extra" });
    }
});

// Update extra
router.put("/update-extra/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const extraData = req.body;
        const business = req.query.business;
        
        const updatedExtraGroup = await ExtraGroup.findOneAndUpdate(
            { id: id, businessId: business },
            { 
                ...extraData,
                updatedAt: new Date()
            },
            { new: true }
        );
        
        if (!updatedExtraGroup) {
            return res.status(404).json({ error: "Extra no encontrado" });
        }
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'extra-updated', updatedExtraGroup);
        
        res.status(200).json({ 
            success: true, 
            extra: updatedExtraGroup 
        });
    } catch (error) {
        console.error('Error updating extra:', error);
        res.status(500).json({ error: "Error al actualizar extra" });
    }
});

// Delete extra
router.delete("/delete-extra/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const business = req.query.business;
        
        const deletedExtraGroup = await ExtraGroup.findOneAndDelete({ 
            id: id, 
            businessId: business 
        });
        
        if (!deletedExtraGroup) {
            return res.status(404).json({ error: "Extra no encontrado" });
        }
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'extra-deleted', { id });
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error deleting extra:', error);
        res.status(500).json({ error: "Error al eliminar extra" });
    }
});

// Get extra by id
router.get("/get-extra/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const business = req.query.business;
        
        const extraGroup = await ExtraGroup.findOne({ 
            id: id, 
            businessId: business 
        });
        
        if (!extraGroup) {
            return res.status(404).json({ error: "Extra no encontrado" });
        }
        
        res.status(200).json({ extra: extraGroup });
    } catch (error) {
        console.error('Error getting extra:', error);
        res.status(500).json({ error: "Error al obtener extra" });
    }
});

// Get all extras
router.get("/get-all-extras", requirePermissionAccess('canManageExtras'), async (req, res) => {
    try {
        const business = req.query.business;
        const extraGroups = await ExtraGroup.find({ 
            businessId: business,
            isActive: true 
        }).sort({ createdAt: -1 });
        
        res.status(200).json({ extras: extraGroups });
    } catch (error) {
        console.error('Error getting all extras:', error);
        res.status(500).json({ error: "Error al obtener extras" });
    }
});

// Debug endpoint para diagnosticar problemas
router.get("/debug-extras", async (req, res) => {
    try {
        const business = req.query.business;
        
        
        // 1. Buscar sin filtros para ver qué hay en total
        const totalExtraGroups = await ExtraGroup.find({});
        
        // 2. Mostrar todos los businessIds únicos
        const uniqueBusinessIds = [...new Set(totalExtraGroups.map(eg => eg.businessId))];
        
        // 3. Buscar por businessId exacto
        const byExactBusiness = await ExtraGroup.find({ businessId: business });
        
        // 4. Buscar solo por isActive: true
        const byActiveOnly = await ExtraGroup.find({ isActive: true });
        
        // 5. Buscar por businessId + isActive: true
        const byBusinessAndActive = await ExtraGroup.find({ 
            businessId: business, 
            isActive: true 
        });
        
        // 6. Mostrar detalles de algunos documentos
        const sampleDocs = totalExtraGroups.slice(0, 3).map(eg => ({
            _id: eg._id,
            id: eg.id,
            businessId: eg.businessId,
            isActive: eg.isActive,
            name: eg.name,
            extrasCount: eg.extras?.length || 0
        }));
        
        res.status(200).json({
            debug: {
                businessIdSearched: business,
                totalInDB: totalExtraGroups.length,
                uniqueBusinessIds: uniqueBusinessIds,
                byExactBusiness: byExactBusiness.length,
                byActiveOnly: byActiveOnly.length,
                byBusinessAndActive: byBusinessAndActive.length,
                sampleDocuments: sampleDocs
            }
        });
        
    } catch (error) {
        console.error('❌ Error en debug endpoint:', error);
        res.status(500).json({ 
            error: "Error en debug endpoint",
            message: error.message,
            stack: error.stack
        });
    }
});

export default router;