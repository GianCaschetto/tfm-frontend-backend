import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  businessId: {
    type: String,
    required: true,
    index: true
  },
  id: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  price: {
    type: Number,
    required: true
  },
  image: {
    src: {
      type: String,
      default: ''
    },
    width: {
      type: Number,
      default: 0
    },
    height: {
      type: Number,
      default: 0
    }
  },
  categoryId: {
    type: String,
    required: true,
    index: true
  },
  availability: [{
    branchId: {
      type: String,
      required: true
    },
    isAvailable: {
      type: Boolean,
      default: true
    }
  }],
  extras: [{
    id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    }
  }],
  stockId: {
    type: String,
    default: null
  },
  extraGroupIds: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
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

// Compound indexes
productSchema.index({ businessId: 1, categoryId: 1 });
productSchema.index({ businessId: 1, isActive: 1 });
productSchema.index({ 'availability.branchId': 1 });

// Virtual for backward compatibility
productSchema.virtual('isAvailable').get(function() {
  // Check if product is available in any branch
  return this.availability.some(avail => avail.isAvailable);
});

// Ensure virtuals are serialized
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

export default mongoose.model('Product', productSchema); 