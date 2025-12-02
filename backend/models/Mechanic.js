const mongoose = require('mongoose');
const User = require('./User');

const mechanicSchema = new mongoose.Schema({
  // Inherit all fields from User model
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Mechanic-specific fields
  vehicleTypes: [{
    type: String,
    enum: ['bike', 'car', 'truck', 'bus', 'cng', 'rickshaw'],
    required: true
  }],
  
  skills: [{
    type: String,
    enum: [
      'engine_repair',
      'tire_change',
      'battery_jump',
      'fuel_delivery',
      'lockout_service',
      'towing',
      'brake_repair',
      'electrical_repair',
      'oil_change',
      'ac_repair',
      'general_maintenance'
    ],
    required: true
  }],
  
  experience: {
    type: Number,
    required: [true, 'Experience in years is required'],
    min: [0, 'Experience cannot be negative'],
    max: [50, 'Experience cannot exceed 50 years']
  },
  
  rating: {
    type: Number,
    default: 5.0,
    min: 1,
    max: 5
  },
  
  totalRatings: {
    type: Number,
    default: 0
  },
  
  completedJobs: {
    type: Number,
    default: 0
  },
  
  isAvailable: {
    type: Boolean,
    default: false
  },
  
  // Capacity controls
  maxConcurrentJobs: {
    type: Number,
    default: 1,
    min: [1, 'Max concurrent jobs must be at least 1'],
  },
  allowQueue: {
    type: Boolean,
    default: false
  },
  
  workingHours: {
    start: {
      type: String,
      default: '08:00'
    },
    end: {
      type: String,
      default: '20:00'
    }
  },
  
  serviceRadius: {
    type: Number,
    default: 10, // in kilometers
    min: [1, 'Service radius must be at least 1 km'],
    max: [50, 'Service radius cannot exceed 50 km']
  },
  
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  
  priceRange: {
    min: {
      type: Number,
      default: 200,
      min: [0, 'Minimum price cannot be negative']
    },
    max: {
      type: Number,
      default: 2000,
      min: [0, 'Maximum price cannot be negative']
    }
  },

  // Optional per-service prices that override the general priceRange when present
  // Key: skill/service name (from skills enum)
  // Value: { min: Number, max: Number }
  servicePrices: {
    type: Map,
    of: new mongoose.Schema({
      min: { type: Number, min: [0, 'Service min price cannot be negative'], default: 0 },
      max: { type: Number, min: [0, 'Service max price cannot be negative'], default: 0 }
    }, { _id: false }),
    default: undefined
  },
  
  tools: [{
    type: String,
    enum: [
      'basic_toolkit',
      'advanced_toolkit',
      'diagnostic_equipment',
      'welding_equipment',
      'towing_equipment',
      'jump_starter',
      'tire_equipment',
      'electrical_tools'
    ]
  }],
  
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  
  documents: {
    nidNumber: {
      type: String,
      required: [true, 'NID number is required']
    },
    licenseNumber: {
      type: String,
      required: [true, 'License number is required']
    },
    certifications: [{
      name: String,
      issuedBy: String,
      validUntil: Date
    }]
  },
  
  emergencyContact: {
    name: {
      type: String,
      required: [true, 'Emergency contact name is required']
    },
    phone: {
      type: String,
      required: [true, 'Emergency contact phone is required']
    },
    relation: {
      type: String,
      required: [true, 'Emergency contact relation is required']
    }
  },

  // Garage information - required for all mechanics
  garage: {
    name: {
      type: String,
      required: [true, 'Garage name is required']
    },
    address: {
      type: String,
      required: [true, 'Garage address is required']
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: [true, 'Garage coordinates are required']
      }
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create geospatial index for location-based queries
mechanicSchema.index({ currentLocation: '2dsphere' });
mechanicSchema.index({ 'garage.location': '2dsphere' });
mechanicSchema.index({ isAvailable: 1 });
mechanicSchema.index({ vehicleTypes: 1 });
mechanicSchema.index({ rating: -1 });
mechanicSchema.index({ userId: 1 }); // Index for fast userId lookups

// Virtual populate user data
mechanicSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Update location timestamp when coordinates change
mechanicSchema.pre('save', function(next) {
  if (this.isModified('currentLocation.coordinates')) {
    this.currentLocation.lastUpdated = new Date();
  }
  // Ensure currentLocation has valid coordinates; if missing or [0,0], fallback to garage.location
  const hasCoords = Array.isArray(this.currentLocation?.coordinates) && this.currentLocation.coordinates.length === 2;
  const isZero = hasCoords && this.currentLocation.coordinates[0] === 0 && this.currentLocation.coordinates[1] === 0;
  if ((!hasCoords || isZero) && this.garage?.location?.coordinates) {
    this.currentLocation = {
      type: this.garage.location.type || 'Point',
      coordinates: this.garage.location.coordinates,
      lastUpdated: new Date()
    };
  }
  next();
});

// Static method to find available mechanics nearby
mechanicSchema.statics.findAvailableNearby = async function(longitude, latitude, vehicleType, maxDistance = 50000, includeUnavailable = false) {
  const baseFilter = {
    verificationStatus: { $in: ['verified', 'pending'] } // Include both verified and pending mechanics
  };
  if (!includeUnavailable) {
    baseFilter.isAvailable = true;
  }

  if (vehicleType && vehicleType !== 'all') {
    baseFilter.vehicleTypes = vehicleType;
  }

  // If no valid search coords, just return filtered mechanics
  const hasPoint = longitude !== undefined && latitude !== undefined && !isNaN(longitude) && !isNaN(latitude) && longitude !== 0 && latitude !== 0;
  if (!hasPoint) {
    return this.find(baseFilter)
      .populate('userId', 'name phone profileImage')
      .sort({ rating: -1, completedJobs: -1 });
  }

  // Query 1: nearby by currentLocation
  const currentLocQuery = {
    ...baseFilter,
    currentLocation: {
      $near: {
        $geometry: { type: 'Point', coordinates: [longitude, latitude] },
        $maxDistance: maxDistance
      }
    }
  };

  // Query 2: nearby by garage.location (for mechanics without a valid currentLocation)
  const garageLocQuery = {
    ...baseFilter,
    'garage.location': {
      $near: {
        $geometry: { type: 'Point', coordinates: [longitude, latitude] },
        $maxDistance: maxDistance
      }
    }
  };

  try {
    const [byCurrent, byGarage] = await Promise.all([
      this.find(currentLocQuery).populate('userId', 'name phone profileImage'),
      this.find(garageLocQuery).populate('userId', 'name phone profileImage')
    ]);

    // Merge unique by _id
    const seen = new Set();
    const merged = [];
    [...byCurrent, ...byGarage].forEach(doc => {
      const id = doc._id.toString();
      if (!seen.has(id)) {
        seen.add(id);
        merged.push(doc);
      }
    });

    // Sort by computed distance from the search point
    merged.sort((a, b) => a.getDistanceFrom(longitude, latitude) - b.getDistanceFrom(longitude, latitude));
    return merged;
  } catch (err) {
    console.log('Geospatial query failed, using fallback:', err.message);
    return this.find(baseFilter)
      .populate('userId', 'name phone profileImage')
      .sort({ rating: -1, completedJobs: -1 });
  }
};

// Instance method to calculate distance from a point
mechanicSchema.methods.getDistanceFrom = function(longitude, latitude) {
  // Prefer currentLocation if valid, otherwise use garage.location
  let coords = Array.isArray(this.currentLocation?.coordinates) ? this.currentLocation.coordinates : null;
  if (!coords || coords.length < 2 || (coords[0] === 0 && coords[1] === 0)) {
    coords = this.garage?.location?.coordinates || null;
  }
  
  // If still no valid coordinates, return a large distance
  if (!coords || coords.length < 2 || (coords[0] === 0 && coords[1] === 0)) {
    return 999999; // Return very large distance for invalid coordinates
  }
  
  const [mechLng, mechLat] = coords;
  
  // Haversine formula to calculate distance
  const R = 6371; // Earth's radius in kilometers
  const dLat = (latitude - mechLat) * Math.PI / 180;
  const dLng = (longitude - mechLng) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(mechLat * Math.PI / 180) * Math.cos(latitude * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
};

// Instance method to update rating
mechanicSchema.methods.updateRating = function(newRating) {
  const totalScore = this.rating * this.totalRatings + newRating;
  this.totalRatings += 1;
  this.rating = Math.round((totalScore / this.totalRatings) * 10) / 10;
  return this.save();
};

module.exports = mongoose.model('Mechanic', mechanicSchema);
