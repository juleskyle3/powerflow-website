const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please provide a valid email address',
    ],
  },
  passwordHash: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
  },
  role: {
    type: String,
    enum: ['admin', 'client'],
    default: 'client',
  },
  phone: {
    type: String,
    maxlength: [20, 'Phone number cannot exceed 20 characters'],
  },
  address: {
    type: String,
    maxlength: [500, 'Address cannot exceed 500 characters'],
  },
  avatar: {
    type: String,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLoginAt: {
    type: Date,
  },
  loginCount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Virtual field for password
userSchema.virtual('password').set(function(password) {
  this.passwordHash = bcrypt.hashSync(password, 12);
});

// Password verification method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Instance method to check if user is admin
userSchema.methods.isAdmin = function() {
  return this.role === 'admin';
};

// Static method to find user by email
userSchema.statics.findByEmail = async function(email) {
  return this.findOne({ email: email.toLowerCase(), isActive: true });
};

// Remove passwordHash from JSON output
userSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.passwordHash;
    return ret;
  },
});

userSchema.set('toObject', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.passwordHash;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
