import mongoose from 'mongoose';

const extraGroupSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  businessId: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['quantity', 'select'],
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  categoryIds: [{
    type: String
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
    },
    min: {
      type: Number,
      default: 0
    },
    max: {
      type: Number,
      default: null
    },
    required: {
      type: Boolean,
      default: false
    }
  }],
  maxSelectable: {
    type: Number,
    default: null
  },
  required: {
    type: Boolean,
    default: false
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

export default mongoose.model('ExtraGroups', extraGroupSchema); 