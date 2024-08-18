const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.j10pchd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("products");
    const usersCollection = database.collection("users");
    const itemsCollection = database.collection("items");



    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    

    // Middleware to verify JWT
    const verifyToken = (req, res, next) => {
      console.log("Inside verifyToken", req.headers);

      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return res
          .status(401)
          .send({ message: "No authorization header provided" });
      }

      const token = authHeader.split(" ")[1]; // Assuming 'Bearer <token>'

      if (!token) {
        return res
          .status(401)
          .send({ message: "Invalid authorization format" });
      }

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Token verification failed" });
        }
        req.decoded = decoded;
        next();
      });
    };

    app.put("/user", async (req, res) => {
      const user = req.body;

      const isExist = await usersCollection.findOne({ email: user?.email });
      if (isExist) return res.send(isExist);

      const option = { upsert: true };

      const query = { email: user?.email };
      const updateDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc, option);
      res.send(result);
    });



    app.post('/item', async (req, res) => {
      const newItem = req.body;
      const result = await itemsCollection.insertOne(newItem);
      res.send(result);
    });



    app.get("/all-product", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 8;
      
      const brand = req.query.brand || '';
      const category = req.query.category || '';
      const minPrice = parseFloat(req.query.minPrice) || 0;
      const maxPrice = parseFloat(req.query.maxPrice) || Infinity;
      const searchQuery = req.query.search || '';
      const sort = req.query.sort || 'price_asc'; // Default sorting
    
      const skip = (page - 1) * limit;
    
      const filterCondition = {
        ...(brand && { brand: { $regex: brand, $options: "i" } }),
        ...(category && { category: { $regex: category, $options: "i" } }),
        price: { $gte: minPrice, $lte: maxPrice },
        ...(searchQuery && { name: { $regex: searchQuery, $options: "i" } }),
      };
    
      const sortOptions = {
        'price_asc': { price: 1 },
        'price_desc': { price: -1 },
        'date_added_desc': { dateAdded: -1 }
      };
    
      const totalItems = await itemsCollection.countDocuments(filterCondition);
      const totalPages = Math.ceil(totalItems / limit);
    
      const result = await itemsCollection
        .find(filterCondition)
        .sort(sortOptions[sort] || sortOptions['price_asc']) // Apply sorting
        .skip(skip)
        .limit(limit)
        .toArray();
    
      res.send({
        products: result,
        currentPage: page,
        totalPages,
        totalItems,
      });
    });
    
    

    app.get('/user', async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.send(users);
      } catch (error) {
        console.error("Failed to retrieve users:", error);
        res.status(500).send({ message: "Failed to retrieve users" });
      }
    });

    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("product server is running");
});

app.listen(port, () => {
  console.log(`product server is running ${port}`);
});
