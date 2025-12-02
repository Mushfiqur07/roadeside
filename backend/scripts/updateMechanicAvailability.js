const mongoose = require('mongoose');
const Mechanic = require('../models/Mechanic');
require('dotenv').config();

const updateMechanicAvailability = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/roadside-assistance');
    console.log('Connected to MongoDB');

    // Find all mechanics
    const mechanics = await Mechanic.find({});
    console.log(`Found ${mechanics.length} mechanics in database`);

    let updatedCount = 0;

    for (const mechanic of mechanics) {
      let needsUpdate = false;
      const updates = {};

      // Set verified mechanics as available
      if (mechanic.verificationStatus === 'verified' && !mechanic.isAvailable) {
        updates.isAvailable = true;
        needsUpdate = true;
        console.log(`Setting mechanic ${mechanic._id} as available (verified)`);
      }

      // Fix invalid coordinates
      if (mechanic.currentLocation && 
          mechanic.currentLocation.coordinates && 
          (mechanic.currentLocation.coordinates[0] === 0 && mechanic.currentLocation.coordinates[1] === 0)) {
        if (mechanic.garage && mechanic.garage.location && mechanic.garage.location.coordinates) {
          updates.currentLocation = {
            type: 'Point',
            coordinates: mechanic.garage.location.coordinates,
            lastUpdated: new Date()
          };
          needsUpdate = true;
          console.log(`Fixing coordinates for mechanic ${mechanic._id}`);
        }
      }

      if (needsUpdate) {
        await Mechanic.findByIdAndUpdate(mechanic._id, updates);
        updatedCount++;
      }
    }

    console.log(`Updated ${updatedCount} mechanics`);
    console.log('Mechanic availability update completed successfully');

  } catch (error) {
    console.error('Error updating mechanic availability:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run the script
updateMechanicAvailability();

