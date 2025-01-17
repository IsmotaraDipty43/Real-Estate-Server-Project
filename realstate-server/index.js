const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
const app = express();
const cors = require("cors");
require("dotenv").config()
const jwt = require('jsonwebtoken');
const stripe=require('stripe')(process.env.SECRECT_KEY_STRIPE)
const admin = require("firebase-admin"); 
const serviceAccount = require("./realstate-be053-firebase-adminsdk-kg6ud-d4293adbca.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const port = process.env.PORT || 5001;


app.use(cors({

  origin: ['http://localhost:5173','http://localhost:5174', 'https://realstate-be053.web.app', 'https://realstate-be053.firebaseapp.com'], 
}
));


app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xsfs6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    // await client.connect();
    const propertiyCollection = client.db('realStateDB').collection('properties')
    const reviewCollection = client.db('realStateDB').collection('reviews')
    const userCollection = client.db('realStateDB').collection('users')
    const wishCollection = client.db('realStateDB').collection('wishlist')
    const OfferCollection = client.db('realStateDB').collection('Offer')


    app.post('/jwt', async (req, res) => {
      const user = req.body; 
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.send({ token });
    });
    

// Middleware to verify the JWT token
const verifyToken = (req, res, next) => {
  console.log('Inside verifyToken middleware');
  const authorization = req.headers.authorization;

  // Check if the Authorization header exists
  if (!authorization) {
    return res.status(401).send({ message: 'Authorization header missing' });
  }


  const token = authorization.split(' ')[1];


  if (!token) {
    return res.status(401).send({ message: 'Token missing' });
  }


  jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
    if (error) {
      return res.status(401).send({ message: 'Invalid or expired token', error });
    }


    req.decoded = decoded;
    next(); 
  });
};

// Middleware to verify if the user is an admin
const verifyAdmin = async (req, res, next) => {
  console.log('Inside verifyAdmin middleware');
  console.log('Decoded data:', req.decoded);

  try {
    const email = req.decoded?.email;
    if (!email) {
      return res.status(401).send({ message: 'Unauthorized: Email not found in token' });
    }

    const query = { email: { $regex: new RegExp(`^${email}$`, 'i') } };
    const user = await userCollection.findOne(query);

    console.log('User retrieved from DB:', user);  

    const isAdmin = user?.role === 'Admin';
    if (!isAdmin) {
      return res.status(403).send({ message: 'Forbidden access: Admins only' });
    }

    next();
  } catch (error) {
    console.error('Error verifying admin:', error);
    res.status(500).send({ message: 'Internal server error', error });
  }
};


app.post('/create-payment-intent', async (req, res) => {
  const { amount } = req.body;
  console.log('Amount:', amount); 
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, 
      currency: 'usd',
      payment_method_types: ['card'],
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error.message); 
    res.status(500).send({ error: error.message });
  }
});


app.patch('/offer/payment/:id', async (req, res) => {
  const { id } = req.params; 
  const { transactionId } = req.body;

  try {
    const query = { propertyId: id }; 
    const updateDoc = {
      $set: {
        status: 'bought',
        transactionId: transactionId,
      },
    };

    const result = await OfferCollection.updateOne(query, updateDoc);
    if (result.modifiedCount === 1) {
      res.send({ success: true });
    } else {
      res.status(400).send({ error: 'Offer not found or update failed' });
    }
  } catch (error) {
    console.error('Error updating offer:', error);
    res.status(500).send({ error: error.message });
  }
});
// property 

app.get('/property', async(req,res)=>{
const result= await propertiyCollection.find().toArray()
res.send(result)
})

app.get('/reviews', async (req, res) => {
  const result = await reviewCollection.find().toArray();
  res.send(result);
});

// Route to delete a review by ID
app.delete('/reviews/:id', async (req, res) => {
  const { id } = req.params;
  const result = await reviewCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});


app.delete('/users/reviews/:email', async (req, res) => {
  const { email } = req.params;

  try {

    const user = await userCollection.findOne({ email });

    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }
    const updatedReviews = user.reviews.filter(
      (review) => review.reviewerEmail !== email
    );
    const result = await userCollection.updateOne(
      { email },
      { $set: { reviews: updatedReviews } }
    );


    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error deleting the review' });
  }
});


app.get('/reviews/:title', async (req, res) => {
  const title = req.params.title; 
  const query = ({ propertyTitle: title })
  
  try {
    const result = await reviewCollection.find(query).toArray();
    res.send(result); 
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).send({ message: "An error occurred while fetching reviews" });
  }
});

app.get('/myreview/:email', async(req,res)=>{
  const email = req.params.email
  const query = ({
    reviewerEmail : email
    })
 const result = await reviewCollection.find(query).toArray()
 res.send(result)
})


app.delete('/myreview/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await reviewCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 1) {
      res.send({ message: 'Review deleted successfully' });
    } else {
      res.status(404).send({ message: 'Review not found' });
    }
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).send({ message: 'Error deleting review' });
  }
});

// Backend route for fetching users by email
app.get('/users',verifyToken, async (req, res) => {
 
  
  try {
    const user = await userCollection.find().toArray();

    if (user) {
      res.status(200).send(user); 
    } else {
      res.status(404).send({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).send({ message: 'Error fetching user data' });
  }
});

app.get('/specificuser/:email', async(req,res)=>{
  const email = req.params.email
  const query = {email : email}
  const result = await userCollection.findOne(query)
  res.send(result)
})

 app.get('/user/details', async(req,res)=>{
  const { email } = req.query;
  try {
    const user = await userCollection.findOne({ email });
    if (user) {
      res.status(200).send(user); 
    } else {
      res.status(404).send({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).send({ message: 'Error fetching user data' });
  }
  })

app.get('/users/adminuser/:email', verifyToken, async (req, res) => {
  try {
    const email = req.params.email;
    if (email !== req.decoded?.email) {
      return res.status(403).send({ message: 'Unauthorized error' });
    }
    const query = { email: { $regex: new RegExp(`^${email}$`, 'i') } };
    const user = await userCollection.findOne(query);
    const admin = user?.role === 'Admin' || false;
    res.send({ admin });
  } catch (error) {
    console.error('Error verifying admin user:', error);
    res.status(500).send({ message: 'Internal server error', error });
  }
});

  
// Promote user to admin
app.patch('/users/role/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body; 

  if (!role) {
    return res.status(400).send({ message: 'Role is required' });
  }

  if (role !== 'Admin' && role !== 'Agent') {
    return res.status(400).send({ message: 'Invalid role' });
  }

  try {
    const filter = { _id: new ObjectId(id) };
    const update = { $set: { role } };

    const result = await userCollection.updateOne(filter, update);

    if (result.modifiedCount === 0) {
      return res.status(404).send({ message: 'User not found or no changes made' });
    }

    res.send({ message: `User promoted to ${role} successfully` });
  } catch (error) {
    res.status(500).send({ message: 'Error updating user role', error: error.message });
  }
});

app.delete('/users/:email', verifyToken, verifyAdmin, async (req, res) => {
  const email = req.params.email;

  try {
 
    const user = await userCollection.findOne({
      email: { $regex: new RegExp(`^${email}$`, 'i') } 
    });

    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }
    const mongoResult = await userCollection.deleteOne({
      email: { $regex: new RegExp(`^${email}$`, 'i') } 
    });

    if (mongoResult.deletedCount === 0) {
      return res.status(404).send({ message: 'Failed to delete user from MongoDB' });
    }

    const userRecord = await admin.auth().getUserByEmail(email);
    await admin.auth().deleteUser(userRecord.uid);

    console.log(`Successfully deleted user: ${email} from Firebase`);

    res.status(200).send({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).send({ message: 'Internal server error' });
  }
});












app.post('/users', async(req,res)=>{
  const userData=req.body;
  const query = {email: userData.email}
  const existingUser = await userCollection.findOne(query)
  if(existingUser){
    return res.send({message:'user already existed', insertedId: null})
  }
  const result = await userCollection.insertOne(userData)
  res.send(result);
})



// Verify a property by ID
app.patch('/property/verify/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await propertiyCollection.updateOne(
      { _id: new ObjectId(id) }, // Use ObjectId directly here
      { $set: { verificationStatus
        : 'Verified' } }
    );

    if (!result.modifiedCount) {
      return res.send('Property not found or already verified');
    }

    res.send('Property verified successfully');
  } catch (error) {
    console.error('Error verifying property:', error);
    res.send('Failed to verify property');
  }
});


// Reject a property by ID
app.patch('/property/reject/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await propertiyCollection.updateOne(
      { _id: new ObjectId(id) }, // Use ObjectId directly here
      { $set: { verificationStatus
        : 'Rejected' } }
    );

    if (!result.modifiedCount) {
      return res.send('Property not found or already rejected');
    }

    res.send('Property rejected successfully');
  } catch (error) {
    console.error('Error rejecting property:', error);
    res.send('Failed to reject property');
  }
});



// Route to mark an agent as fraud
app.patch('/users/fraud/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Find the user in the database
    const user = await userCollection.findOne({ _id: new ObjectId(id) });

    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }

    // Check if the user is an agent
    if (user.role !== 'Agent') {
      return res.status(400).send({ message: 'User is not an agent' });
    }

    // Mark the user as fraud
    const update = {
      $set: { role: 'Fraud' },
    };

    const result = await userCollection.updateOne({ _id: new ObjectId(id) }, update);

    if (result.modifiedCount === 0) {
      return res.status(400).send({ message: 'Failed to mark user as fraud' });
    }

    // Remove properties added by the fraud agent
    await propertiyCollection.deleteMany(
      { addedBy: user.email }  // Assuming 'addedBy' holds the user's email
    );
    

    res.send({ message: 'User marked as fraud and properties removed' });

  } catch (error) {
    res.status(500).send({ message: 'Error marking user as fraud', error });
  }
});

app.post('/properties', verifyToken, async (req, res) => {
  try {
    const property = req.body;
    // Ensure priceRange is an object with minimum and maximum price
    if (property.priceRange && typeof property.priceRange === 'object') {
      const result = await propertiyCollection.insertOne(property);
      res.send(result);
    } else {
      res.status(400).send({ message: 'Invalid price range data' });
    }
  } catch (error) {
    console.error('Error adding property:', error);
    res.status(500).send({ message: 'Failed to add property' });
  }
});


app.get("/properties/:email", async (req, res) => {
  const userEmail = req.params.email;
  const query = ({ agentEmail: userEmail })
  const properties = await propertiyCollection.find(query).toArray();
   res.send(properties)
});

app.get("/property/:id",async (req, res) => {
  const id = req.params.id;
  const query = ({ _id: new ObjectId(id) })
  const properties = await propertiyCollection.findOne(query);
   res.send(properties)
});

// Endpoint to Delete a Property
app.delete("/properties/:id",verifyToken, async (req, res) => {
  const propertyId = req.params.id;
  const query =({ _id: new ObjectId(propertyId) });
  const result= await propertiyCollection.deleteOne(query)
  
    if (result.deletedCount === 1) {
      res.status(200).send({ success: true, message: "Property deleted" });
    } else {
      res.status(404).send({ success: false, message: "Property not found" });
    }
 
});

app.patch("/property/:id", async (req, res) => {
  const id = req.params.id;
  const updatedProperty = req.body;
  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      title: updatedProperty.title,
      location: updatedProperty.location,
      image: updatedProperty.image,
      priceRange: updatedProperty.priceRange,
    },
  };

  try {
    const result = await propertiyCollection.updateOne(filter, updateDoc);
    res.send({ modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error("Error updating property:", error);
    res.status(500).send({ message: "Failed to update property" });
  }
});


app.post("/wishlist", async (req, res) => {
  const {
    propertyId,
    title,
    image,
    location,
    agentName,
    agentImage,
    agentEmail,
    verificationStatus,
    priceRange,
    userEmail,
  } = req.body;

  try {
    // Insert the full property data into the wishlist collection
    await wishCollection.insertOne({
      propertyId,
      title,
      image,
      location,
      agentName,
      agentImage,
      agentEmail,
      verificationStatus,
      priceRange,
      userEmail,
    });

    // Send success response
    res.send({ message: "Property added to wishlist successfully" });
  } catch (error) {
    console.error("Error adding to wishlist:", error);

    // Send error response
    res.status(500).send({ message: "Error adding to wishlist" });
  }
});


app.get('/allwishlist', async(req,res)=>{
  const result = await wishCollection.find().toArray()
  res.send(result)
})






app.get('/wishlist/:email', async (req, res) => {
  const email = req.params.email;
 const query = ({ userEmail: email })
  try {
    const result = await wishCollection.find(query).toArray(); // Query with a filter object
    res.send(result);
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});







app.post("/reviews", async (req, res) => {
  const { propertyTitle, reviewDescription, reviewerName, reviewerImage, reviewerEmail ,agentName } = req.body; // Use the correct names

  // Create a timestamp for review creation
  const createdReviewTime = new Date().toISOString();

  try {
    const newReview = {
      reviewerEmail,        // Use the correct variable names here
      propertyTitle,
      reviewerName,
      reviewerImage,
      reviewDescription,    // Make sure this matches the frontend field
      createdReviewTime,
      agentName,
    };

    // Save the review to the database
    await reviewCollection.insertOne(newReview);
    res.send({ message: "Review added successfully" });
  } catch (error) {
    console.error("Error adding review:", error);
    res.status(500).send({ message: "Error adding review" });
  }
});


app.post('/offers', async (req, res) => {
  const offer = req.body;
  try {
    const result = await OfferCollection.insertOne(offer);
    res.send(result);
  } catch (error) {
    console.error('Error saving offer:', error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

app.get('/myoffer/:email',async(req,res)=>{
  const email = req.params.email
  const query = ({buyerEmail : email })
  const result = await OfferCollection.find(query).toArray()
  res.send(result)
})


app.get('/broughtProperty/:email',verifyToken, async (req, res) => {
  const email = req.params.email;
  const query = { agentEmail: email, status: 'bought' }; // Filter by both agentEmail and status
  try {
    const result = await OfferCollection.find(query).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: 'Failed to fetch offers' });
  }
});


app.get('/getmyoffer/:id', async (req, res) => {
  const id = req.params.id;
  const query = { propertyId: id };

  try {
    const result = await OfferCollection.findOne(query); // Return a single document
    if (result) {
      res.send(result); // Send the document directly
    } else {
      res.status(404).send({ error: 'Offer not found' });
    }
  } catch (error) {
    console.error('Error fetching offer:', error.message);
    res.status(500).send({ error: 'Server error' });
  }
});



app.get('/offer/:title', async (req, res) => {
  const title = req.params.title;
  const query = { title: title };
  const result = await OfferCollection.find(query).toArray();
  res.send(result);
});
app.patch('/offer/status/:id', async (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  const query = { _id: new ObjectId(id) };
  const updateDoc = { $set: { status: status } };
  const result = await OfferCollection.updateOne(query, updateDoc);
  res.send(result);
});
app.post('/offers/update/:propertyId', async (req, res) => {
  const { propertyId } = req.params;
  const { acceptedOfferId } = req.body;

  // Accept the selected offer
  const acceptQuery = { _id: new ObjectId(acceptedOfferId) };
  const acceptUpdate = { $set: { status: "accepted" } };
  await OfferCollection.updateOne(acceptQuery, acceptUpdate);

  // Reject all other offers for the same property
  const rejectQuery = { propertyId: propertyId, _id: { $ne: new ObjectId(acceptedOfferId) } };
  const rejectUpdate = { $set: { status: "rejected" } };
  await OfferCollection.updateMany(rejectQuery, rejectUpdate);

  res.send({ message: "Offer status updated successfully." });
});



    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




















app.get('/', (req,res)=>{
    res.send('Real-State')
})
app.listen(port, ()=>{
    console.log(`Real State server ${port}`);
})