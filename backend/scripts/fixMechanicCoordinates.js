const mongoose = require('mongoose');
const Mechanic = require('../models/Mechanic');
require('dotenv').config();

const fixMechanicCoordinates = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/roadside-assistance');
    console.log('Connected to MongoDB');

    // Find mechanics with invalid coordinates
    const mechanicsWithInvalidCoords = await Mechanic.find({
      $or: [
        { 'currentLocation.coordinates': [0, 0] },
        { 'currentLocation.coordinates': { $exists: false } },
        { 'garage.location.coordinates': [0, 0] }
      ]
    });

    console.log(`Found ${mechanicsWithInvalidCoords.length} mechanics with invalid coordinates`);

    let fixedCount = 0;
    const defaultDhakaCoords = [90.4125, 23.8103]; // Default to Dhaka

    for (const mechanic of mechanicsWithInvalidCoords) {
      let needsUpdate = false;

      // Fix currentLocation if invalid
      if (!mechanic.currentLocation?.coordinates || 
          mechanic.currentLocation.coordinates[0] === 0 || 
          mechanic.currentLocation.coordinates[1] === 0) {
        
        if (mechanic.garage?.location?.coordinates && 
            mechanic.garage.location.coordinates[0] !== 0 && 
            mechanic.garage.location.coordinates[1] !== 0) {
          // Use garage location
          mechanic.currentLocation = {
            type: 'Point',
            coordinates: mechanic.garage.location.coordinates,
            lastUpdated: new Date()
          };
          console.log(`Fixed currentLocation for mechanic ${mechanic._id} using garage location`);
        } else {
          // Use default Dhaka coordinates
          mechanic.currentLocation = {
            type: 'Point',
            coordinates: defaultDhakaCoords,
            lastUpdated: new Date()
          };
          console.log(`Fixed currentLocation for mechanic ${mechanic._id} using default Dhaka coordinates`);
        }
        needsUpdate = true;
      }

      // Fix garage location if invalid
      if (!mechanic.garage?.location?.coordinates || 
          mechanic.garage.location.coordinates[0] === 0 || 
          mechanic.garage.location.coordinates[1] === 0) {
        
        mechanic.garage.location = {
          type: 'Point',
          coordinates: defaultDhakaCoords
        };
        console.log(`Fixed garage location for mechanic ${mechanic._id} using default Dhaka coordinates`);
        needsUpdate = true;
      }

      if (needsUpdate) {
        await mechanic.save();
        fixedCount++;
      }
    }

    console.log(`✅ Fixed coordinates for ${fixedCount} mechanics`);
    
    // Display summary
    const totalMechanics = await Mechanic.countDocuments();
    const availableMechanics = await Mechanic.countDocuments({ isAvailable: true });
    const verifiedMechanics = await Mechanic.countDocuments({ verificationStatus: 'verified' });
    
    console.log(`\n📊 Database Summary:`);
    console.log(`Total mechanics: ${totalMechanics}`);
    console.log(`Available mechanics: ${availableMechanics}`);
    console.log(`Verified mechanics: ${verifiedMechanics}`);

  } catch (error) {
    console.error('❌ Error fixing mechanic coordinates:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the script
fixMechanicCoordinates();

