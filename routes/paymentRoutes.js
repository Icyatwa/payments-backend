// PaymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/set', paymentController.setPaymentSettings);
router.post('/create', paymentController.createPayment);
router.post('/capture', paymentController.capturePayment);

module.exports = router;
