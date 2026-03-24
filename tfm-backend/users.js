import { Router } from 'express';
import User from './models/User.js';
import { authenticate, requireAdminAccess, requireBusinessAccess } from './middleware/auth.js';
import websocketService from './services/websocketService.js';

const router = Router();

// Get current user
router.get("/me", authenticate, async (req, res) => {
    res.status(200).json({
        user: {
            id: req.user._id,
            uid: req.user.uid,
            email: req.user.email,
            name: req.user.name,
            admin: req.user.admin,
            employee: req.user.employee,
            permissions: req.user.fullPermissions,
            businessId: req.user.businessId
        }
    });
});

// Get user by UID
router.get("/get-user-by-uid", authenticate, async (req, res) => {
    try {
        const uid = req.query.uid;
        const business = req.query.business;
        
        if (!uid) {
            return res.status(400).json({ error: "UID es requerido" });
        }
        
        const user = await User.findOne({ 
            uid,
            businessId: business,
    
        })

        
        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }
        
        res.status(200).json({
            user: {
                id: user._id,
                uid: user.uid,
                email: user.email,
                name: user.name,
                admin: user.admin,
                employee: user.employee,
                permissions: user.fullPermissions,
                businessId: user.businessId
            }
        });
    } catch (error) {
        console.error('Get user by UID error:', error);
        res.status(500).json({ error: "Error al obtener usuario por UID" });
    }
});

// Create user (only admin)
router.post("/create-user", requireAdminAccess, async (req, res) => {
    try {
        const { uid, email, name, admin, employee, permissions } = req.body;
        const business = req.query.business;
        
        if (!uid || !email || !name) {
            return res.status(400).json({ error: "UID, email y name son requeridos" });
        }
        
        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [
                { email: email.toLowerCase() },
                { uid }
            ]
        });
        
        if (existingUser) {
            return res.status(400).json({ error: "Usuario ya existe" });
        }
        
        const user = new User({
            uid,
            businessId: business,
            email: email.toLowerCase(),
            name,
            admin: admin || false,
            employee: employee || false,
            permissions: permissions || {}
        });
        
        const savedUser = await user.save();
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'user-created', {
            id: savedUser._id,
            uid: savedUser.uid,
            email: savedUser.email,
            name: savedUser.name,
            admin: savedUser.admin,
            employee: savedUser.employee
        });
        
        res.status(200).json({
            success: true,
            user: {
                id: savedUser._id,
                uid: savedUser.uid,
                email: savedUser.email,
                name: savedUser.name,
                admin: savedUser.admin,
                employee: savedUser.employee,
                permissions: savedUser.fullPermissions
            }
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: "Error al crear usuario" });
    }
});

// Get all users (only admin)
router.get("/get-users", requireAdminAccess, async (req, res) => {
    try {
        const business = req.query.business;
        
        const users = await User.find({ 
            businessId: business,
            isActive: true 
        }).select('-password').sort({ createdAt: -1 });
        
        res.status(200).json({ users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: "Error al obtener usuarios" });
    }
});

// Update user (only admin)
router.put("/update-user/:id", requireAdminAccess, async (req, res) => {
    try {
        const id = req.params.id;
        const { name, admin, employee, permissions, isActive } = req.body;
        const business = req.query.business;
        
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (admin !== undefined) updateData.admin = admin;
        if (employee !== undefined) updateData.employee = employee;
        if (permissions !== undefined) updateData.permissions = permissions;
        if (isActive !== undefined) updateData.isActive = isActive;
        updateData.updatedAt = new Date();
        
        const updatedUser = await User.findOneAndUpdate(
            { _id: id, businessId: business },
            updateData,
            { new: true }
        ).select('-password');
        
        if (!updatedUser) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'user-updated', {
            id: updatedUser._id,
            uid: updatedUser.uid,
            email: updatedUser.email,
            name: updatedUser.name,
            admin: updatedUser.admin,
            employee: updatedUser.employee,
            isActive: updatedUser.isActive
        });
        
        res.status(200).json({
            success: true,
            user: {
                id: updatedUser._id,
                uid: updatedUser.uid,
                email: updatedUser.email,
                name: updatedUser.name,
                admin: updatedUser.admin,
                employee: updatedUser.employee,
                permissions: updatedUser.fullPermissions,
                isActive: updatedUser.isActive
            }
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: "Error al actualizar usuario" });
    }
});

// Delete user (only admin)
router.delete("/delete-user/:id", requireAdminAccess, async (req, res) => {
    try {
        const id = req.params.id;
        const business = req.query.business;
        
        // Don't allow deleting yourself
        if (req.user._id.toString() === id) {
            return res.status(400).json({ error: "No puedes eliminar tu propia cuenta" });
        }
        
        const deletedUser = await User.findOneAndUpdate(
            { _id: id, businessId: business },
            { isActive: false, updatedAt: new Date() },
            { new: true }
        );
        
        if (!deletedUser) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'user-deleted', { id });
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: "Error al eliminar usuario" });
    }
});

export default router; 