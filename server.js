// server.js
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const { initAdmin } = require('./controllers/authController'); // Import initAdmin function

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize routes
app.use('/api/auth', authRoutes);

// Connect to the database and initialize the admin
connectDB()
  .then(async () => {
    await initAdmin(); // Automatically create the admin user on server start
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.log(error);
  });
