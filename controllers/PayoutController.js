// // controllers/PayoutController.js
// const Flutterwave = require('flutterwave-node-v3');
// const Payment = require('../models/PaymentModel');
// const Picture = require('../models/PictureModel');
// const { getPublicIP } = require('../utils/ipUtil');

// const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);

// exports.requestPayout = async (req, res) => {
//   try {
//     const { creatorId, amount, phoneNumber } = req.body;
    
//     // Get current IP address
//     const publicIP = await getPublicIP();
//     console.log('Current Public IP:', publicIP);

//     // Validate fields
//     if (!creatorId || !amount || !phoneNumber) {
//       return res.status(400).json({ 
//         message: 'Missing required fields', 
//         requestData: req.body 
//       });
//     }

//     // Fetch creator's pictures and total earnings
//     const pictures = await Picture.find({ ownerId: creatorId }).select('_id');
//     const pictureIds = pictures.map(picture => picture._id);
//     const payments = await Payment.find({ pictureId: { $in: pictureIds }, status: 'successful' });
//     const totalEarnings = payments.reduce((sum, payment) => sum + payment.amount, 0);

//     if (amount > totalEarnings) {
//       return res.status(400).json({ 
//         message: 'Insufficient funds for payout', 
//         requestData: req.body 
//       });
//     }

//     // Initiate mobile money payout
//     const payoutResponse = await flw.Transfer.initiate({
//       account_bank: 'RWB',
//       account_number: phoneNumber,
//       amount,
//       narration: 'Creator earnings payout',
//       currency: 'RWF',
//       reference: 'PAYOUT-' + Date.now(),
//       callback_url: 'http://localhost:5000/api/payout/callback',
//     });

//     if (payoutResponse.status === 'success') {
//       console.log('Payout initiated successfully');
//       res.status(200).json({ 
//         message: 'Payout initiated successfully', 
//         requestData: req.body 
//       });
//     } else {
//       // Capture specific failure messages
//       console.error('Payout initiation failed:', payoutResponse.message);

//       // Send failure reason and server IP to the frontend
//       res.status(500).json({
//         message: 'Payout initiation failed: ' + payoutResponse.message,
//         requestData: req.body,
//         error: payoutResponse.message,
//         publicIP
//       });
//     }
//   } catch (error) {
//     console.error('Error initiating payout:', error.message);
//     res.status(500).json({ 
//       message: 'Error initiating payout',
//       requestData: req.body,
//       error: error.message 
//     });
//   }
// };


// exports.requestPayout = async (req, res) => {
//   try {
//     const { creatorId, amount, phoneNumber } = req.body;
    
//     // Get current IP address
//     const publicIP = await getPublicIP();
//     console.log('Current Public IP:', publicIP);

//     // Validate fields
//     if (!creatorId || !amount || !phoneNumber) {
//       return res.status(400).json({ message: 'Missing required fields' });
//     }

//     // Fetch creator's pictures and total earnings (same as before)
//     const pictures = await Picture.find({ ownerId: creatorId }).select('_id');
//     const pictureIds = pictures.map(picture => picture._id);
//     const payments = await Payment.find({ pictureId: { $in: pictureIds }, status: 'successful' });
//     const totalEarnings = payments.reduce((sum, payment) => sum + payment.amount, 0);

//     if (amount > totalEarnings) {
//       return res.status(400).json({ message: 'Insufficient funds for payout' });
//     }

//     // Step 5: Initiate mobile money payout via Flutterwave
//     const payoutResponse = await flw.Transfer.initiate({
//       account_bank: 'RWB',
//       account_number: phoneNumber,
//       amount,
//       narration: 'Creator earnings payout',
//       currency: 'RWF',
//       reference: 'PAYOUT-' + Date.now(),
//       callback_url: 'http://localhost:5000/api/payout/callback',
//     });

//     if (payoutResponse.status === 'success') {
//       console.log('Payout initiated successfully');
//       res.status(200).json({ message: 'Payout initiated successfully' });
//     } else {
//       // Check if error is related to IP whitelisting
//       if (payoutResponse.message?.toLowerCase().includes('ip')) {
//         console.error('IP Whitelisting Error. Current IP:', publicIP);
//         return res.status(403).json({ 
//           message: 'IP not whitelisted', 
//           currentIP: publicIP,
//           error: 'Please whitelist this IP address in your Flutterwave dashboard'
//         });
//       }
//       console.error('Payout initiation failed:', payoutResponse.message);
//       res.status(500).json({ message: 'Payout initiation failed', error: payoutResponse.message });
//     }
//   } catch (error) {
//     console.error('Error initiating payout:', error);
//     res.status(500).json({ message: 'Error initiating payout', error: error.message });
//   }
// };

const axios = require('axios');
const Payment = require('../models/PaymentModel');
const Withdrawal = require('../models/WithdrawalModel');
const mongoose = require('mongoose');

class PayoutService {
  // Validate input parameters
  static validatePayoutInput(amount, phoneNumber, userId) {
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      throw new Error('Invalid amount. Must be a positive number.');
    }

    if (!phoneNumber || !/^(07\d{8})$/.test(phoneNumber)) {
      throw new Error('Invalid phone number. Must start with 07 and be 10 digits.');
    }

    if (!userId) {
      throw new Error('User ID is required.');
    }
  }

  // Fetch user earnings
  static async fetchUserEarnings(userId) {
    try {
      const response = await axios.get(`http://localhost:5000/api/picture/earnings/${userId}`);
      return response.data.totalEarnings;
    } catch (error) {
      console.error('Error fetching user earnings:', error);
      throw new Error('Could not retrieve user earnings');
    }
  }

  // Prepare Flutterwave payout payload
  static preparePayoutPayload(phoneNumber, amount, tx_ref) {
    return {
      account_bank: "MPS", // Mobile Money Rwanda
      account_number: phoneNumber,
      amount: amount,
      narration: "Creator Earnings Payout",
      currency: "RWF",
      reference: tx_ref,
      callback_url: "http://localhost:5000/api/payout/callback"
    };
  }

  // Log detailed error for debugging
  static logDetailedError(error) {
    console.error('Detailed Payout Error:', {
      message: error.message,
      response: error.response ? error.response.data : 'No response',
      status: error.response ? error.response.status : 'Unknown',
      headers: error.response ? error.response.headers : 'No headers'
    });
  }
}

exports.initiatePayoutTransfer = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, phoneNumber, userId } = req.body;

    // Validate input
    PayoutService.validatePayoutInput(amount, phoneNumber, userId);

    // Verify user's earnings
    const totalEarnings = await PayoutService.fetchUserEarnings(userId);

    // Check if user has enough earnings
    if (totalEarnings < amount) {
      return res.status(400).json({ 
        message: 'Insufficient funds',
        currentBalance: totalEarnings 
      });
    }

    // Generate a unique, more robust transaction reference
    const tx_ref = `PAYOUT-${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Prepare Flutterwave payout payload
    const payoutPayload = PayoutService.preparePayoutPayload(phoneNumber, amount, tx_ref);

    try {
      // Initiate payout via Flutterwave
      const response = await axios.post('https://api.flutterwave.com/v3/transfers', payoutPayload, {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000 // 10 second timeout
      });

      // Create withdrawal record
      const withdrawal = new Withdrawal({
        userId,
        phoneNumber,
        amount,
        status: response.data.status === 'success' ? 'pending' : 'failed'
      });
      await withdrawal.save({ session });

      // Create payment record
      const payment = new Payment({
        tx_ref,
        amount,
        currency: 'RWF',
        status: response.data.status === 'success' ? 'pending' : 'failed',
        phoneNumber,
        userId,
        pictureId: null, // No picture associated with payout
        withdrawalStatus: response.data.status === 'success' ? 'pending' : 'none'
      });
      await payment.save({ session });

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      // Respond based on Flutterwave response
      if (response.data.status === 'success') {
        return res.status(200).json({ 
          message: 'Payout initiated successfully', 
          reference: tx_ref,
          amount: amount
        });
      } else {
        return res.status(400).json({ 
          message: 'Payout initiation failed', 
          error: response.data 
        });
      }
    } catch (flutterwaveError) {
      // Log detailed Flutterwave error
      PayoutService.logDetailedError(flutterwaveError);

      // Abort transaction
      await session.abortTransaction();
      session.endSession();

      // Handle specific Flutterwave error scenarios
      if (flutterwaveError.response) {
        const errorData = flutterwaveError.response.data;
        return res.status(500).json({ 
          message: 'Flutterwave payout error',
          details: {
            code: errorData.code || 'UNKNOWN',
            message: errorData.message || 'Unexpected Flutterwave error'
          }
        });
      }

      return res.status(500).json({ 
        message: 'Error processing payout', 
        error: flutterwaveError.message 
      });
    }
  } catch (error) {
    // Handle validation or other errors
    console.error('Payout initialization error:', error);
    return res.status(400).json({ 
      message: error.message || 'Payout initialization failed'
    });
  }
};

// Payout callback handler
exports.payoutCallback = async (req, res) => {
  try {
    const { tx_ref, status, id: transferId } = req.body;

    // Find and update the payment record
    const payment = await Payment.findOneAndUpdate(
      { tx_ref },
      { 
        status: status === 'successful' ? 'successful' : 'failed',
        withdrawalStatus: status === 'successful' ? 'completed' : 'none',
        flutterwaveTransferId: transferId
      },
      { new: true }
    );

    // Update corresponding withdrawal
    if (payment) {
      await Withdrawal.findOneAndUpdate(
        { userId: payment.userId, amount: payment.amount },
        { status: status === 'successful' ? 'processed' : 'failed' }
      );
    }

    res.status(200).json({ message: 'Callback processed successfully' });
  } catch (error) {
    console.error('Payout callback error:', error);
    res.status(500).json({ message: 'Error processing payout callback' });
  }
};