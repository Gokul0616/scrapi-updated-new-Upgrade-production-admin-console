const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  fullName: {
    type: String,
    default: ''
  },
  organization: {
    type: String,
    default: ''
  },
  avatar: {
    type: String,
    default: 'https://customer-assets.emergentagent.com/job_gmap-extract-pay/artifacts/ngzacwyp_image.png'
  },
  plan: {
    type: String,
    enum: ['free', 'starter', 'scale', 'business', 'enterprise'],
    default: 'free'
  },
  usage: {
    ramUsedMB: {
      type: Number,
      default: 0
    },
    ramLimitMB: {
      type: Number,
      default: 8192 // 8 GB for free plan
    },
    creditsUsed: {
      type: Number,
      default: 0
    },
    creditsLimit: {
      type: Number,
      default: 5 // $5 for free plan
    },
    storageUsedMB: {
      type: Number,
      default: 0
    }
  },
  apiTokens: [{
    name: {
      type: String,
      required: true
    },
    token: {
      type: String,
      required: true,
      unique: true,
      sparse: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastUsed: {
      type: Date,
      default: null
    }
  }],
  bookmarkedActors: [{
    type: String, // actorId
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notifications: {
    email: {
      type: Boolean,
      default: true
    },
    platform: {
      type: Boolean,
      default: true
    },
    actorRuns: {
      type: Boolean,
      default: true
    },
    billing: {
      type: Boolean,
      default: true
    }
  },
  chatbotPermissions: {
    enabled: {
      type: Boolean,
      default: false
    },
    fullAccess: {
      type: Boolean,
      default: false
    },
    lastUpdated: {
      type: Date,
      default: null
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for performance
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ 'apiTokens.token': 1 }, { sparse: true });

// Method to get usage percentage
userSchema.methods.getRamUsagePercentage = function () {
  return (this.usage.ramUsedMB / this.usage.ramLimitMB) * 100;
};

userSchema.methods.getCreditsUsagePercentage = function () {
  return (this.usage.creditsUsed / this.usage.creditsLimit) * 100;
};

module.exports = mongoose.model('User', userSchema);
