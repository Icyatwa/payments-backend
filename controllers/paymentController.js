// controllers/paymentController.js
const axios = require("axios");
const PaymentSettings = require("../models/PaymentSettings");
const Transaction = require("../models/Transaction");

// PayPal Configuration
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_BASE_URL = "https://sandbox.paypal.com";

// Helper to retrieve PayPal access token
async function getPayPalAccessToken() {
  try {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString("base64");
    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v1/oauth2/token`,
      "grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error("Failed to retrieve PayPal access token:", error);
    throw new Error("Unable to retrieve PayPal access token");
  }
}

// Controller to set payment by User1
exports.setPaymentSettings = async (req, res) => {
  const { userId, price, frequency } = req.body;

  try {
    const paymentSettings = new PaymentSettings({ userId, price, frequency });
    await paymentSettings.save();
    res.status(201).json({ success: true, paymentSettings });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error setting payment details" });
  }
};

// Controller to initiate payment by User2
exports.createPayment = async (req, res) => {
  const { payeeId, payerId } = req.body;
  const paymentSettings = await PaymentSettings.findOne({ userId: payeeId });

  if (!paymentSettings) return res.status(404).json({ message: "Payment settings not found" });

  try {
    const accessToken = await getPayPalAccessToken();
    const orderResponse = await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders`,
      {
        intent: "CAPTURE",
        purchase_units: [{ amount: { currency_code: "USD", value: paymentSettings.price } }],
      },
      { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
    );

    const { id: orderId } = orderResponse.data;
    const transaction = new Transaction({
      payerId,
      payeeId,
      price: paymentSettings.price,
      status: "Pending",
    });
    await transaction.save();

    res.status(200).json({ success: true, orderId, transactionId: transaction._id });
  } catch (error) {
    console.error("Error creating payment order:", error);  // Log full error
    res.status(500).json({ success: false, message: "Error initiating payment" });
  }
};


// Controller to capture payment by User2
exports.capturePayment = async (req, res) => {
  const { orderId, transactionId } = req.body;

  try {
    const accessToken = await getPayPalAccessToken();

    // Capture the payment
    await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
      {},
      { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
    );

    // Update transaction status to 'Completed'
    await Transaction.findByIdAndUpdate(transactionId, { status: "Completed" });
    res.status(200).json({ success: true, message: "Payment captured successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error capturing payment" });
  }
};
