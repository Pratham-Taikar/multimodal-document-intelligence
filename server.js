require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
const path = require('path');
const serverless = require("serverless-http");

const connectDB = require('./config/db');

// Models
const User = require('./models/User');
const Subject = require('./models/Subject');

// Routes
const documentRoutes = require('./routes/documentRoutes');
const questionRoutes = require('./routes/questionRoutes')
const subjectRoutes = require('./routes/subjectRoutes');
const chatRoutes = require('./routes/chatRoutes');
const studyRoutes = require('./routes/studyRoutes');

// Middleware
const {isAuthenticated, isGuest} = require("./middleware/auth")

const app = express();
connectDB();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { maxAge: 604800000, httpOnly: true }
}));

app.use((req, res, next) => {
  res.locals.isLoggedIn = req.session && req.session.userId ? true : false;
  next();
});

// Page routes - ejs
app.get('/', (req, res) => res.render('hero'));

app.get('/register', isGuest, (req, res) => res.render('auth'));

app.get('/login', isGuest, (req, res) => res.render('auth'));

const { getUserStats } = require('./services/gamificationService');

app.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    const subjects = await Subject.find({ userId: req.session.userId });
    let gamification = null;
    try {
      gamification = await getUserStats(req.session.userId);
    } catch (e) {
      console.warn('Gamification stats error:', e);
    }
    res.render('dashboard', { 
      subjects, 
      user, 
      gamification,
      hasEnvGeminiKey: Boolean(process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEYS),
      hasEnvGroqKey: Boolean(process.env.GROQ_API_KEY || process.env.GROQ_API_KEYS)
    });
  } catch (error) {
    res.status(500).send('Error loading dashboard');
  }
});

app.post('/api/user/key', isAuthenticated, async (req, res) => {
  try {
    const { apiKey, groqApiKey } = req.body;
    const updates = {};
    if (apiKey !== undefined) updates.customApiKey = String(apiKey || '').trim();
    if (groqApiKey !== undefined) updates.customGroqApiKey = String(groqApiKey || '').trim();
    await User.findByIdAndUpdate(req.session.userId, updates);
    res.json({ message: 'API keys updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/chat/:subjectId', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    const subject = await Subject.findOne({ 
      _id: req.params.subjectId, 
      userId: req.session.userId 
    });
    if (!subject) return res.status(404).send('Subject not found');
    res.render('chat', { subject, subjectId: req.params.subjectId, user });
  } catch (error) {
    res.status(500).send('Error loading chat');
  }
});

// Auth
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const cleanUsername = String(username || '').trim();
    if (!cleanUsername || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const exists = await User.findOne({
      $or: [
        { email: cleanUsername },
        { email: cleanUsername.toLowerCase() },
        { name: cleanUsername }
      ]
    });

    if (exists) {
      if (!exists.password) {
        exists.password = password;
        if (!exists.name) exists.name = cleanUsername;
        await exists.save();
        req.session.userId = exists._id;
        return res.json({ message: 'Registration successful' });
      }
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({ name: cleanUsername, email: cleanUsername, password });
    req.session.userId = user._id;
    res.json({ message: 'Registration successful' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: error.message || 'Registration failed' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const cleanUsername = String(username || '').trim();
    if (!cleanUsername || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await User.findOne({
      $or: [
        { email: cleanUsername },
        { email: cleanUsername.toLowerCase() },
        { name: cleanUsername }
      ]
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // If an existing OAuth/migrated account has no password set, initialize it
    if (!user.password) {
      if (!user.name) {
        user.name = user.username || user.get?.('username') || (user.email ? user.email.split('@')[0] : cleanUsername);
      }
      user.password = password;
      await user.save();
      req.session.userId = user._id;
      return res.json({ message: 'Login successful' });
    }

    if (!(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    req.session.userId = user._id;
    res.json({ message: 'Login successful' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message || 'Login failed' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Document operations
app.use('/documents', isAuthenticated, documentRoutes);

// Subjects 
app.use('/api/subjects', isAuthenticated, subjectRoutes);

// Chat 
app.use('/api/chat/message', isAuthenticated, chatRoutes);

//  Questions
app.use('/api/questions', isAuthenticated, questionRoutes);

// Study Modules (Summaries & Flashcards)
app.use('/api/study', isAuthenticated, studyRoutes);

// 404 handler 
app.use((req, res) => {
    res.status(404).render("404");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
module.exports.handler = serverless(app);