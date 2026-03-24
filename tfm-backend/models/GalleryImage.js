import mongoose from 'mongoose';

const imagesSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  businessId: {
    type: String,
    required: true,
    index: true
  },
  url: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  size: {
    type: String,
    default: null
  },
  dimensionsWidth: {
    type: String,
    default: null
  },
  dimensionsHeight: {
    type: String,
    default: null
  },
  type: {
    type: String,
    default: null
  },
  usedIn: [{
    type: String // Product IDs that use this image
  }],
  storagePath: {
    type: String,
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

// Compound indexes
imagesSchema.index({ businessId: 1, id: 1 });
imagesSchema.index({ businessId: 1, usedIn: 1 });

export default mongoose.model('Images', imagesSchema); 