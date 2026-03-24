import mongoose from 'mongoose';

const selectedExtraSchema = new mongoose.Schema({
  extraId: {
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
  quantity: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['quantity', 'select'],
    required: true
  },
  groupId: {
    type: String,
    default: null
  }
});

const cartItemSchema = new mongoose.Schema({
  product: {
    id: String,
    name: String,
    description: String,
    price: Number,
    image: {
      src: String,
      width: Number,
      height: Number
    },
    categoryId: String,
    availability: [{
      branchId: String,
      isAvailable: Boolean
    }],
    extras: [{
      id: String,
      name: String,
      price: Number
    }],
    stockId: {
      type: String,
      default: null
    },
    extraGroupIds: [String]
  },
  quantity: {
    type: Number,
    required: true
  },
  selectedExtras: [selectedExtraSchema],
  specialRequest: {
    type: String,
    default: null
  }
});

const userInfoSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    default: null
  },
  phone: {
    type: String,
    required: true
  },
  address: {
    type: String,
    default: null
  },
  deliveryType: {
    type: String,
    default: null
  },
  deliveryZoneId: {
    type: String,
    default: null
  }
});

const orderSchema = new mongoose.Schema({
  id: {
    type: String,
    default: null
  },
  businessId: {
    type: String,
    required: true,
    index: true
  },
  orderNumber: {
    type: String,
    required: true,
    unique: true
  },
  userInfo: userInfoSchema,
  branch: {
    id: String,
    name: String,
    address: String,
    schedule: [{
      day: String,
      openTime: String,
      closeTime: String,
      isClosed: Boolean,
      isOpen: Boolean
    }],
    zones: [{
      type: mongoose.Schema.Types.Mixed
    }]
  },
  items: [cartItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  total: {
    type: Number,
    required: true
  },
  deliveryFee: {
    type: Number,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid'],
    default: 'pending'
  },
  specialRequest: {
    type: String,
    default: null
  },
  totalBs: {
    type: Number,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  isNew: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
orderSchema.index({ businessId: 1, status: 1 });
orderSchema.index({ businessId: 1, createdAt: -1 });
orderSchema.index({ businessId: 1, orderNumber: 1 });

export default mongoose.model('Order', orderSchema); 