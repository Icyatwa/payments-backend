// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { initiatePayoutTransfer, payoutCallback } = require('../controllers/PayoutController');

// Add this new route
router.post('/', initiatePayoutTransfer);
router.get('/callback', payoutCallback);

module.exports = router;