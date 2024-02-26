const express = require('express')
require('dotenv').config()
const app = express()
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;

// midlewere
app.use(cors())
app.use(express.json())
// RealState
// p7dlvfnnPYK301Lg


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.62rluh7.mongodb.net/?retryWrites=true&w=majority`;

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

    const userCollection = client.db("RealDB").collection('users')
    const database = client.db("RealDB").collection('properties')
    const wishlistDatabase = client.db("RealDB").collection('wishlist')
    const reviewsDatabase = client.db("RealDB").collection('reviews');
    const makeOfferDatabase = client.db("RealDB").collection('offers');
    const paymentDatabase = client.db("RealDB").collection('payments');

    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token })
    })

    const verifyToken = (req, res, next) => {
      console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'forbidden access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
      })


    }
    // use verify admin after verifyToken 
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next();
    }
    // 18-12-23 verify agent
    const verifyAgent = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'agent';
      if (!isAgent) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next();
    }

    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result)
    })
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'unauthorized access' })
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';

      }
      res.send({ admin })
    })
    app.get('/users/agent/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'unauthorized access' })
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let agent = false;
      if (user) {
        agent = user?.role === 'agent';

      }
      res.send({ agent })
    })
    app.post('/users', async (req, res) => {
      const user = req.body;
      // insert email if user doesn't exists
      // you can do this many ways (1.email unique 2.upsert 3.simple checking)
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: 'user already exist', insertedId: null })
      }
      const result = await userCollection.insertOne(user)
      res.send(result)
    })
    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })
    // agent id
    app.patch('/users/agent/:id', verifyToken, verifyAgent, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: 'agent'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })
    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query)
      res.send(result)
    })



    // all properties api
    // app.get('/properties', async (req, res) => {
    //   const result = await database.find().toArray()
    //   res.send(result);
    // })

    app.post('/properties', async (req, res) => {
      const item = req.body;
      const result = await database.insertOne(item)
      res.send(result)
    })

    // app.js or your backend file
    app.get('/properties', async (req, res) => {
      const agentEmail = req.query.agentEmail;
      let filter = {};

      if (agentEmail) {
        filter = { agentEmail: agentEmail };
      }

      database.find(filter)
        .toArray()
        .then((result) => {
          res.send(result);
        })
        .catch((error) => {
          res.status(500).json({ message: 'Internal Server Error' });
        });
    });
    app.put('/properties/:id', async (req, res) => {
      const propertyId = req.params.id;
      const { verificationStatus } = req.body;

      const updatedDoc = {
        $set: { verificationStatus: verificationStatus },
      };

      try {
        const updatedProperty = await database.findOneAndUpdate(
          { _id: new ObjectId(propertyId) },
          updatedDoc,
          { returnDocument: 'after' }
        );

        if (updatedProperty.value) {
          res.json({ success: true, property: updatedProperty.value });
        } else {
          res.status(404).json({ success: false, message: 'Property not found' });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
      }
    });
    // admin verify updating
    app.put('/properties/:id/verify', async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };

      // Update the verification status to "verified"
      const offer = await database.findOneAndUpdate(
        query,
        { $set: { verificationStatus: "verified" } },
        { new: true }
      );
      res.send(offer);

    });
    app.put('/properties/:id/reject', (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };

      // Remove the property from the database
      database.findOneAndDelete(query)
        .then(deletedProperty => {
          if (!deletedProperty) {
            return res.status(404).json({ error: 'Property not found' });
          }

          res.send({ message: 'Property rejected successfully' });
        })
        .catch(error => {
          console.error(error);
          res.status(500).json({ error: 'Internal Server Error' });
        });
    });


    // updated the agent property
    app.patch('/properties/:id', async (req, res) => {
      const updatedData = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const propertiesToUpdate = {
        $set: {
          propertyTitle: updatedData.propertyTitle,
          propertyLocation: updatedData.propertyLocation,
          propertyImage: updatedData.propertyImage,
          agentName: updatedData.agentName,
          agentEmail: updatedData.agentEmail,
          priceRange: updatedData.priceRange,
        },
      };
      console.log(propertiesToUpdate)

      try {
        const result = await database.updateOne(filter, propertiesToUpdate);
        res.send({ success: true, result });
      } catch (error) {
        console.error('Error updating document:', error);
        res.status(500).send({ success: false, error: 'Internal Server Error' });
      }
    });




    app.get('/properties/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const options = {
        projection: {
          propertyTitle: 1, propertyLocation: 1, propertyImage: 1, agentName: 1, agentEmail: 1, agentImage: 1, verificationStatus: 1, priceRange: 1
        }
      }
      const result = await database.findOne(query, options)
      res.send(result)
    })
    // wishlist item 
    app.get('/wishlist', async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const result = await wishlistDatabase.find(query).toArray()
      res.send(result)
    })
    app.get('/wishlist/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await wishlistDatabase.findOne(query)
      res.send(result)
    })
    app.post('/wishlist', async (req, res) => {
      const listItem = req.body;
      const result = await wishlistDatabase.insertOne(listItem)
      res.send(result)
    })

    // delete wishlistcard
    app.delete('/wishlist/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await wishlistDatabase.deleteOne(query);
      res.send(result)
    })

    // review set up
    app.post('/reviews', async (req, res) => {
      const { propertyId, userEmail, reviewText, propertyTitle, userDisplayName, userPhotoURL } = req.body;
      const review = {
        propertyId: new ObjectId(propertyId),
        userEmail,
        reviewText,
        propertyTitle,
        userDisplayName,
        userPhotoURL,
        timestamp: new Date(),
      };
      const result = await reviewsDatabase.insertOne(review);
      res.json({ success: true, insertedId: result.insertedId });
    });
    app.get('/reviews/:propertyId', async (req, res) => {
      const propertyId = req.params.propertyId;
      const reviews = await reviewsDatabase.find({ propertyId: new ObjectId(propertyId) }).toArray();

      res.json(reviews);
    });

    // create make offers
    app.post('/makeoffer', async (req, res) => {
      const {
        propertyId, propertyTitle, propertyImage, propertyLocation, agentName, agentEmail, offeredAmount, buyerEmail, buyerName, verificationStatus,
        buyingDate,
      } = req.body;

      const offer = {
        propertyId, propertyTitle, propertyImage, propertyLocation, agentName, agentEmail, offeredAmount, buyerEmail, buyerName, verificationStatus,
        buyingDate,
        timestamp: new Date(),
      };

      const result = await makeOfferDatabase.insertOne(offer);
      res.send({ success: true, insertedId: result.insertedId });
    });
    // requested properties
    app.get('/makeoffer', async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const result = await makeOfferDatabase.find(query).toArray()
      res.send(result)
    })
    app.put("/makeoffer/:id/accept", async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };

      // Find the offer and update verificationStatus to "accepted"

      const offer = await makeOfferDatabase.findOneAndUpdate(
        query,
        { $set: { verificationStatus: "accepted" } },
        { new: true }
      );
      // Automatically reject other offers for the same property
      await makeOfferDatabase.updateMany(
        { propertyId: offer.propertyId, _id: { $ne: offer._id } },
        { $set: { verificationStatus: "rejected" } }
      );

      res.send(offer);
    });


    app.put("/makeoffer/:id/reject", async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      const offer = await makeOfferDatabase.findOneAndUpdate(
        query,
        { verificationStatus: "rejected" },
        { new: true }
      );
      res.send(offer);
    });
    //  user review own-check
    app.get('/reviews', (req, res) => {
      const userEmail = req.query.userEmail;

      reviewsDatabase
        .find({ userEmail })
        .toArray()
        .then((userReviews) => {
          res.json(userReviews);
        })
        .catch((error) => {
          console.error('Error fetching user reviews', error);
          res.status(500).json({ error: 'Internal server error' });
        });
    });
    // Express route for fetching user reviews
    app.get('/user-reviews', async (req, res) => {
      try {
        const userReviews = await reviewsDatabase.find().toArray();
        res.send(userReviews);
      } catch (error) {
        console.error('Error fetching user reviews:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // Express route for deleting a review
    app.delete('/reviews/:id', async (req, res) => {
      const reviewId = req.params.id;

      try {
        // Delete the review from the database using the reviewId
        await reviewsDatabase.deleteOne({ _id: new ObjectId(reviewId) });

        // Respond with success

        res.send({ success: true });
      } catch (error) {
        console.error('Error deleting review:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });



    app.delete('/reviews/:id', (req, res) => {
      const reviewId = req.params.id;

      reviewsDatabase
        .deleteOne({ _id: new ObjectId(reviewId) })
        .then((result) => {
          if (result.deletedCount === 1) {
            res.json({ success: true });
          } else {
            res.status(404).json({ error: 'Review not found' });
          }
        })
        .catch((error) => {
          console.error('Error deleting review', error);
          res.status(500).json({ error: 'Internal server error' });
        });
    });
    // brought properties
    app.get('/makeoffer', (req, res) => {
      const buyerEmail = req.query.buyerEmail;
      
      makeOfferDatabase
        .find({ buyerEmail })
        .toArray()
        .then((boughtProperties) => {
          res.json(boughtProperties);
        })
        .catch((error) => {
          console.error('Error fetching bought properties', error);
          res.status(500).json({ error: 'Internal server error' });
        });
    });

    // payment intent 
    app.post('/create-payment-intent', async (req, res) => {
      const { offeredAmount } = req.body;
      const amount = parseInt(offeredAmount * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']

      })
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })
    // 
    app.get('/payments/:email', verifyToken, async (req, res) => {
      const query = { email: req.params.email }
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const result = await paymentDatabase.find(query).toArray();
      res.send(result);
    })
    app.get('/payments/:agentEmail', verifyToken, async (req, res) => {
      const query = { agentEmail: req.params.agentEmail }
      if (req.params.agentEmail !== req.decoded.agentEmail) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const result = await paymentDatabase.find(query).toArray();
      res.send(result);
    })
    
    app.get('/payments', verifyToken, async (req, res) => {
      const agentEmail = req.params.agentEmail; 
      const query = { agentEmail: agentEmail, verificationStatus: 'accepted' };
      try {
        const result = await paymentDatabase.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error('Backend Error:', error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentDatabase.insertOne(payment)
      const query = {
        _id: {
          $in: payment.offerId.map(id => new ObjectId(id))
        }
      }
      const deleteResult = await makeOfferDatabase.deleteMany(query)
      res.send({ paymentResult, deleteResult })
    })

    app.get('/admin-stats', verifyToken, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const properties = await database.estimatedDocumentCount();
      const wishlist = await wishlistDatabase.estimatedDocumentCount();
      const paymentsCollection = await paymentDatabase.estimatedDocumentCount();
      const result = await paymentDatabase.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: '$offeredAmount'
            }
          }
        }
      ]).toArray();

      const revenue = result.length > 0 ? result[0].totalRevenue : 0;


      res.send({
        users,
        properties,
        wishlist,
        paymentsCollection,
        revenue
      })
    })
    app.get('/agent-stats/:agentEmail', async (req, res) => {
      const agentEmail = req.params.agentEmail;
      const properties = await database.estimatedDocumentCount({ agentEmail })
      res.send({
        properties
      });
    });


    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('real state server is running')
})

app.listen(port, () => {
  console.log(`real state server is running on the port${port}`)
})