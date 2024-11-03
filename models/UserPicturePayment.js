const mongoose = require('mongoose');

const userPicturePaymentSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  pictureId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Picture' },
  status: { type: String, enum: ['pending', 'successful', 'failed'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('UserPicturePayment', userPicturePaymentSchema);
