// PaymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/PaymentController');

router.post('/initiate-card-payment', paymentController.initiateCardPayment);
router.get('/callback', paymentController.paymentCallback);

module.exports = router;