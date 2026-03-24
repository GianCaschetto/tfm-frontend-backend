import User from '../models/User.js';

// Middleware para verificar autenticación basado en UID
export const authenticate = async (req, res, next) => {
  try {
    // Obtener UID desde headers o query params
    const uid = req.header('X-User-UID') || req.query.uid;
    const businessId = req.query.business;
    if (!uid) {
      return res.status(401).json({ error: 'UID de usuario requerido' });
    }

    // Find user in our database using UID
    const user = await User.findOne({ 
      uid: uid,
      businessId: businessId,
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado en la base de datos' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Error de autenticación' });
  }
};

// Middleware para verificar que el usuario sea admin
export const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Autenticación requerida' });
    }

    if (!req.user.isAdmin()) {
      return res.status(403).json({ error: 'Acceso denegado. Permisos de administrador requeridos' });
    }

    next();
  } catch (error) {
    console.error('Authorization error:', error);
    res.status(403).json({ error: 'Error de autorización' });
  }
};

// Middleware para verificar permisos específicos
export const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Autenticación requerida' });
      }

      if (!req.user.hasPermission(permission)) {
        return res.status(403).json({ 
          error: `Acceso denegado. Permiso '${permission}' requerido` 
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(403).json({ error: 'Error al verificar permisos' });
    }
  };
};

// Middleware para verificar que el usuario pertenezca al negocio
export const requireBusinessAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Autenticación requerida' });
    }

    const business = req.query.business || req.params.business;

    if (!business) {
      return res.status(400).json({ error: 'Business parameter requerido' });
    }

    if (req.user.businessId !== business) {
      return res.status(403).json({ error: 'Acceso denegado a este negocio' });
    }

    next();
  } catch (error) {
    console.error('Business access error:', error);
    res.status(403).json({ error: 'Error al verificar acceso al negocio' });
  }
};

// Middleware combinado para admin + business access
export const requireAdminAccess = [authenticate, requireBusinessAccess, requireAdmin];

// Middleware combinado para permisos específicos + business access
export const requirePermissionAccess = (permission) => [
  authenticate, 
  requireBusinessAccess, 
  requirePermission(permission)
]; 