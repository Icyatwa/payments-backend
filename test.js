// there are other data above i didn't add because they're not that important, let's focus on those below

// AdSpaceModel.js  this is for the web owner
const adSpaceSchema = new mongoose.Schema({
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdCategory', required: true },
  spaceType: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  availability: { type: String, required: true },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  userCount: { type: Number, default: 0 },
  instructions: { type: String },
  apiCodes: {
    HTML: { type: String },
    JavaScript: { type: String },
    PHP: { type: String },
    Python: { type: String },
  },
  selectedAds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ImportAd' }],
  createdAt: { type: Date, default: Date.now },
  webOwnerEmail: { type: String, required: true },
});

// AdSpaceController.js  this is for the web owner
const generateApiCodesForAllLanguages = (spaceId, websiteId, categoryId, startDate = null, endDate = null) => {
  const apiUrl = `http://localhost:5000/api/ads/display?space=${spaceId}&website=${websiteId}&category=${categoryId}`;

  const dateCheckScript = startDate && endDate
    ? `
      const now = new Date();
      const start = new Date("${startDate}");
      const end = new Date("${endDate}");
      if (now >= start && now <= end) {
        var ad = document.createElement('script');
        ad.src = "${apiUrl}";
        document.getElementById("${spaceId}-ad").appendChild(ad);
      }
    `
    : `
      var ad = document.createElement('script');
      ad.src = "${apiUrl}";
      document.getElementById("${spaceId}-ad").appendChild(ad);
    `;

  const apiCodes = {
    HTML: `<script src="${apiUrl}"></script>`,
    JavaScript: `<script>
                  (function() {
                    ${dateCheckScript}
                  })();
                </script>`,
    PHP: `<?php echo '<div id="${spaceId}-ad"><script src="${apiUrl}"></script></div>'; ?>`,
    Python: `print('<div id="${spaceId}-ad"><script src="${apiUrl}"></script></div>')`,
  };

  return apiCodes;
};

exports.createSpace = async (req, res) => {
  try {
    const { categoryId, spaceType, price, availability, userCount, instructions, startDate, endDate, webOwnerEmail } = req.body;

    if (!categoryId || !spaceType || !price || !availability || !userCount) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    // Retrieve website ID from the category
    const category = await AdCategory.findById(categoryId).populate('websiteId');
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    const websiteId = category.websiteId._id;

    // Create new AdSpace
    const newSpace = new AdSpace({
      categoryId,
      spaceType,
      price,
      availability,
      userCount,
      instructions,
      startDate,
      endDate,
      webOwnerEmail
    });
    const savedSpace = await newSpace.save();

    // Generate API codes
    const apiCodes = generateApiCodesForAllLanguages(savedSpace._id, websiteId, categoryId, startDate, endDate);
    savedSpace.apiCodes = apiCodes;
    await savedSpace.save();

    res.status(201).json(savedSpace);
  } catch (error) {
    console.error('Error saving ad space:', error);
    res.status(500).json({ message: 'Failed to create ad space', error });
  }
};

// ImportAdModel.js this is for the ad owner
const importAdSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  imageUrl: { type: String },
  pdfUrl: { type: String },
  videoUrl: { type: String },
  businessName: { type: String, required: true },
  businessLocation: { type: String, required: true },
  adDescription: { type: String, required: true },
  selectedWebsites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Website' }],
  selectedCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AdCategory' }],
  selectedSpaces: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AdSpace' }],
  approved: { type: Boolean, default: false },
});

// ImportAdController.js  this is for the ad owner
exports.createImportAd = [upload.single('file'), async (req, res) => {
  try {
    const {
      userId,
      businessName,
      businessLocation,
      adDescription,
      selectedWebsites,
      selectedCategories,
      selectedSpaces
    } = req.body;
    const websitesArray = JSON.parse(selectedWebsites);
    const categoriesArray = JSON.parse(selectedCategories);
    const spacesArray = JSON.parse(selectedSpaces);

    let imageUrl = '';
    let pdfUrl = '';
    let videoUrl = '';

    // Create ImportAd entry
    const newRequestAd = new ImportAd({
      userId,
      imageUrl,
      pdfUrl,
      videoUrl,
      businessName,
      businessLocation,
      adDescription,
      selectedWebsites: websitesArray,
      selectedCategories: categoriesArray,
      selectedSpaces: spacesArray
    });
    const savedRequestAd = await newRequestAd.save();

    await AdSpace.updateMany(
      { _id: { $in: spacesArray } }, 
      { $push: { selectedAds: savedRequestAd._id } }
    );
    res.status(201).json(savedRequestAd);
}];

// AdApprovalController.js  this is for the web owner
exports.getPendingAds = async (req, res) => {
  try {
    const pendingAds = await ImportAd.find({ approved: false }).populate('selectedSpaces');
    res.status(200).json(pendingAds);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pending ads' });
  }
};

exports.approveAd = async (req, res) => {
  try {
    const { adId } = req.params;
    const updatedAd = await ImportAd.findByIdAndUpdate(adId, { approved: true }, { new: true });

    if (!updatedAd) {
      return res.status(404).json({ message: 'Ad not found' });
    }

    res.status(200).json({ message: 'Ad approved successfully', ad: updatedAd });
  } catch (error) {
    res.status(500).json({ message: 'Error approving ad' });
  }
};

// AdDisplayController.js  this is for the web owner
exports.displayAd = async (req, res) => {
  try {
    const { space, website, category } = req.query;
    const adSpace = await AdSpace.findById(space).populate({
      path: 'selectedAds',
      match: { approved: true }, // Only retrieve approved ads
    });
    
    if (!adSpace || adSpace.selectedAds.length === 0) {
      return res.status(404).send('No ads available for this space');
    }

    const currentDate = new Date();
    const { startDate, endDate, availability } = adSpace;
    if (
      (availability === 'Reserved for future date' || availability === 'Pick a date') &&
      (currentDate < new Date(startDate) || currentDate > new Date(endDate))
    ) {
      return res.status(403).send('Ad is not available during this time period.');
    }

    const userCount = adSpace.userCount;
    const adsToShow = adSpace.selectedAds.slice(0, userCount);
    const adsHtml = adsToShow
      .map((selectedAd) => {
        const imageUrl = selectedAd.imageUrl ? `http://localhost:5000${selectedAd.imageUrl}` : '';
        return `
          <div class="ad">
            <h3>${selectedAd.businessName}</h3>
            <p>${selectedAd.adDescription}</p>
            ${imageUrl ? `<img src="${imageUrl}" alt="Ad Image">` : ''}
            ${selectedAd.pdfUrl ? `<a href="${selectedAd.pdfUrl}" target="_blank">Download PDF</a>` : ''}
            ${selectedAd.videoUrl ? `<video src="${selectedAd.videoUrl}" controls></video>` : ''}
          </div>
        `;
      })
      .join('');

    res.status(200).send(adsHtml);
};

// DashboardLayout.js  this is for the web owner
import { useAuth } from "@clerk/clerk-react"

export default function DashboardLayout() {
  const { userId, isLoaded } = useAuth()
  const navigate = useNavigate()

  React.useEffect(() => {
    if (!userId) {
      navigate("/sign-in")
    }
  }, [])

  return (
    <Outlet />
  )
}

// root-layout.js  this is for the web owner
import { Link, Outlet } from 'react-router-dom';
import { ClerkProvider, SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';

const PUBLISHABLE_KEY = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;
export default function RootLayout() {

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
    >
      <SignedIn>
        <UserButton afterSignOutUrl='/sign-in' />
      </SignedIn>

      <SignedOut>
        <Link to="/sign-in" style={linkStyles}>Sign In</Link>
      </SignedOut>
      <main>
        <Outlet />
      </main>
    </ClerkProvider>
  );
}

// sign-in.js  this is for the web owner
import { SignIn } from "@clerk/clerk-react";
export default function SignInPage() {
  return (
    <div>
      <SignIn />
    </div>
  );
}

// sign-up.js  this is for the web owner
import { SignUp } from "@clerk/clerk-react";
export default function SignUpPage() {
  return (
    <div>
      <SignUp />
    </div>
  );
}

// Spaces.js this is for the web owner 
import { useUser } from '@clerk/clerk-react'

function Spaces() {
  const { user } = useUser();
  const webOwnerEmail = user.primaryEmailAddress.emailAddress;

  const submitSpacesToDatabase = async () => {
    setLoading(true);
    try {
      for (const category in spaces) {
        const spaceData = spaces[category];
        const categoryId = selectedCategories[category]?.id;

        if (categoryId) {
          for (const spaceType of ['header', 'sidebar']) {
            if (spaceData[spaceType]) {
              const { availability, startDate, endDate, price, userCount, instructions } = spaceData[spaceType];
              // Submit the ad space data
              await axios.post('http://localhost:5000/api/ad-spaces', {
                categoryId,
                spaceType: spaceType.charAt(0).toUpperCase() + spaceType.slice(1),
                price,
                availability,
                userCount,
                instructions: instructions || '',
                startDate,
                endDate,
                webOwnerEmail
              });
            }
          }
        }
      }
      setLoading(false);
      alert('Ad spaces created successfully!');
}
the ads waits for being approved the system must send an email to the web owner(the one who created a space that the as owner selected when he was importing his ad) and approve it, because the web owner might not be informed that there's someone who wants to advertise on his web, so he must be notified on gmail because the system uses clerk as an authentication they sign in by using google or by continuing with google, so i want that email to be sent to the email he used when creating account. the clerk authentication is built in frontenf and that's where its API is, the one who sends these data is the ad owner, use resend and im new to it so go step by step until i test it and see an email in my gmail