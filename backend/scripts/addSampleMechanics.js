const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Mechanic = require('../models/Mechanic');
require('dotenv').config();

const sampleMechanics = [
  {
    name: 'Ahmed Rahman',
    email: 'ahmed.mechanic@example.com',
    password: 'password123',
    phone: '01712345678',
    location: {
      type: 'Point',
      coordinates: [90.4125, 23.8103] // Dhaka coordinates
    },
    vehicleTypes: ['car', 'bike'],
    skills: ['engine_repair', 'tire_change', 'battery_jump'],
    experience: 5,
    baseRate: 800,
    isAvailable: true,
    documents: {
      nidNumber: '1234567890123',
      licenseNumber: 'DL123456789'
    },
    emergencyContact: {
      name: 'Fatima Rahman',
      phone: '01712345600',
      relation: 'wife'
    },
    garage: {
      name: 'Rahman Auto Service',
      address: '123 Dhanmondi Road, Dhaka',
      location: {
        type: 'Point',
        coordinates: [90.4125, 23.8103]
      }
    }
  },
  {
    name: 'Karim Uddin',
    email: 'karim.mechanic@example.com',
    password: 'password123',
    phone: '01812345679',
    location: {
      type: 'Point',
      coordinates: [90.4200, 23.8150] // Nearby Dhaka location
    },
    vehicleTypes: ['car', 'truck'],
    skills: ['engine_repair', 'electrical_repair', 'ac_repair'],
    experience: 8,
    baseRate: 1000,
    isAvailable: true,
    documents: {
      nidNumber: '1234567890124',
      licenseNumber: 'DL123456790'
    },
    emergencyContact: {
      name: 'Rashida Uddin',
      phone: '01812345601',
      relation: 'wife'
    },
    garage: {
      name: 'Karim Motors',
      address: '456 Gulshan Avenue, Dhaka',
      location: {
        type: 'Point',
        coordinates: [90.4200, 23.8150]
      }
    }
  },
  {
    name: 'Rafiq Ahmed',
    email: 'rafiq.mechanic@example.com',
    password: 'password123',
    phone: '01912345680',
    location: {
      type: 'Point',
      coordinates: [90.4050, 23.8050] // Another nearby location
    },
    vehicleTypes: ['bike', 'cng'],
    skills: ['tire_change', 'battery_jump', 'fuel_delivery'],
    experience: 3,
    baseRate: 600,
    isAvailable: true,
    documents: {
      nidNumber: '1234567890125',
      licenseNumber: 'DL123456791'
    },
    emergencyContact: {
      name: 'Salma Ahmed',
      phone: '01912345602',
      relation: 'wife'
    },
    garage: {
      name: 'Rafiq Auto Care',
      address: '789 Mirpur Road, Dhaka',
      location: {
        type: 'Point',
        coordinates: [90.4050, 23.8050]
      }
    }
  },
  {
    name: 'Nasir Hossain',
    email: 'nasir.mechanic@example.com',
    password: 'password123',
    phone: '01712345681',
    location: {
      type: 'Point',
      coordinates: [90.4300, 23.8200] // Different area
    },
    vehicleTypes: ['car', 'bike', 'truck'],
    skills: ['engine_repair', 'tire_change', 'electrical_repair', 'ac_repair'],
    experience: 10,
    baseRate: 1200,
    isAvailable: true,
    documents: {
      nidNumber: '1234567890126',
      licenseNumber: 'DL123456792'
    },
    emergencyContact: {
      name: 'Nasreen Hossain',
      phone: '01712345603',
      relation: 'wife'
    },
    garage: {
      name: 'Nasir Auto Works',
      address: '321 Uttara Sector 7, Dhaka',
      location: {
        type: 'Point',
        coordinates: [90.4300, 23.8200]
      }
    }
  },
  {
    name: 'Salam Sheikh',
    email: 'salam.mechanic@example.com',
    password: 'password123',
    phone: '01812345682',
    location: {
      type: 'Point',
      coordinates: [90.3950, 23.7950] // South Dhaka
    },
    vehicleTypes: ['bike', 'cng'],
    skills: ['tire_change', 'battery_jump', 'fuel_delivery', 'towing'],
    experience: 6,
    baseRate: 700,
    isAvailable: true,
    documents: {
      nidNumber: '1234567890127',
      licenseNumber: 'DL123456793'
    },
    emergencyContact: {
      name: 'Rahima Sheikh',
      phone: '01812345604',
      relation: 'wife'
    },
    garage: {
      name: 'Salam Service Center',
      address: '654 Motijheel, Dhaka',
      location: {
        type: 'Point',
        coordinates: [90.3950, 23.7950]
      }
    }
  }
];

const addSampleMechanics = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/roadside-assistance');
    console.log('Connected to MongoDB');

    // Clear existing sample mechanics (optional)
    await User.deleteMany({ email: { $in: sampleMechanics.map(m => m.email) } });
    await Mechanic.deleteMany({ 'userId.email': { $in: sampleMechanics.map(m => m.email) } });
    console.log('Cleared existing sample mechanics');

    // Add sample mechanics
    for (const mechanicData of sampleMechanics) {
      // Create user account
      const hashedPassword = await bcrypt.hash(mechanicData.password, 12);
      
      const userData = {
        name: mechanicData.name,
        email: mechanicData.email,
        password: hashedPassword,
        phone: mechanicData.phone,
        role: 'mechanic',
        location: mechanicData.location,
        isVerified: true
      };

      const user = new User(userData);
      await user.save();
      console.log(`Created user: ${mechanicData.name}`);

      // Create mechanic profile
      const mechanicProfile = {
        userId: user._id,
        vehicleTypes: mechanicData.vehicleTypes,
        skills: mechanicData.skills,
        experience: mechanicData.experience,
        baseRate: mechanicData.baseRate,
        isAvailable: mechanicData.isAvailable,
        currentLocation: mechanicData.location,
        verificationStatus: 'verified',
        rating: 4.5 + Math.random() * 0.5, // Random rating between 4.5-5.0
        totalRatings: Math.floor(Math.random() * 50) + 10, // Random ratings count
        completedJobs: Math.floor(Math.random() * 100) + 20, // Random completed jobs
        documents: mechanicData.documents,
        emergencyContact: mechanicData.emergencyContact
      };

      const mechanic = new Mechanic(mechanicProfile);
      await mechanic.save();
      console.log(`Created mechanic profile: ${mechanicData.name}`);
    }

    console.log('✅ Sample mechanics added successfully!');
    console.log(`Added ${sampleMechanics.length} mechanics to the database`);
    
    // Display summary
    const totalMechanics = await Mechanic.countDocuments();
    const availableMechanics = await Mechanic.countDocuments({ isAvailable: true });
    
    console.log(`\n📊 Database Summary:`);
    console.log(`Total mechanics: ${totalMechanics}`);
    console.log(`Available mechanics: ${availableMechanics}`);
    console.log(`Unavailable mechanics: ${totalMechanics - availableMechanics}`);

  } catch (error) {
    console.error('❌ Error adding sample mechanics:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the script
addSampleMechanics();
