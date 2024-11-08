// controllers/PayoutController.js
const Flutterwave = require('flutterwave-node-v3');
const Payment = require('../models/PaymentModel');
const Picture = require('../models/PictureModel');
const { getPublicIP } = require('../utils/ipUtil');

const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);

exports.requestPayout = async (req, res) => {
  try {
    const { creatorId, amount, phoneNumber } = req.body;
    
    // Get current IP address
    const publicIP = await getPublicIP();
    console.log('Current Public IP:', publicIP);

    // Validate fields
    if (!creatorId || !amount || !phoneNumber) {
      return res.status(400).json({ 
        message: 'Missing required fields', 
        requestData: req.body 
      });
    }

    // Fetch creator's pictures and total earnings
    const pictures = await Picture.find({ ownerId: creatorId }).select('_id');
    const pictureIds = pictures.map(picture => picture._id);
    const payments = await Payment.find({ pictureId: { $in: pictureIds }, status: 'successful' });
    const totalEarnings = payments.reduce((sum, payment) => sum + payment.amount, 0);

    if (amount > totalEarnings) {
      return res.status(400).json({ 
        message: 'Insufficient funds for payout', 
        requestData: req.body 
      });
    }

    // Initiate mobile money payout
    const payoutResponse = await flw.Transfer.initiate({
      account_bank: 'RWB',
      account_number: phoneNumber,
      amount,
      narration: 'Creator earnings payout',
      currency: 'RWF',
      reference: 'PAYOUT-' + Date.now(),
      callback_url: 'http://localhost:5000/api/payout/callback',
    });

    if (payoutResponse.status === 'success') {
      console.log('Payout initiated successfully');
      res.status(200).json({ 
        message: 'Payout initiated successfully', 
        requestData: req.body 
      });
    } else {
      // Capture specific failure messages
      console.error('Payout initiation failed:', payoutResponse.message);

      // Send failure reason and server IP to the frontend
      res.status(500).json({
        message: 'Payout initiation failed: ' + payoutResponse.message,
        requestData: req.body,
        error: payoutResponse.message,
        publicIP
      });
    }
  } catch (error) {
    console.error('Error initiating payout:', error.message);
    res.status(500).json({ 
      message: 'Error initiating payout',
      requestData: req.body,
      error: error.message 
    });
  }
};


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