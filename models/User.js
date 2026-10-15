const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { 
    type: String, 
    default: function() { 
      return this.username || this.get?.('username') || (this.email ? this.email.split('@')[0] : 'User'); 
    } 
  },
  customApiKey: { type: String, default: '' },
  customGroqApiKey: { type: String, default: '' },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  streak: { type: Number, default: 1 },
  lastActiveDate: { type: Date, default: Date.now },
  badges: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: String, default: 'fa-trophy' },
    unlockedAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
}, { strict: false });

userSchema.pre('validate', function(next) {
  if (!this.name) {
    this.name = this.username || this.get?.('username') || (this.email ? this.email.split('@')[0] : 'User');
  }
  next();
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(password) {
  if (!this.password || !password) return false;
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);
