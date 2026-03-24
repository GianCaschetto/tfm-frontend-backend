import mongoose from 'mongoose';

const dayScheduleSchema = new mongoose.Schema({
  day: {
    type: String,
    required: true
  },
  openTime: {
    type: String,
    required: true
  },
  closeTime: {
    type: String,
    required: true
  },
  isClosed: {
    type: Boolean,
    default: false
  },
  isOpen: {
    type: Boolean,
    default: true
  }
});

const deliveryZoneSchema = new mongoose.Schema({
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
  branchId: {
    type: String,
    required: true
  }
});

const branchSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
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
  address: {
    type: String,
    required: true
  },
  schedule: [dayScheduleSchema],
  zones: [deliveryZoneSchema],
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

// Compound index for businessId and name
branchSchema.index({ businessId: 1, name: 1 });

export default mongoose.model('Branch', branchSchema); 