// models/Transaction.js
const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
  payerId: { type: String, required: true },  // Clerk ID of User2
  payeeId: { type: String, required: true },  // Clerk ID of User1
  price: { type: Number, required: true },
  status: { type: String, enum: ["Pending", "Completed", "Failed"], default: "Pending" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Transaction", TransactionSchema);
