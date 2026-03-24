import { Router } from 'express';
import Branch from './models/Branch.js';
import websocketService from './services/websocketService.js';
import { requirePermissionAccess } from './middleware/auth.js';

const router = Router();

// Add branch
router.post("/add-branch", requirePermissionAccess('canManageBranches'), async (req, res) => {
    try {
        const branchData = req.body;
        const business = req.query.business;
        
        const branch = new Branch({
            id: branchData.id,
            businessId: business,
            name: branchData.name,
            address: branchData.address,
            schedule: branchData.schedule || [],
            zones: branchData.zones || []
        });

        const savedBranch = await branch.save();
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'branch-added', savedBranch);
        
        res.status(200).json({ 
            success: true, 
            branch: savedBranch 
        });
    } catch (error) {
        console.error('Error adding branch:', error);
        res.status(500).json({ error: "Error al agregar sucursal" });
    }
});

// Delete branch
router.delete("/delete-branch/:id", requirePermissionAccess('canManageBranches'), async (req, res) => {
    try {
        const id = req.params.id;
        const business = req.query.business;
        
        const deletedBranch = await Branch.findOneAndDelete({ 
            id: id, 
            businessId: business 
        });
        
        if (!deletedBranch) {
            return res.status(404).json({ error: "Sucursal no encontrada" });
        }
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'branch-deleted', { id });
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error deleting branch:', error);
        res.status(500).json({ error: "Error al eliminar sucursal" });
    }
});

// Update branch by id
router.put("/update-branch/:id", requirePermissionAccess('canManageBranches'), async (req, res) => {
    try {
        const id = req.params.id;
        const branchData = req.body;
        const business = req.query.business;
        
        const updatedBranch = await Branch.findOneAndUpdate(
            { id: id, businessId: business },
            { 
                ...branchData,
                updatedAt: new Date()
            },
            { new: true }
        );
        
        if (!updatedBranch) {
            return res.status(404).json({ error: "Sucursal no encontrada" });
        }
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'branch-updated', updatedBranch);
        
        res.status(200).json({ 
            success: true, 
            branch: updatedBranch 
        });
    } catch (error) {
        console.error('Error updating branch:', error);
        res.status(500).json({ error: "Error al actualizar sucursal" });
    }
});

// Update branch schedule
router.put("/update-branch-schedule/:id", requirePermissionAccess('canManageBranches'), async (req, res) => {
    try {
        const id = req.params.id;
        const {schedule} = req.body;
        const business = req.query.business;
    
        
        // Validar que schedule sea un array
        if (!Array.isArray(schedule)) {
            return res.status(400).json({ error: "El schedule debe ser un array" });
        }
        
        // Validar que cada día del schedule tenga los campos requeridos
        for (let i = 0; i < schedule.length; i++) {
            const daySchedule = schedule[i];
            if (!daySchedule.day || !daySchedule.openTime || !daySchedule.closeTime) {
                return res.status(400).json({ 
                    error: `El día en posición ${i} debe tener day, openTime y closeTime válidos` 
                });
            }
            
            // Validar que day sea un string válido (0-6 o nombres de días)
            if (!['0', '1', '2', '3', '4', '5', '6', '0', '1', '2', '3', '4', '5', '6', '7'].includes(daySchedule.day)) {
                return res.status(400).json({ 
                    error: `El día en posición ${i} debe ser un número del 0-6 (0=Domingo, 1=Lunes, etc.)` 
                });
            }
            
            // Validar formato de tiempo (HH:MM)
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!timeRegex.test(daySchedule.openTime) || !timeRegex.test(daySchedule.closeTime)) {
                return res.status(400).json({ 
                    error: `Los horarios en posición ${i} deben tener formato HH:MM (ej: 08:00, 22:00)` 
                });
            }
            
            // Asegurar que los campos booleanos tengan valores por defecto
            if (daySchedule.isClosed === undefined) {
                schedule[i].isClosed = false;
            }
            if (daySchedule.isOpen === undefined) {
                schedule[i].isOpen = true;
            }
        }
        
        // Verificar que no haya días duplicados
        const days = schedule.map(day => day.day);
        const uniqueDays = [...new Set(days)];
        if (days.length !== uniqueDays.length) {
            return res.status(400).json({ error: "No puede haber días duplicados en el schedule" });
        }
        
        const updatedBranch = await Branch.findOneAndUpdate(
            { id: id, businessId: business },
            { 
                schedule: schedule,
                updatedAt: new Date()
            },
            { new: true }
        );
        
        if (!updatedBranch) {
            return res.status(404).json({ error: "Sucursal no encontrada" });
        }
        

        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'branch-schedule-updated', updatedBranch);
        
        res.status(200).json({ 
            success: true, 
            branch: updatedBranch 
        });
    } catch (error) {
        console.error('Error updating branch schedule:', error);
        res.status(500).json({ error: "Error al actualizar horario" });
    }
});

// Get branch schedule
router.get("/get-branch-schedule/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const business = req.query.business;
        
        const branch = await Branch.findOne({ 
            id: id, 
            businessId: business 
        });
        
        if (!branch) {
            return res.status(404).json({ error: "Sucursal no encontrada" });
        }
        
        res.status(200).json({ 
            schedule: branch.schedule || [] 
        });
    } catch (error) {
        console.error('Error getting branch schedule:', error);
        res.status(500).json({ error: "Error al obtener horario" });
    }
});

// Add delivery zone to branch
router.post("/add-delivery-zone/:branchId", requirePermissionAccess('canManageBranches'), async (req, res) => {
    try {
        const branchId = req.params.branchId;
        const zoneData = req.body;
        const business = req.query.business;
        

        
        // Validar estructura de la zona
        if (!zoneData.id || !zoneData.name || typeof zoneData.price !== 'number') {
            return res.status(400).json({ 
                error: "La zona debe tener id, name y price válidos" 
            });
        }
        
        // Asegurar que branchId esté presente en la zona
        const newZone = {
            ...zoneData,
            branchId: branchId
        };
        
        // Buscar la branch
        const branch = await Branch.findOne({ 
            id: branchId, 
            businessId: business 
        });
        
        if (!branch) {
            return res.status(404).json({ error: "Sucursal no encontrada" });
        }
        
        // Verificar si ya existe una zona con el mismo ID
        const existingZone = branch.zones.find(zone => zone.id === newZone.id);
        if (existingZone) {
            return res.status(400).json({ error: "Ya existe una zona con ese ID" });
        }
        
        // Usar findOneAndUpdate para agregar la zona sin validar otros campos
        const updatedBranch = await Branch.findOneAndUpdate(
            { id: branchId, businessId: business },
            { 
                $push: { zones: newZone },
                updatedAt: new Date()
            },
            { new: true }
        );
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'delivery-zone-added', {
            branchId,
            zone: newZone,
            branch: updatedBranch
        });
        
        res.status(200).json({ 
            success: true, 
            zone: newZone,
            branch: updatedBranch 
        });
    } catch (error) {
        console.error('Error adding delivery zone:', error);
        res.status(500).json({ error: "Error al agregar zona de entrega" });
    }
});

// Update specific delivery zone
router.put("/update-delivery-zone/:branchId/:zoneId", requirePermissionAccess('canManageBranches'), async (req, res) => {
    try {
        const branchId = req.params.branchId;
        const zoneId = req.params.zoneId;
        const zoneData = req.body;
        const business = req.query.business;
        

        
        // Validar estructura de la zona
        if (!zoneData.name || typeof zoneData.price !== 'number') {
            return res.status(400).json({ 
                error: "La zona debe tener name y price válidos" 
            });
        }
        
        // Buscar la branch y verificar que la zona existe
        const branch = await Branch.findOne({ 
            id: branchId, 
            businessId: business 
        });
        
        if (!branch) {
            return res.status(404).json({ error: "Sucursal no encontrada" });
        }
        
        // Verificar que la zona existe
        const zoneExists = branch.zones.find(zone => zone.id === zoneId);
        if (!zoneExists) {
            return res.status(404).json({ error: "Zona de entrega no encontrada" });
        }
        
        // Crear objeto con los datos actualizados
        const updatedZoneData = {
            ...zoneData,
            id: zoneId,
            branchId: branchId
        };
        
        // Usar findOneAndUpdate para actualizar la zona específica
        const updatedBranch = await Branch.findOneAndUpdate(
            { 
                id: branchId, 
                businessId: business,
                'zones.id': zoneId 
            },
            { 
                $set: {
                    'zones.$': updatedZoneData,
                    updatedAt: new Date()
                }
            },
            { new: true }
        );
        
        const updatedZone = updatedBranch.zones.find(zone => zone.id === zoneId);
        
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'delivery-zone-updated', {
            branchId,
            zoneId,
            zone: updatedZone,
            branch: updatedBranch
        });
        
        res.status(200).json({ 
            success: true, 
            zone: updatedZone,
            branch: updatedBranch 
        });
    } catch (error) {
        console.error('Error updating delivery zone:', error);
        res.status(500).json({ error: "Error al actualizar zona de entrega" });
    }
});

// Delete specific delivery zone
router.delete("/delete-delivery-zone/:branchId/:zoneId", requirePermissionAccess('canManageBranches'), async (req, res) => {
    try {
        const branchId = req.params.branchId;
        const zoneId = req.params.zoneId;
        const business = req.query.business;
        
        
        // Buscar la branch y verificar que la zona existe
        const branch = await Branch.findOne({ 
            id: branchId, 
            businessId: business 
        });
        
        if (!branch) {
            return res.status(404).json({ error: "Sucursal no encontrada" });
        }
        
        // Verificar que la zona existe y obtener sus datos antes de eliminar
        const zoneToDelete = branch.zones.find(zone => zone.id === zoneId);
        if (!zoneToDelete) {
            return res.status(404).json({ error: "Zona de entrega no encontrada" });
        }
        
        // Usar findOneAndUpdate para eliminar la zona
        const updatedBranch = await Branch.findOneAndUpdate(
            { id: branchId, businessId: business },
            { 
                $pull: { zones: { id: zoneId } },
                updatedAt: new Date()
            },
            { new: true }
        );
        
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'delivery-zone-deleted', {
            branchId,
            zoneId,
            deletedZone: zoneToDelete,
            branch: updatedBranch
        });
        
        res.status(200).json({ 
            success: true, 
            deletedZone: zoneToDelete,
            branch: updatedBranch 
        });
    } catch (error) {
        console.error('Error deleting delivery zone:', error);
        res.status(500).json({ error: "Error al eliminar zona de entrega" });
    }
});

// Update branch delivery zones
router.put("/update-branch-delivery-zones/:id", requirePermissionAccess('canManageBranches'), async (req, res) => {
    try {
        const id = req.params.id;
        const deliveryZones = req.body.zones;
        const business = req.query.business;
        
        // Validar que deliveryZones sea un array
        if (!Array.isArray(deliveryZones)) {
            return res.status(400).json({ error: "deliveryZones debe ser un array" });
        }
        
        // Validar estructura de cada zona
        for (let i = 0; i < deliveryZones.length; i++) {
            const zone = deliveryZones[i];
            if (!zone.id || !zone.name || typeof zone.price !== 'number') {
                return res.status(400).json({ 
                    error: `Zona en posición ${i} debe tener id, name y price válidos` 
                });
            }
            // Asegurar que branchId esté presente
            if (!zone.branchId) {
                zone.branchId = id;
            }
        }
        
        const updatedBranch = await Branch.findOneAndUpdate(
            { id: id, businessId: business },
            { 
                zones: deliveryZones,
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!updatedBranch) {
            return res.status(404).json({ error: "Sucursal no encontrada" });
        }

        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'branch-zones-updated', updatedBranch);
        
        res.status(200).json({ 
            success: true, 
            branch: updatedBranch 
        });
    } catch (error) {
        console.error('Error updating branch delivery zones:', error);
        res.status(500).json({ error: "Error al actualizar zonas de entrega" });
    }
});

// Get branch delivery zones
router.get("/get-branch-delivery-zones/:branchId", async (req, res) => {
    try {
        const branchId = req.params.branchId;
        const business = req.query.business;
        
        const branch = await Branch.findOne({ 
            id: branchId, 
            businessId: business 
        });
        
        if (!branch) {
            return res.status(404).json({ error: "Sucursal no encontrada" });
        }
        
        res.status(200).json({ 
            deliveryZones: branch.zones || [] 
        });
    } catch (error) {
        console.error('Error getting branch delivery zones:', error);
        res.status(500).json({ error: "Error al obtener zonas de entrega" });
    }
});

// Get Branch by id
router.get("/get-branch-by-id/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const business = req.query.business;
        
        const branch = await Branch.findOne({ 
            id: id, 
            businessId: business 
        });
        
        if (!branch) {
            return res.status(404).json({ error: "Sucursal no encontrada" });
        }
        
        res.status(200).json({ branch });
    } catch (error) {
        console.error('Error getting branch by id:', error);
        res.status(500).json({ error: "Error al obtener sucursal" });
    }
});

// Get all branches
router.get("/get-all-branches", async (req, res) => {
    try {
        const business = req.query.business;
        
        const branches = await Branch.find({ 
            businessId: business,
            isActive: true 
        }).sort({ createdAt: -1 });
        
        res.status(200).json({ branches });
    } catch (error) {
        console.error('Error getting all branches:', error);
        res.status(500).json({ error: "Error al obtener sucursales" });
    }
});

export default router;