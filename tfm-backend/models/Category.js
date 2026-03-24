import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
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
  productCount: {
    type: Number,
    default: 0
  },
  order: {
    type: Number,
    default: 0
  },
  color: {
    type: String,
    default: null
  },
  icon: {
    type: String,
    default: null
  },
  availability: {
    always: {
      type: Boolean,
      default: true
    },
    days: {
      type: [String],
      default: []
    }
  },
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

// Compound index for businessId and order
categorySchema.index({ businessId: 1, order: 1 });
categorySchema.index({ businessId: 1, id: 1 });

export default mongoose.model('Category', categorySchema); 