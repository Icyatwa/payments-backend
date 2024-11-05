// controllers/PayoutController.js
const Flutterwave = require('flutterwave-node-v3');
const Payment = require('../models/PaymentModel');
const Picture = require('../models/PictureModel');

const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);
const { getPublicIP } = require('../utils/ipUtil');

// Validate Flutterwave credentials
const validateFlutterwaveSetup = async () => {
  try {
    // Test API credentials with a simple balance check
    const balanceCheck = await flw.Balance.fetch();
    return balanceCheck.status !== 'error';
  } catch (error) {
    console.error('Flutterwave credentials validation failed:', error);
    return false;
  }
};

exports.requestPayout = async (req, res) => {
  try {
    const { creatorId, amount, phoneNumber } = req.body;
    
    // Validate Flutterwave setup first
    const isFlutterwaveValid = await validateFlutterwaveSetup();
    if (!isFlutterwaveValid) {
      return res.status(500).json({
        status: 'error',
        message: 'Payment provider configuration error',
        details: 'Please verify your Flutterwave API credentials and account setup'
      });
    }

    const publicIP = await getPublicIP();
    console.log('Current Public IP:', publicIP);

    // Enhanced validation
    if (!creatorId || !amount || !phoneNumber) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields',
        details: {
          creatorId: !creatorId ? 'Creator ID is required' : null,
          amount: !amount ? 'Amount is required' : null,
          phoneNumber: !phoneNumber ? 'Phone number is required' : null
        }
      });
    }

    // Validate phone number format for Rwanda
    const rwandaPhoneRegex = /^(250|0)?7[238]\d{7}$/;
    const formattedPhone = phoneNumber.replace(/^(\+|0)/, '');
    
    if (!rwandaPhoneRegex.test(formattedPhone)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid phone number format',
        details: 'Please provide a valid Rwandan phone number (MTN)'
      });
    }

    // Verify sufficient funds
    const pictures = await Picture.find({ ownerId: creatorId }).select('_id');
    const pictureIds = pictures.map(picture => picture._id);
    const payments = await Payment.find({ 
      pictureId: { $in: pictureIds }, 
      status: 'successful',
      type: { $ne: 'payout' } // Exclude previous payouts
    });
    
    const totalEarnings = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const previousPayouts = await Payment.find({
      userId: creatorId,
      type: 'payout',
      status: { $in: ['successful', 'pending'] }
    });
    const totalPayouts = previousPayouts.reduce((sum, payout) => sum + payout.amount, 0);
    const availableBalance = totalEarnings - totalPayouts;

    if (amount > availableBalance) {
      return res.status(400).json({
        status: 'error',
        message: 'Insufficient funds for payout',
        details: {
          requested: amount,
          available: availableBalance,
          totalEarnings,
          totalPayouts
        }
      });
    }

    // Updated transfer payload with more detailed metadata
    const transferPayload = {
      account_bank: 'MPS',
      account_number: formattedPhone,
      amount: amount,
      narration: `Payout to ${formattedPhone} - Creator earnings`,
      currency: 'RWF',
      reference: `PAYOUT-${creatorId}-${Date.now()}`,
      beneficiary_name: 'MTN Mobile Money User',
      meta: {
        sender: 'Picture Platform',
        mobile_number: formattedPhone,
        email: 'support@yourplatform.com',
        creator_id: creatorId,
        payout_type: 'creator_earnings'
      },
      callback_url: `${process.env.BASE_URL}/api/payout/callback`,
      debit_currency: 'RWF'
    };

    console.log('Initiating transfer with payload:', transferPayload);

    const payoutResponse = await flw.Transfer.initiate(transferPayload);
    console.log('Flutterwave response:', payoutResponse);

    if (payoutResponse.status === 'success') {
      // Record the payout attempt
      await new Payment({
        tx_ref: transferPayload.reference,
        amount: amount,
        currency: 'RWF',
        status: 'pending',
        phoneNumber: formattedPhone,
        userId: creatorId,
        pictureId: pictureIds[0],
        type: 'payout',
        meta: {
          flutterwave_transfer_id: payoutResponse.data?.id,
          initiation_response: payoutResponse
        }
      }).save();

      return res.status(200).json({
        status: 'success',
        message: 'Payout initiated successfully',
        reference: transferPayload.reference,
        details: payoutResponse.data
      });
    } else {
      // Enhanced error handling
      let errorResponse = {
        status: 'error',
        message: 'Payout initiation failed',
        reference: transferPayload.reference,
        error: payoutResponse.message
      };

      // Specific error cases
      if (payoutResponse.message?.toLowerCase().includes('ip')) {
        errorResponse.code = 'IP_NOT_WHITELISTED';
        errorResponse.currentIP = publicIP;
        errorResponse.details = 'Please whitelist this IP address in your Flutterwave dashboard';
        return res.status(403).json(errorResponse);
      } else if (payoutResponse.message?.toLowerCase().includes('balance')) {
        errorResponse.code = 'INSUFFICIENT_BALANCE';
        errorResponse.details = 'Please fund your Flutterwave account';
        return res.status(400).json(errorResponse);
      } else if (payoutResponse.message?.toLowerCase().includes('administrator')) {
        errorResponse.code = 'ACCOUNT_CONFIGURATION';
        errorResponse.details = 'Your Flutterwave account may not be properly configured for MTN Rwanda transfers. Please verify:';
        errorResponse.checklist = [
          'Account is verified and active',
          'MTN Mobile Money Rwanda (MPS) is enabled for your account',
          'You have sufficient balance in RWF currency',
          'Your API keys are correct and have necessary permissions',
          'Your account has transfer capabilities enabled'
        ];
        return res.status(500).json(errorResponse);
      }

      return res.status(500).json(errorResponse);
    }
  } catch (error) {
    console.error('Error initiating payout:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message,
      details: 'An unexpected error occurred while processing the payout'
    });
  }
};