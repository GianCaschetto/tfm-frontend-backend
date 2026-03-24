import mongoose from 'mongoose';

const generalSettingsSchema = new mongoose.Schema({
  restaurantName: {
    type: String,
    required: true
  },
  tagline: {
    type: String,
    default: null
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  website: {
    type: String,
    default: null
  },
  defaultBranch: {
    type: String,
    required: true
  },
  currency: {
    type: String,
    required: true
  },
  
});

const appearanceSettingsSchema = new mongoose.Schema({
  theme: {
    type: String,
    enum: ['light', 'dark', 'system'],
    default: 'light'
  },
  primaryColor: {
    type: String,
    required: true
  },
  accentColor: {
    type: String,
    required: true
  },
  logo: {
    url: String,
    width: Number,
    height: Number,

  },
  favicon: {
    type: String,
    default: null
  },
  showBranchSelector: {
    type: Boolean,
    default: true
  },
  showCurrencySymbol: {
    type: Boolean,
    default: true
  },
  dateFormat: {
    type: String,
    default: 'MM/DD/YYYY'
  },
  timeFormat: {
    type: String,
    enum: ['12h', '24h'],
    default: '12h'
  }
});

const paymentSettingsSchema = new mongoose.Schema({
  paymentMethods: [{
    type: String
  }],
  enableVenezuelanBs: {
    type: Boolean,
    default: false
  },
  bcvRate: {
    type: Number,
    default: 0
  },
  eurRate: {
    type: Number,
    default: 0
  },
  customRate: {
    type: Number,
    default: null
  },
  pagoMovil: {
    type: Boolean,
    default: false
  },
  preferredRateSource: {
    type: String,
    enum: ['bcv', 'eur', 'custom'],
    default: 'bcv'
  }
});

const whatsAppSettingsSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: false
  },
  defaultPhoneNumber: {
    type: String,
    required: true
  },
  messageTemplate: {
    type: String,
    required: true
  },
  branchPhoneNumbers: [{
    branchId: String,
    phoneNumbers: [{
      id: String,
      phoneNumber: String,
      label: String
    }]
  }]
});

const notificationSettingsSchema = new mongoose.Schema({
  // Add notification settings as needed
  emailNotifications: {
    type: Boolean,
    default: true
  },
  smsNotifications: {
    type: Boolean,
    default: false
  },
  whatsappNotifications: {
    type: Boolean,
    default: true
  }
});

const settingsSchema = new mongoose.Schema({
  businessId: {
    type: String,
    required: true,
    index: true,
    unique: true
  },
  general: {
    type: generalSettingsSchema,
    required: true
  },
  appearance: {
    type: appearanceSettingsSchema,
    required: true
  },
  payment: {
    type: paymentSettingsSchema,
    required: true
  },
  whatsapp: {
    type: whatsAppSettingsSchema,
    required: true
  },
  notifications: {
    type: notificationSettingsSchema,
    required: true
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

export default mongoose.model('Settings', settingsSchema); 