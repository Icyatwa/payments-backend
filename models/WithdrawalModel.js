// models/WithdrawalModel.js
const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
    userId: { type: String, required: true }, // User requesting the withdrawal
    phoneNumber: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' },
  }, { timestamps: true });

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
