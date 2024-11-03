// models/PictureModel.js
const mongoose = require('mongoose');

const pictureSchema = new mongoose.Schema({
  url: { type: String, required: true },
  price: { type: Number, required: true },
  ownerId: { type: String, required: true }, // ID of the picture owner
  viewCount: { type: Number, default: 0 }, // Count of views paid for
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Picture', pictureSchema);


// controllers/PictureController.js
const Picture = require('../models/ImageModel');
const Payment = require('../models/PaymentModel');
const Flutterwave = require('flutterwave-node-v3');
const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);

exports.uploadPicture = async (req, res) => {
  try {
    const { url, price, ownerId } = req.body;

    if (!url || !price || !ownerId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const picture = new Picture({ url, price, ownerId });
    await picture.save();

    res.status(201).json({ message: 'Picture uploaded successfully', picture });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading picture' });
  }
};

exports.viewPicture = async (req, res) => {
  try {
    const { pictureId, userId } = req.body;
    const picture = await Picture.findById(pictureId);

    if (!picture) {
      return res.status(404).json({ message: 'Picture not found' });
    }

    const tx_ref = `VIEW-${pictureId}-${Date.now()}`;
    const paymentPayload = {
      tx_ref,
      amount: picture.price,
      currency: 'USD',
      redirect_url: `http://localhost:5000/api/payment/callback?pictureId=${pictureId}&userId=${userId}`,
      customer: { email: 'no-email@example.com', phonenumber: '1234567890' },
      customizations: { title: 'Picture Access', description: `Pay to view picture` },
    };

    const response = await flw.Payment.initialize(paymentPayload);
    res.status(200).json({ paymentLink: response.data.link });
  } catch (error) {
    res.status(500).json({ message: 'Error initializing picture view payment' });
  }
};

exports.getEarnings = async (req, res) => {
  try {
    const { ownerId } = req.params;
    const earnings = await Payment.find({ ownerId, status: 'successful' });
    const totalEarnings = earnings.reduce((acc, payment) => acc + payment.amount, 0);
    
    res.status(200).json({ totalEarnings });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching earnings' });
  }
};

// routes/PictureRoutes.js
const express = require('express');
const router = express.Router();
const pictureController = require('../controllers/ImageController');

router.post('/upload', pictureController.uploadPicture);
router.post('/view', pictureController.viewPicture);
router.get('/earnings/:ownerId', pictureController.getEarnings);

module.exports = router;

// PaymentModel.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  tx_ref: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  status: { type: String, enum: ['pending', 'successful', 'failed'], default: 'pending' },
  email: { type: String, required: false },
  phoneNumber: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);

// Paymentcontroller.js
const Flutterwave = require('flutterwave-node-v3');
const axios = require('axios');

// Initialize Flutterwave
const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);

exports.initiateCardPayment = async (req, res) => {
  try {
    const { amount, currency, email, phoneNumber } = req.body;

    if (!amount || !currency || !phoneNumber) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const tx_ref = 'CARDPAY-' + Date.now();
    const paymentPayload = {
      tx_ref: tx_ref,
      amount: amount,
      currency: currency,
      redirect_url: 'http://localhost:5000/api/payment/callback',
      customer: {
        email: email || 'no-email@example.com',
        phonenumber: phoneNumber,
      },
      payment_options: 'card',
      customizations: {
        title: 'Card Payment',
        description: 'Pay with your bank card',
      },
    };

    const response = await axios.post('https://api.flutterwave.com/v3/payments', paymentPayload, {
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.data && response.data.data && response.data.data.link) {
      res.status(200).json({ paymentLink: response.data.data.link });
    } else {
      res.status(500).json({ message: 'Payment initiation failed', error: response.data });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error during payment initiation' });
  }
};

exports.paymentCallback = async (req, res) => {
  try {
    const { tx_ref, transaction_id, pictureId } = req.query;
    const transactionVerification = await axios.get(`https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`, {
      headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
    });

    const { status } = transactionVerification.data.data;
    if (status === 'successful') {
      await Picture.findByIdAndUpdate(pictureId, { $inc: { viewCount: 1 } });
      return res.redirect('http://localhost:3000/view-success');
    } else {
      return res.redirect('http://localhost:3000/view-failed');
    }
  } catch (error) {
    res.status(500).json({ message: 'Error processing payment callback' });
  }
};

// PaymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/PaymentController');

router.post('/initiate-card-payment', paymentController.initiateCardPayment);
router.get('/callback', paymentController.paymentCallback);

module.exports = router;

// server.js
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./config/database');
const paymentRoutes = require('./routes/PaymentRoutes');
const imageRoutes = require('./routes/ImageRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use('/api/payment', paymentRoutes);
app.use('/api/image', imageRoutes);

const server = http.createServer(app);
const io = socketIo(server);

module.exports.io = io;
connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.log(error);
  });

// components/PhotoUploadForm.js
import React, { useState } from 'react';
import axios from 'axios';
import { useClerk } from '@clerk/clerk-react';

const PhotoUploadForm = () => {
  const { user } = useClerk();
  const userId = user?.id;
  const [url, setUrl] = useState('');
  const [price, setPrice] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/image/upload', { url, price, ownerId: userId });
      alert('Picture uploaded successfully!');
    } catch (error) {
      console.error('Error uploading picture:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Picture URL" required />
      <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" required />
      <button type="submit">Upload Picture</button>
    </form>
  );
};

export default PhotoUploadForm;

// components/PictureView.js
import React from 'react';
import axios from 'axios';

const PictureView = ({ pictureId }) => {
  const handleView = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/image/view', { pictureId });
      window.location.href = response.data.paymentLink;
    } catch (error) {
      console.error('Error initializing view payment:', error);
    }
  };

  return (
    <button onClick={handleView}>Pay to View Picture</button>
  );
};

export default PictureView;

ViewPhoto.js:11 Error initializing view payment: AxiosError {message: 'Request failed with status code 404', name: 'AxiosError', code: 'ERR_BAD_REQUEST', config: {…}, request: XMLHttpRequest, …}
fix it