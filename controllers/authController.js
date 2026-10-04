const User = require('../models/User');

exports.showRegister = (req, res) => res.render('auth');
exports.showLogin = (req, res) => res.render('auth');

exports.register = async (req, res) => {
  try {
    const { username, password } = req.body;
    const exists = await User.findOne({ email: username });
    if (exists) return res.status(400).json({ message: 'User already exists' });
    
    const user = await User.create({ name: username, email: username, password });
    req.session.userId = user._id;
    res.json({ message: 'Registration successful' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ email: username });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    req.session.userId = user._id;
    res.json({ message: 'Login successful' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
};
