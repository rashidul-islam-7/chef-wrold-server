const express = require("express");
const app = express();

const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ObjectId } = require("mongodb");

app.use(cors());
app.use(express.json());
dotenv.config();

const port = process.env.PORT;
const mongo_uri = process.env.MONGODB_URI;

const client = new MongoClient(mongo_uri);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const run = async () => {
  const db = client.db("chef-world");
  const allUserCollection = client.db("chef-world-users");

  const allRecipeCollection = db.collection("all-recipe");
  const usersCollection = allUserCollection.collection("user");
  const myPurchasedRecipesCollection = db.collection("my-purchased-recipes");
  const paymentsCollection = db.collection("payments");

  // get all recipe for everyone
  app.get("/recipes", async (req, res) => {
    try {
      const result = await allRecipeCollection.find().toArray();
      res.send(result);
    } catch (err) {
      res.status(500).send({ massage: err.massage });
    }
  });

  // get recipe with id
  app.get("/recipe/:id", async (req, res) => {
    try {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid ID!" });
      }
      const result = await allRecipeCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    } catch (err) {
      res.status(500).send({ message: err.message });
    }
  });

  // get my-recipe with email
  app.get("/my-recipes", async (req, res) => {
    try {
      const userEmail = req.query.email;
      if (!userEmail) {
        return res
          .status(400)
          .send({ message: "Email query parameter is required" });
      }
      const result = await allRecipeCollection
        .find({ authorEmail: userEmail })
        .toArray();

      res.send(result);
    } catch (err) {
      res.status(500).send({ message: err.message });
    }
  });

  // delete my-recipe
  app.delete("/delete-my-recipe/:id", async (req, res) => {
    try {
      const id = req.params.id;

      const result = await allRecipeCollection.deleteOne({
        _id: new ObjectId(id),
      });

      if (result.deletedCount === 1) {
        res.send({ success: true, message: "Recipe deleted successfully!" });
      } else {
        res.status(404).send({ success: false, message: "Recipe not found!" });
      }
    } catch (err) {
      res.status(500).send({ success: false, message: err.message });
    }
  });

  // post recipe
  app.post("/add-recipe", async (req, res) => {
    try {
      const recipe = req.body;
      const email = recipe.authorEmail;

      if (!email) {
        return res.status(400).send({ message: "Author email  is required!" });
      }
      const user = await usersCollection.findOne({ email });
      const countRecipe = await allRecipeCollection.countDocuments({
        authorEmail: email,
      });

      if (!user?.isPremium && countRecipe >= 2) {
        return res.status(403).send({
          message:
            "You have reached the free limit. Upgrade to Premium to add unlimited recipes",
        });
      }
      const result = await allRecipeCollection.insertOne(recipe);
      res.status(201).send(result);
    } catch (error) {
      res.status(500).send({ message: error.message });
    }
  });

  //update recipe
  app.patch("/update-recipe/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const updateRecipe = req.body;
      //check ID
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid Recipe ID!" });
      }
      const result = await allRecipeCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateRecipe },
      );
      res.send(result);
    } catch (err) {
      res.status(500).send({ message: err.message });
    }
  });

  // premium user subscription api
  app.post("/premium-user-subscription", async (req, res) => {
    try {
      const { transactionId, userId, userEmail, amount, paymentStatus } =
        req.body;

      if (
        !transactionId ||
        !userId ||
        !userEmail ||
        !amount ||
        !paymentStatus
      ) {
        return res
          .status(400)
          .send({ success: false, message: "Missing required fields" });
      }

      if (!ObjectId.isValid(userId)) {
        return res
          .status(400)
          .send({ success: false, message: "Invalid User ID" });
      }

      const isExist = await paymentsCollection.findOne({ transactionId });
      if (isExist) {
        return res
          .status(200)
          .send({ success: true, message: "Payment already recorded" });
      }

      const paymentData = {
        userEmail,
        userId: new ObjectId(userId),
        amount: parseFloat(amount),
        recipeId: null,
        transactionId,
        paymentStatus,
        paidAt: new Date(),
      };

      const result = await paymentsCollection.insertOne(paymentData);

      await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { isPremium: true } },
      );

      res.status(201).send({
        success: true,
        message: "Premium membership activated successfully!",
        insertedId: result.insertedId,
      });
    } catch (err) {
      res.status(500).send({ success: false, message: err.message });
    }
  });

  // // purchase recipe api
  // app.post("/purchase-recipe-payment", async (req, res) => {
  //   try {
  //     const {
  //       sessionId,
  //       userId,
  //       recipeId,
  //       recipeName,
  //       authorName,
  //       recipeImage,
  //       price,
  //     } = req.body;
  //     if (!sessionId || !userId || !recipeId) {
  //       return res
  //         .status(400)
  //         .send({ success: false, message: "Missing required fields" });
  //     }

  //     const isExist = await purchasedRecipesCollection.findOne({ sessionId });
  //     if (isExist) {
  //       return res.status(200).send({
  //         success: true,
  //         message: "Recipe purchase already recorded",
  //       });
  //     }

  //     const result = await purchasedRecipesCollection.insertOne({
  //       sessionId,
  //       userId,
  //       recipeId,
  //       recipeName,
  //       authorName,
  //       recipeImage,
  //       price: Number(price),
  //       createdAt: new Date(),
  //     });

  //     res.status(201).send({
  //       success: true,
  //       message: "Recipe purchased successfully",
  //       insertedId: result.insertedId,
  //     });
  //   } catch (err) {
  //     res.status(500).send({ message: err.message });
  //   }
  // });

  // purchase recipe api
  app.post("/purchase-recipe-payment", async (req, res) => {
    try {
      const {
        sessionId,
        transactionId,
        userId,
        recipeId,
        recipeName,
        authorName,
        recipeImage,
        price,
      } = req.body;

      if (!sessionId || !userId || !recipeId) {
        return res
          .status(400)
          .send({
            success: false,
            message: `Missing required fields. Received: sessionId=${sessionId}, userId=${userId}, recipeId=${recipeId}`,
          });
      }

      const isExist = await myPurchasedRecipesCollection.findOne({ sessionId });
      if (isExist) {
        return res.status(200).send({
          success: true,
          message: "Recipe purchase already recorded",
        });
      }

      const finalPrice = isNaN(Number(price)) ? 0 : Number(price);

      const result = await myPurchasedRecipesCollection.insertOne({
        sessionId,
        transactionId: transactionId || "N/A",
        userId,
        recipeId,
        recipeName: recipeName || "Unknown Recipe",
        authorName: authorName || "Unknown Author",
        recipeImage: recipeImage || "",
        price: finalPrice,
        createdAt: new Date(),
      });

      res.status(201).send({
        success: true,
        message: "Recipe purchased successfully",
        insertedId: result.insertedId,
      });
    } catch (err) {
      console.error("EXPRESS DATABASE ERROR:", err); 
      res.status(500).send({ success: false, message: err.message });
    }
  });
};

run();

app.listen(port, () => {
  console.log(`Sever Successfully run on port-${port}`);
});
