const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  
  mechanicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mechanic',
    default: null
  },
  
  vehicleType: {
    type: String,
    enum: ['bike', 'car', 'truck', 'bus', 'cng', 'rickshaw'],
    required: [true, 'Vehicle type is required']
  },
  
  problemType: {
    type: String,
    enum: [
      'engine_repair',
      'tire_change',
      'battery_jump',
      'electrical_repair',
      'brake_repair',
      'oil_change',
      'fuel_delivery',
      'lockout_service',
      'towing',
      'general_repair',
      'emergency_service',
      'other'
    ],
    required: [true, 'Problem type is required']
  },

  // Optional: allow selecting multiple specific services for transparent billing
  selectedServices: [{
    key: { type: String },          // e.g. 'tire_change'
    label: { type: String },        // human label at time of request
    unitPrice: { type: Number, min: 0, default: 0 }, // price applied for this service
    notes: { type: String, default: '' }
  }],

  vehicleMultiplier: { type: Number, default: 1 },
  
  description: {
    type: String,
    required: [true, 'Problem description is required'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  pickupLocation: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: [true, 'Pickup coordinates are required']
    },
    address: {
      type: String,
      required: [true, 'Pickup address is required']
    },
    landmark: {
      type: String,
      default: ''
    }
  },
  
  status: {
    type: String,
    enum: [
      'accepted',    // Mechanic accepted (compat with frontend)
      'pending',      // Request created, waiting for mechanic
      'active',       // Mechanic accepted the request
      'in_progress',  // Mechanic is on the way (legacy)
      'on_way',       // Mechanic is on the way (compat with frontend)
      'arrived',      // Mechanic has arrived
      'working',      // Mechanic is working on the vehicle
      'completed',    // Job completed successfully
      'cancelled',    // Request cancelled by user
      'rejected',     // Request rejected by mechanic
      'failed'        // Job failed or couldn't be completed
    ],
    default: 'pending'
  },
  
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'emergency'],
    default: 'medium'
  },
  
  estimatedCost: {
    type: Number,
    min: [0, 'Cost cannot be negative'],
    default: 0
  },

  // Optional estimated cost range (min/max). When present, payments can be any
  // amount within this range. This mirrors the UI that shows ranges per
  // mechanic/service (e.g., 300 - 3000).
  estimatedCostRange: {
    min: { type: Number, min: [0, 'Cost cannot be negative'], default: 0 },
    max: { type: Number, min: [0, 'Cost cannot be negative'], default: 0 }
  },
  
  actualCost: {
    type: Number,
    min: [0, 'Cost cannot be negative'],
    default: 0
  },
  
  paymentStatus: {
    type: String,
    enum: ['none', 'payment_pending', 'payment_processing', 'payment_completed', 'payment_failed', 'refunded'],
    default: 'none'
  },
  
  paymentMethod: {
    type: String,
    enum: ['cash', 'bkash', 'nagad', 'rocket', 'card'],
    default: 'cash'
  },

  // Track related payments
  payments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }],
  
  timeline: {
    requestedAt: {
      type: Date,
      default: Date.now
    },
    acceptedAt: {
      type: Date,
      default: null
    },
    arrivedAt: {
      type: Date,
      default: null
    },
    startedAt: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  
  rating: {
    userRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    mechanicRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    userComment: {
      type: String,
      maxlength: [300, 'Comment cannot exceed 300 characters'],
      default: ''
    },
    mechanicComment: {
      type: String,
      maxlength: [300, 'Comment cannot exceed 300 characters'],
      default: ''
    }
  },
  
  images: {
    beforeWork: [{
      url: String,
      description: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    afterWork: [{
      url: String,
      description: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  
  notes: [{
    author: {
      type: String,
      enum: ['user', 'mechanic', 'admin'],
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: [200, 'Note cannot exceed 200 characters']
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  cancellationReason: {
    type: String,
    maxlength: [200, 'Cancellation reason cannot exceed 200 characters'],
    default: ''
  },
  
  isEmergency: {
    type: Boolean,
    default: false
  },
  
  estimatedArrivalTime: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create indexes for efficient queries
requestSchema.index({ userId: 1, createdAt: -1 });
requestSchema.index({ mechanicId: 1, createdAt: -1 });
requestSchema.index({ status: 1 });
requestSchema.index({ pickupLocation: '2dsphere' });
requestSchema.index({ vehicleType: 1 });
requestSchema.index({ priority: 1 });
requestSchema.index({ 'timeline.requestedAt': -1 });
// Compound indexes for common queries
requestSchema.index({ _id: 1, userId: 1 }); // For request access checks
requestSchema.index({ _id: 1, mechanicId: 1 }); // For mechanic access checks
requestSchema.index({ status: 1, createdAt: -1 }); // For status-based queries with sorting

// Virtual populate user and mechanic data
requestSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

requestSchema.virtual('mechanic', {
  ref: 'Mechanic',
  localField: 'mechanicId',
  foreignField: '_id',
  justOne: true
});

// Pre-save middleware to update timeline
requestSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    const now = new Date();
    
    switch (this.status) {
      case 'accepted':
      case 'active':
        if (!this.timeline.acceptedAt) {
          this.timeline.acceptedAt = now;
        }
        break;
      case 'on_way':
      case 'in_progress':
        if (!this.timeline.startedAt) {
          this.timeline.startedAt = now;
        }
        break;
      case 'arrived':
        if (!this.timeline.arrivedAt) {
          this.timeline.arrivedAt = now;
        }
        break;
      case 'working':
        if (!this.timeline.startedAt) {
          this.timeline.startedAt = now;
        }
        break;
      case 'completed':
        if (!this.timeline.completedAt) {
          this.timeline.completedAt = now;
        }
        break;
    }
  }
  next();
});

// Instance method to calculate total duration
requestSchema.methods.getTotalDuration = function() {
  if (!this.timeline.completedAt) return null;
  
  const start = this.timeline.requestedAt;
  const end = this.timeline.completedAt;
  
  return Math.round((end - start) / (1000 * 60)); // Duration in minutes
};

// Instance method to get current status message
requestSchema.methods.getStatusMessage = function() {
  const statusMessages = {
    pending: 'Looking for available mechanics...',
    accepted: 'Mechanic accepted the request!',
    active: 'Mechanic accepted the request!',
    in_progress: 'Mechanic is heading to your location',
    on_way: 'Mechanic is heading to your location',
    arrived: 'Mechanic has arrived at your location',
    working: 'Mechanic is working on your vehicle',
    completed: 'Service completed successfully',
    cancelled: 'Request was cancelled',
    rejected: 'Request was rejected',
    failed: 'Service could not be completed'
  };
  
  return statusMessages[this.status] || 'Unknown status';
};

// Static method to find requests by location
requestSchema.statics.findNearby = function(longitude, latitude, maxDistance = 50000) {
  return this.find({
    pickupLocation: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance
      }
    }
  });
};

// Static method to get requests statistics
requestSchema.statics.getStatistics = function(startDate, endDate) {
  const matchStage = {};
  
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgCost: { $avg: '$actualCost' },
        avgDuration: { $avg: { $subtract: ['$timeline.completedAt', '$timeline.requestedAt'] } }
      }
    }
  ]);
};

module.exports = mongoose.model('Request', requestSchema);
