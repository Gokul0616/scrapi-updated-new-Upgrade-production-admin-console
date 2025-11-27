const mongoose = require('mongoose');

const actorSchema = new mongoose.Schema({
  actorId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  author: { type: String, required: true },
  slug: { type: String, required: true },
  category: { type: String, required: true },
  icon: { type: String },
  stats: {
    runs: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 }
  },
  pricingModel: { type: String, default: 'Pay per result' },
  isBookmarked: { type: Boolean, default: false },
  // Dynamic field schemas for frontend
  inputFields: { type: Array, default: [] },
  outputFields: { type: Array, default: [] },
  // User-specific fields
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // null means public/store actor
  },
  isPublic: {
    type: Boolean,
    default: true // true = visible in store, false = private user actor
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for efficient queries
actorSchema.index({ userId: 1, isPublic: 1 });
actorSchema.index({ actorId: 1 });

module.exports = mongoose.model('Actor', actorSchema);