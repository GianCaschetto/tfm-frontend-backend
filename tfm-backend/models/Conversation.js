import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'model', 'function'],
    required: true
  },
  content: {
    type: String,
    default: ''
  },
  functionCall: {
    name: String,
    args: mongoose.Schema.Types.Mixed
  },
  functionResponse: {
    name: String,
    response: mongoose.Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const pendingActionSchema = new mongoose.Schema({
  actionType: {
    type: String,
    required: true
  },
  params: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const conversationSchema = new mongoose.Schema({
  businessId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    default: 'Nueva conversación'
  },
  messages: [messageSchema],
  pendingAction: {
    type: pendingActionSchema,
    default: null
  },
  metadata: {
    totalTokens: {
      type: Number,
      default: 0
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

conversationSchema.index({ businessId: 1, userId: 1, isActive: 1 });
conversationSchema.index({ businessId: 1, updatedAt: -1 });

export default mongoose.model('Conversation', conversationSchema);
