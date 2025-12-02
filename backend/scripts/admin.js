/*
  Admin provisioning CLI
  Usage examples:
    node scripts/admin.js --email admin@example.com --password StrongP@ssw0rd --name "Super Admin" --phone 01712345678
    node scripts/admin.js --promote --email existing@site.com
*/

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env from backend/.env if present
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const part = argv[i];
    if (part.startsWith('--')) {
      const key = part.replace(/^--/, '');
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

async function ensureConnection() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/roadside-assistance';
  await mongoose.connect(uri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
  });
}

async function upsertAdmin({ email, password, name, phone, promote, setPassword }) {
  if (!email) {
    throw new Error('Missing required --email');
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  let user = await User.findOne({ email: normalizedEmail });

  if (user) {
    // Optionally update password for existing user
    if (setPassword) {
      user.password = String(setPassword);
      await user.save();
      return { action: 'password_updated', userId: user._id, email: user.email };
    }

    if (promote || user.role !== 'admin') {
      user.role = 'admin';
      await user.save();
      return { action: 'promoted', userId: user._id, email: user.email };
    }
    return { action: 'unchanged', userId: user._id, email: user.email };
  }

  // Create new admin
  if (!password) throw new Error('Missing required --password for new admin');
  if (!name) name = 'Administrator';
  if (!phone) phone = '01700000000'; // valid format for BD as per schema

  user = new User({
    name,
    email: normalizedEmail,
    password,
    phone,
    role: 'admin',
  });
  await user.save();
  return { action: 'created', userId: user._id, email: user.email };
}

async function main() {
  try {
    const args = parseArgs(process.argv);
    const promote = !!args.promote;
    await ensureConnection();
    const result = await upsertAdmin({
      email: args.email,
      password: args.password,
      name: args.name,
      phone: args.phone,
      promote,
      setPassword: args['set-password'] || args.setPassword,
    });
    console.log(`Admin ${result.action}: ${result.email} (id=${result.userId})`);
    console.log('You can now log in via POST /api/auth/login using the provided credentials.');
  } catch (err) {
    console.error('Admin script error:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close().catch(() => {});
  }
}

if (require.main === module) {
  main();
}


