// controllers/PictureController.js
const Picture = require('../models/PictureModel');
const Payment = require('../models/PaymentModel');

exports.uploadPicture = async (req, res) => {
  try {
    const { url, price, ownerId } = req.body;

    if (!url || !price || !ownerId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Save picture and retrieve its ID directly from MongoDB
    const picture = new Picture({ url, price, ownerId });
    await picture.save();

    res.status(201).json({ message: 'Picture uploaded successfully', pictureId: picture._id, picture });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading picture' });
  }
};

exports.getAllPictures = async (req, res) => {
  try {
    const pictures = await Picture.find();
    res.status(200).json(pictures);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pictures' });
  }
};

exports.getEarnings = async (req, res) => {
  try {
    const { creatorId } = req.params;

    // Get all pictures by the creator
    const creatorPictures = await Picture.find({ ownerId: creatorId });

    // Retrieve all successful payments for these pictures
    const pictureIds = creatorPictures.map(picture => picture._id);
    const payments = await Payment.find({
      pictureId: { $in: pictureIds },
      status: 'successful'
    });

    // Calculate total earnings
    const totalEarnings = payments.reduce((sum, payment) => sum + payment.amount, 0);

    res.status(200).json({ totalEarnings, paymentCount: payments.length });
  } catch (error) {
    console.error('Error calculating earnings:', error);
    res.status(500).json({ message: 'Error calculating earnings' });
  }
};