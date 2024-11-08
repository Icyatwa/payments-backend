// .env
MONGODB_URI = mongodb+srv://yepper_test:lolop0788@cluster0.s1wt1at.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
PORT = 5000

ADMIN_EMAIL = olympusexperts@gmail.com
ADMIN_PASSWORD = mountolympusABBA@@
JWT_SECRET = kkkkddddcc

FLW_PUBLIC_KEY = FLWPUBK-32ebb16b5d18e4323148f4c6c3f40529-X
FLW_SECRET_KEY = FLWSECK-a3451d48103c442a5d7f082f0a3ebb73-192edd477a9vt-X
FLW_ENCRYPTION_KEY = a3451d48103c8512309ad49c

// models/PaymentModel.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  tx_ref: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  status: { type: String, enum: ['pending', 'successful', 'failed'], default: 'pending' },
  email: { type: String, required: false },
  phoneNumber: { type: String, required: true },
  userId: { type: String, required: true }, // ID of the user who paid
  pictureId: { type: String, required: true }, // ID of the picture being paid for
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);

// Paymentcontroller.js
const Picture = require('../models/PictureModel');
const Payment = require('../models/PaymentModel');
const Flutterwave = require('flutterwave-node-v3');
const axios = require('axios');

// Initialize Flutterwave
const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);

exports.initiateCardPayment = async (req, res) => {
  try {
    const { amount, currency, email, phoneNumber, userId, pictureId } = req.body;

    if (!amount || !currency || !phoneNumber || !userId || !pictureId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const tx_ref = 'CARDPAY-' + Date.now();

    // Step 1: Save the pending payment in the database
    const payment = new Payment({
      tx_ref,
      amount,
      currency,
      email,
      phoneNumber,
      userId,
      pictureId,
      status: 'pending'
    });
    await payment.save();

    // Step 2: Initiate the payment with Flutterwave
    const paymentPayload = {
      tx_ref,
      amount,
      currency,
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
    const { tx_ref, transaction_id } = req.query;

    const transactionVerification = await axios.get(`https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`, {
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`
      }
    });

    const { status, customer, amount, currency } = transactionVerification.data.data;

    if (status === 'successful') {
      // Find and update the payment status to 'successful'
      const payment = await Payment.findOneAndUpdate(
        { tx_ref },
        { status: 'successful' },
        { new: true }
      );

      if (payment) {
        // Add user to the list of paid users for the picture
        await Picture.findByIdAndUpdate(payment.pictureId, {
          $addToSet: { paidUsers: payment.userId }
        });
      }

      return res.redirect('http://localhost:3000/list');
    } else {
      // Update the payment record as failed
      await Payment.findOneAndUpdate({ tx_ref }, { status: 'failed' });
      return res.redirect('http://localhost:3000/failed');
    }
  } catch (error) {
    console.error('Error processing payment callback:', error);
    res.status(500).json({ message: 'Error processing payment callback' });
  }
};

// utils/ipUtil.js
const axios = require('axios');

const getPublicIP = async () => {
  try {
    // Using ipify API to get public IP
    const response = await axios.get('https://api.ipify.org?format=json');
    return response.data.ip;
  } catch (error) {
    console.error('Error fetching public IP:', error);
    throw error;
  }
};

module.exports = { getPublicIP };

// controllers/PayoutController.js
const Flutterwave = require('flutterwave-node-v3');
const Payment = require('../models/PaymentModel');
const Picture = require('../models/PictureModel');
const { getPublicIP } = require('../utils/ipUtil');

const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);

exports.requestPayout = async (req, res) => {
  try {
    const { creatorId, amount, phoneNumber } = req.body;
    
    // Get current IP address
    const publicIP = await getPublicIP();
    console.log('Current Public IP:', publicIP);

    // Validate fields
    if (!creatorId || !amount || !phoneNumber) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Fetch creator's pictures and total earnings (same as before)
    const pictures = await Picture.find({ ownerId: creatorId }).select('_id');
    const pictureIds = pictures.map(picture => picture._id);
    const payments = await Payment.find({ pictureId: { $in: pictureIds }, status: 'successful' });
    const totalEarnings = payments.reduce((sum, payment) => sum + payment.amount, 0);

    if (amount > totalEarnings) {
      return res.status(400).json({ message: 'Insufficient funds for payout' });
    }

    // Step 5: Initiate mobile money payout via Flutterwave
    const payoutResponse = await flw.Transfer.initiate({
      account_bank: 'RWB',
      account_number: phoneNumber,
      amount,
      narration: 'Creator earnings payout',
      currency: 'RWF',
      reference: 'PAYOUT-' + Date.now(),
      callback_url: 'http://localhost:5000/api/payout/callback',
    });

    if (payoutResponse.status === 'success') {
      console.log('Payout initiated successfully');
      res.status(200).json({ message: 'Payout initiated successfully' });
    } else {
      // Check if error is related to IP whitelisting
      if (payoutResponse.message?.toLowerCase().includes('ip')) {
        console.error('IP Whitelisting Error. Current IP:', publicIP);
        return res.status(403).json({ 
          message: 'IP not whitelisted', 
          currentIP: publicIP,
          error: 'Please whitelist this IP address in your Flutterwave dashboard'
        });
      }
      console.error('Payout initiation failed:', payoutResponse.message);
      res.status(500).json({ message: 'Payout initiation failed', error: payoutResponse.message });
    }
  } catch (error) {
    console.error('Error initiating payout:', error);
    res.status(500).json({ message: 'Error initiating payout', error: error.message });
  }
};

// CreatorEarnings.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useClerk } from '@clerk/clerk-react';

const CreatorEarnings = () => {
  const { user } = useClerk();
  const userId = user?.id;
  const [ipError, setIpError] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [payoutMessage, setPayoutMessage] = useState('');

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`http://localhost:5000/api/picture/earnings/${userId}`);
        setEarnings(response.data);
      } catch (error) {
        console.error('Error fetching earnings:', error);
        setError('Could not retrieve earnings');
      } finally {
        setLoading(false);
      }
    };

    if (userId) fetchEarnings();
  }, [userId]);

  const handlePayoutRequest = async () => {
    try {
      setPayoutMessage('');
      setIpError(null);
      
      const response = await axios.post('http://localhost:5000/api/payout/request-payout', {
        creatorId: userId,
        amount: parseFloat(payoutAmount),
        phoneNumber,
      });
      setPayoutMessage(response.data.message);
    } catch (error) {
      if (error.response?.data?.message === 'IP not whitelisted') {
        setIpError({
          ip: error.response.data.currentIP,
          message: error.response.data.error
        });
        setPayoutMessage('IP Whitelisting Required');
      } else {
        setPayoutMessage('Error processing payout request');
      }
      console.error('Payout error:', error);
    }
  };

  return (
    <div>
      <h2>Your Earnings</h2>
      {earnings ? (
        <div>
          <p>Total Earnings: ${earnings.totalEarnings.toFixed(2)}</p>
          <p>Number of Successful Payments: {earnings.paymentCount}</p>
        </div>
      ) : (
        <p>No earnings data available.</p>
      )}
      
      <div>
        <h3>Request Payout</h3>
        <input
          type="number"
          placeholder="Amount"
          value={payoutAmount}
          onChange={(e) => setPayoutAmount(e.target.value)}
        />
        <input
          type="text"
          placeholder="Rwandan Mobile Money Phone Number"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
        />
        <button onClick={handlePayoutRequest}>Request Payout</button>
        {payoutMessage && <p>{payoutMessage}</p>}
        
        {ipError && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mt-4">
            <strong className="font-bold">IP Whitelisting Required!</strong>
            <p className="mt-2">Current IP Address: {ipError.ip}</p>
            <p className="mt-2">{ipError.message}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreatorEarnings;

add more error messages appearing on the page, each error the system would have either in backend or in frontend must appear on this page so that he can get where the problem is