// models/PaymentSettings.js
const mongoose = require("mongoose");

const PaymentSettingsSchema = new mongoose.Schema({
  userId: { type: String, required: true },  // Clerk ID of User1
  price: { type: Number, required: true },
  frequency: { type: String, enum: ["minute", "2-minutes"], required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("PaymentSettings", PaymentSettingsSchema);
