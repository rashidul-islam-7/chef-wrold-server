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
  const usersCollection = allUserCollection.collection("users");

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
      const userEmail = req.query.email;

      if (!userEmail) {
        return res.status(400).send({
          success: false,
          message: "Unauthorized access! Email is required.",
        });
      }

      const result = await allRecipeCollection.deleteOne({
        _id: new ObjectId(id),
        authorEmail: userEmail,
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
};

run();

app.listen(port, () => {
  console.log(`Sever Successfully run on port-${port}`);
});
