// .env
ADMIN_EMAIL=olympusexperts@gmail.com
ADMIN_PASSWORD=mountolympusABBA@@
JWT_SECRET=kkkkddddcccc

// models/userModel.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
});

const User = mongoose.model('User', userSchema);
module.exports = User;


// controllers/authController.js
const User = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// SECRET PASSWORD AND EMAIL (Stored in environment variables)
const { ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET } = process.env;

// Login handler
exports.login = async (req, res) => {
  const { email, password } = req.body;

  // Check if the email matches the allowed one
  if (email !== ADMIN_EMAIL) {
    return res.status(403).json({ message: "Access Denied" });
  }

  try {
    // Check if user exists
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });

    res.json({
      message: 'Login successful',
      token,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Initialize the admin user if it doesn't exist
exports.initAdmin = async (req, res) => {
  try {
    const user = await User.findOne({ email: ADMIN_EMAIL });

    if (!user) {
      // Hash the default password
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

      // Create the admin user
      const newUser = new User({
        email: ADMIN_EMAIL,
        password: hashedPassword,
      });

      await newUser.save();
      console.log('Admin user created successfully.');
    }
  } catch (error) {
    console.error('Error creating admin user', error);
  }
};

// routes/authRoutes.js
const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

// Route for login
router.post('/login', authController.login);

// Initialize admin user (Run only once during setup)
router.get('/init-admin', authController.initAdmin);

module.exports = router;

// server.js
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use('/api/auth', authRoutes);

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.log(error);
  });

// LoginPage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './auth.css'

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        email,
        password,
      });

      // Save the token in localStorage
      localStorage.setItem('token', response.data.token);

      // Redirect to homepage
      navigate('/');
    } catch (err) {
      setError('Invalid email or password');
    }
  };

  return (
    <div className='login-container'>
      <h1>Login</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
        />
        <button type="submit">Login</button>
      </form>
      {error && <p>{error}</p>}
    </div>
  );
};

export default LoginPage;

// RequireAuth.js
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Higher-Order Component to protect routes
const RequireAuth = ({ children }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');  // Redirect to login if no token is found
    }
  }, [navigate]);

  return children;  // Render the protected components if authenticated
};

export default RequireAuth;

// header.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './styles/header.css';
import Logo from "./logo";
import menuIcon from '../assets/img/menu.png';
import closeIcon from '../assets/img/close.png';

function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if the token exists in localStorage
    const token = localStorage.getItem('token');
    if (token) {
      setIsLoggedIn(true);
    } else {
      setIsLoggedIn(false);
    }
  }, []);

  const handleLogout = () => {
    // Clear token and redirect to login
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    navigate('/login');
  };

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className='dash-header-ctn'>
      <header>
        <nav>
          <div className="container">
            <div className={`nav-links ${isOpen ? 'open' : ''}`}>
              <Link to='/edit' onClick={toggleMenu}>Edit Ads</Link>
            </div>
            <div className="logo">
              <Logo />
            </div>
            <div className="user">
              {isLoggedIn ? (
                <button onClick={handleLogout}>Logout</button>
              ) : (
                <Link to="/login" onClick={toggleMenu}>Login</Link>
              )}
            </div>
            <button className="menu-toggle" onClick={toggleMenu}>
              <img src={isOpen ? closeIcon : menuIcon} alt="Menu Toggle" />
            </button>
          </div>
        </nav>
      </header>
    </div>
  );
}

export default Header;

// index.js
import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import Homepage from './pages/Homepage';
import Header from './pages/header';
import RequireAuth from './pages/auth/RequireAuth'; // The HOC for authentication

// Protect all routes except login
const ProtectedRoute = ({ children }) => {
  return (
    <RequireAuth>
      {children}
    </RequireAuth>
  );
};

const App = () => (
  <BrowserRouter>
    <Header /> {/* Header at the top level */}
    <Routes>
      <Route path="/login" element={<LoginPage />} /> {/* The only public page */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Homepage />
          </ProtectedRoute>
        }
      />
    </Routes>
  </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

POST http://localhost:5000/api/auth/login 404 (Not Found)