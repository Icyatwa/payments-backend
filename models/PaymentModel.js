// // PaymentModel.js
// const mongoose = require('mongoose');

// const paymentSchema = new mongoose.Schema({
//   tx_ref: { type: String, required: true, unique: true },
//   amount: { type: Number, required: true },
//   currency: { type: String, required: true },
//   status: { type: String, enum: ['pending', 'successful', 'failed'], default: 'pending' },
//   email: { type: String, required: false },
//   phoneNumber: { type: String, required: true },
//   createdAt: { type: Date, default: Date.now },
// }, { timestamps: true });

// module.exports = mongoose.model('Payment', paymentSchema);

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
