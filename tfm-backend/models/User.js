import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  uid: {
    type: String,
    required: true,
    index: true
  },
  businessId: {
    type: String,
    required: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  admin: {
    type: Boolean,
    default: false
  },
  employee: {
    type: Boolean,
    default: false
  },
  permissions: {
    canManageOrders: {
      type: Boolean,
      default: false
    },
    canManageProducts: {
      type: Boolean,
      default: false
    },
    canManageCategories: {
      type: Boolean,
      default: false
    },
    canManageExtras: {
      type: Boolean,
      default: false
    },
    canManageBranches: {
      type: Boolean,
      default: false
    },
    canManageSettings: {
      type: Boolean,
      default: false
    },
    canViewAnalytics: {
      type: Boolean,
      default: false
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
userSchema.index({ businessId: 1, admin: 1 });
userSchema.index({ businessId: 1, employee: 1 });
userSchema.index({ email: 1, businessId: 1 });

// Check if user is admin
userSchema.methods.isAdmin = function() {
  return this.admin === true;
};

// Check if user has specific permission
userSchema.methods.hasPermission = function(permission) {
  if (this.admin) return true; // Admin has all permissions
  
  // Employees can manage products
  if (this.employee && permission === 'canManageProducts') {
    return true;
  }
  
  return this.permissions[permission] === true;
};

// Virtual for full permissions (admin gets all, employee gets specific ones)
userSchema.virtual('fullPermissions').get(function() {
  if (this.admin) {
    return {
      canManageOrders: true,
      canManageProducts: true,
      canManageCategories: true,
      canManageExtras: true,
      canManageBranches: true,
      canManageSettings: true,
      canViewAnalytics: true
    };
  }
  
  if (this.employee) {
    return {
      canManageOrders: this.permissions.canManageOrders || false,
      canManageProducts: true, // Employees can always manage products
      canManageCategories: this.permissions.canManageCategories || false,
      canManageExtras: this.permissions.canManageExtras || false,
      canManageBranches: this.permissions.canManageBranches || false,
      canManageSettings: this.permissions.canManageSettings || false,
      canViewAnalytics: this.permissions.canViewAnalytics || false
    };
  }
  
  return this.permissions;
});

// Ensure virtuals are serialized
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

export default mongoose.model('User', userSchema); 