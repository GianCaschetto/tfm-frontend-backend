import { Router } from 'express';
import Settings from './models/Settings.js';
import websocketService from './services/websocketService.js';
import { requirePermissionAccess } from './middleware/auth.js';

// ✅ Cache simple para evitar consultas repetitivas
const settingsCache = new Map();
const CACHE_TTL = 30 * 1000; // 30 segundos

const getCachedSettings = async (businessId) => {
    const cacheKey = `settings_${businessId}`;
    const cached = settingsCache.get(cacheKey);
    
    // Verificar si está en cache y no ha expirado
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.data;
    }
    
    // Buscar en base de datos
    const settings = await Settings.findOne({ businessId });
    
    // Guardar en cache
    if (settings) {
        settingsCache.set(cacheKey, {
            data: settings,
            timestamp: Date.now()
        });
        console.log(`📋 [CACHE SET] Settings para ${businessId} guardados en cache`);
    }
    
    return settings;
};

const clearSettingsCache = (businessId) => {
    const cacheKey = `settings_${businessId}`;
    settingsCache.delete(cacheKey);
};

const router = Router();

// Save general settings
router.post("/save-general-settings", requirePermissionAccess('canManageSettings'), async (req, res) => {
    try {
        const {settings} = req.body;
    
        const business = req.query.business;
        
        const updatedSettings = await Settings.findOneAndUpdate(
            { businessId: business },
            { 
                businessId: business,
                general: settings,
                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );
        
        // ✅ Limpiar cache después de actualización
        clearSettingsCache(business);
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'settings-updated', {
            type: 'general',
            settings: updatedSettings
        });
        
        res.status(200).json({ 
            message: "Settings saved successfully",
            settings: updatedSettings 
        });
    } catch (error) {
        console.error('Error saving general settings:', error);
        res.status(500).json({ error: "Error al guardar configuración general" });
    }
});

// Save appearance settings
router.post("/save-appearance-settings", requirePermissionAccess('canManageSettings'), async (req, res) => {
    try {
        const {settings} = req.body;
        const business = req.query.business;

        // Validar campos requeridos
        if (!settings.primaryColor || !settings.accentColor) {
            return res.status(400).json({ 
                error: "Los campos primaryColor y accentColor son requeridos" 
            });
        }
        
        const updatedSettings = await Settings.findOneAndUpdate(
            { businessId: business },
            { 
                businessId: business,
                appearance: settings,
                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'settings-updated', {
            type: 'appearance',
            settings: updatedSettings
        });
        
        res.status(200).json({ 
            message: "Settings saved successfully",
            settings: updatedSettings 
        });
    } catch (error) {
        console.error('Error saving appearance settings:', error);
        res.status(500).json({ error: "Error al guardar configuración de apariencia" });
    }
});

// Save payment settings
router.post("/save-payment-settings", requirePermissionAccess('canManageSettings'), async (req, res) => {
    try {
        const {settings} = req.body;
        const business = req.query.business;
        
        const updatedSettings = await Settings.findOneAndUpdate(
            { businessId: business },
            { 
                businessId: business,
                payment: settings,
                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'settings-updated', {
            type: 'payment',
            settings: updatedSettings
        });
        
        res.status(200).json({ 
            message: "Settings saved successfully",
            settings: updatedSettings 
        });
    } catch (error) {
        console.error('Error saving payment settings:', error);
        res.status(500).json({ error: "Error al guardar configuración de pago" });
    }
});

// Save whatsapp settings
router.post("/save-whatsapp-settings", requirePermissionAccess('canManageSettings'), async (req, res) => {
    try {
        const {settings} = req.body;
        const business = req.query.business;
        
        const updatedSettings = await Settings.findOneAndUpdate(
            { businessId: business },
            { 
                businessId: business,
                whatsapp: settings,
                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'settings-updated', {
            type: 'whatsapp',
            settings: updatedSettings
        });
        
        res.status(200).json({ 
            message: "Settings saved successfully",
            settings: updatedSettings 
        });
    } catch (error) {
        console.error('Error saving whatsapp settings:', error);
        res.status(500).json({ error: "Error al guardar configuración de WhatsApp" });
    }
});

// Save notifications settings
router.post("/save-notifications-settings", requirePermissionAccess('canManageSettings'), async (req, res) => {
    try {
        const {settings} = req.body;
        const business = req.query.business;
        
        const updatedSettings = await Settings.findOneAndUpdate(
            { businessId: business },
            { 
                businessId: business,
                notifications: settings,
                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'settings-updated', {
            type: 'notifications',
            settings: updatedSettings
        });
        
        res.status(200).json({ 
            message: "Settings saved successfully",
            settings: updatedSettings 
        });
    } catch (error) {
        console.error('Error saving notifications settings:', error);
        res.status(500).json({ error: "Error al guardar configuración de notificaciones" });
    }
});

// Get settings by type
router.get("/get-settings/:business/:type", async (req, res) => {
    try {
        const business = req.params.business;
        const type = req.params.type;
    
        // ✅ Usar cache para obtener settings
        const settings = await getCachedSettings(business);
        
        if (!settings) {
            return res.status(404).json({ error: "Configuración no encontrada" });
        }
        
        // Obtener la sección específica según el tipo
        let sectionData = null;
        switch (type) {
            case 'general':
                sectionData = settings.general;
                break;
            case 'appearance':
                sectionData = settings.appearance;
                break;
            case 'payment':
                sectionData = settings.payment;
                break;
            case 'whatsapp':
                sectionData = settings.whatsapp;
                break;
            case 'notifications':
                sectionData = settings.notifications;
                break;
            default:
                return res.status(400).json({ error: "Tipo de configuración no válido" });
        }
        
        res.status(200).json({ 
            settings: sectionData,
            type: type 
        });
    } catch (error) {
        console.error('Error getting settings:', error);
        res.status(500).json({ error: "Error al obtener configuración" });
    }
});

// Get all settings for a business
router.get("/get-all-settings", async (req, res) => {
    try {
        const business = req.query.business;
    
        // ✅ Usar cache para obtener settings
        const settings = await getCachedSettings(business);
       
        if (!settings) {
            return res.status(404).json({ error: "Configuración no encontrada" });
        }
        
        // Organizar por tipo
        const organizedSettings = {
            general: settings.general,
            appearance: settings.appearance,
            payment: settings.payment,
            whatsapp: settings.whatsapp,
            notifications: settings.notifications
        };
        
        res.status(200).json({ 
            settings: organizedSettings 
        });
    } catch (error) {
        console.error('Error getting all settings:', error);
        res.status(500).json({ error: "Error al obtener todas las configuraciones" });
    }
});

// Delete settings by type
router.delete("/delete-settings/:type", async (req, res) => {
    try {
        const type = req.params.type;
        const business = req.query.business;
        
        // Para la nueva estructura, no eliminamos todo el documento, solo limpiamos la sección específica
        const updateData = {};
        updateData[type] = null; // Esto limpiará la sección específica
        
        const updatedSettings = await Settings.findOneAndUpdate(
            { businessId: business },
            { 
                $unset: updateData,
                updatedAt: new Date()
            },
            { new: true }
        );
        
        if (!updatedSettings) {
            return res.status(404).json({ error: "Configuración no encontrada" });
        }
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'settings-deleted', {
            type: type
        });
        
        res.status(200).json({ 
            message: "Settings deleted successfully" 
        });
    } catch (error) {
        console.error('Error deleting settings:', error);
        res.status(500).json({ error: "Error al eliminar configuración" });
    }
});

export default router;