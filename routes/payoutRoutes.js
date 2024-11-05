// routes/payoutRoutes.js
const express = require('express');
const { requestPayout } = require('../controllers/PayoutController');
const router = express.Router();

router.post('/request-payout', requestPayout);

module.exports = router;
