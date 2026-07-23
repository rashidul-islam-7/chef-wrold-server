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

  const likesCollection = db.collection("likes");
  const favoritesCollection = db.collection("favorites");

  const reportsCollection = db.collection("reports");
  const featuredRecipesCollection = db.collection("featuredRecipes");

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
  app.delete("/delete-recipe/:id", async (req, res) => {
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
        return res.status(400).send({
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

  // get my purchased recipes with userId
  app.get("/my-purchased-recipes/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      if (!userId) {
        return res
          .status(400)
          .send({ success: false, message: "User ID is required" });
      }

      const query = { userId: userId };
      const result = await myPurchasedRecipesCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      res.status(200).send(result);
    } catch (err) {
      console.error("Error fetching purchased recipes:", err);
      res.status(500).send({ success: false, message: err.message });
    }
  });

  // like
  app.put("/recipes/:id/like", async (req, res) => {
    try {
      const recipeId = req.params.id;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const existingLike = await likesCollection.findOne({ recipeId, userId });

      let updatedCountModifier = 1;
      let isLikedNow = true;

      if (existingLike) {
        await likesCollection.deleteOne({ _id: existingLike._id });
        updatedCountModifier = -1;
        isLikedNow = false;
      } else {
        await likesCollection.insertOne({
          recipeId,
          userId,
          createdAt: new Date(),
        });
      }

      const updateResult = await allRecipeCollection.findOneAndUpdate(
        { _id: new ObjectId(recipeId) },
        { $inc: { likesCount: updatedCountModifier } },
        { returnDocument: "after" },
      );

      const updatedRecipe = updateResult.value || updateResult;

      res.status(200).json({
        success: true,
        likesCount: updatedRecipe?.likesCount || 0,
        isLiked: isLikedNow,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server Error" });
    }
  });

  // unlike status
  app.get("/recipes/:id/like-status", async (req, res) => {
    try {
      const recipeId = req.params.id;
      const { userId } = req.query;

      if (!userId) {
        return res.json({ isLiked: false });
      }

      const existingLike = await likesCollection.findOne({ recipeId, userId });
      res.json({ isLiked: !!existingLike });
    } catch (error) {
      res.json({ isLiked: false });
    }
  });

  app.get("/favorites", async (req, res) => {
    try {
      const { userId, recipeId } = req.query;

      if (!userId) {
        return res
          .status(400)
          .send({ message: "User ID (userId) is required!" });
      }
      if (recipeId) {
        const favorite = await favoritesCollection.findOne({
          userId,
          recipeId,
        });
        return res.send({ isFavorite: !!favorite });
      }
      const userFavorites = await favoritesCollection
        .find({ userId })
        .toArray();

      const favoriteRecipeIds = userFavorites.map(
        (fav) => new ObjectId(fav.recipeId),
      );

      const favoriteRecipes = await allRecipeCollection
        .find({ _id: { $in: favoriteRecipeIds } })
        .toArray();

      res.send(favoriteRecipes);
    } catch (err) {
      res.status(500).send({ message: err.message });
    }
  });

  app.put("/favorites", async (req, res) => {
    try {
      const { userId, recipeId } = req.body;

      if (!userId || !recipeId) {
        return res
          .status(400)
          .send({ message: "userId and recipeId are required!" });
      }

      if (!ObjectId.isValid(recipeId)) {
        return res.status(400).send({ message: "Invalid Recipe ID!" });
      }

      const existingFavorite = await favoritesCollection.findOne({
        userId,
        recipeId,
      });

      let updatedCountModifier = 1;
      let isFavoritedNow = true;

      if (existingFavorite) {
        await favoritesCollection.deleteOne({ _id: existingFavorite._id });
        updatedCountModifier = -1;
        isFavoritedNow = false;
      } else {
        await favoritesCollection.insertOne({
          userId,
          recipeId,
          createdAt: new Date(),
        });
        updatedCountModifier = 1;
      }

      await allRecipeCollection.updateOne(
        { _id: new ObjectId(recipeId) },
        { $inc: { favoriteCount: updatedCountModifier } },
      );

      res.status(200).send({
        success: true,
        isFavorite: isFavoritedNow,
        message: isFavoritedNow
          ? "Recipe added to favorites"
          : "Recipe removed from favorites",
      });
    } catch (err) {
      res.status(500).send({ message: err.message });
    }
  });

  app.delete("/remove-favorite/:id", async (req, res) => {
    try {
      const recipeId = req.params.id;
      const { userId } = req.body;

      if (!userId || !recipeId) {
        return res.status(400).send({
          success: false,
          message: "userId and recipeId are required!",
        });
      }

      const deleteResult = await favoritesCollection.deleteOne({
        userId: userId,
        recipeId: recipeId,
      });

      if (deleteResult.deletedCount === 0) {
        return res
          .status(404)
          .send({ success: false, message: "Favorite recipe not found!" });
      }
      await allRecipeCollection.updateOne(
        { _id: new ObjectId(recipeId) },
        { $inc: { favoriteCount: -1 } },
      );

      res.status(200).send({
        success: true,
        message: "Recipe permanently removed from favorites",
      });
    } catch (err) {
      res.status(500).send({ success: false, message: err.message });
    }
  });

  // dashboard api
  app.get("/user-stats/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res
          .status(400)
          .send({ success: false, message: "User ID is required" });
      }
      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
      if (!user) {
        return res
          .status(404)
          .send({ success: false, message: "User not found" });
      }
      const userEmail = user.email;

      const totalRecipes = await allRecipeCollection.countDocuments({
        authorEmail: userEmail,
      });
      const recipes = await allRecipeCollection
        .find({ authorEmail: userEmail })
        .toArray();
      const totalLikes = recipes.reduce(
        (sum, recipe) => sum + (recipe.likesCount || 0),
        0,
      );
      const totalFavorites = await favoritesCollection.countDocuments({
        userId: userId,
      });
      res.status(200).send({
        success: true,
        stats: {
          totalRecipes,
          totalLikes,
          totalFavorites,
        },
      });
    } catch (err) {
      console.error("Error fetching user stats:", err);
      res.status(500).send({ success: false, message: err.message });
    }
  });

  //-------------- admin routes api -------------
  // Admin Dashboard Overview API
  app.get("/admin/dashboard", async (req, res) => {
    try {
      const [totalUsers, totalRecipes, totalPremiumMembers, totalReports] =
        await Promise.all([
          usersCollection.countDocuments(),
          allRecipeCollection.countDocuments(),
          usersCollection.countDocuments({ isPremium: true }),
          reportsCollection.countDocuments(),
        ]);

      res.status(200).send({
        totalUsers,
        totalRecipes,
        totalPremiumMembers,
        totalReports,
      });
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      res
        .status(500)
        .send({ message: "Failed to fetch dashboard overview metrics." });
    }
  });

  // admin users list api
  app.get("/admin/users", async (req, res) => {
    try {
      const users = await usersCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();
      res.send(users);
    } catch (err) {
      res.status(500).send({ message: err.message });
    }
  });

  // User Block API
  app.patch("/admin/users/block/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid ID format" });
      }

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { isBlocked: true } },
      );

      if (result.matchedCount === 0) {
        return res.status(404).send({ message: "User not found" });
      }

      res.send({
        success: true,
        message: "User blocked successfully",
        result,
      });
    } catch (err) {
      res.status(500).send({ message: err.message });
    }
  });

  // User Unblock API
  app.patch("/admin/users/unblock/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid ID format" });
      }

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { isBlocked: false } },
      );

      if (result.matchedCount === 0) {
        return res.status(404).send({ message: "User not found" });
      }

      res.send({
        success: true,
        message: "User unblocked successfully",
        result,
      });
    } catch (err) {
      res.status(500).send({ message: err.message });
    }
  });

  // recipe feature add and delete toggle
  app.patch("/recipes/:id/feature", async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ success: false, message: "Invalid ID" });
      }

      const recipe = await allRecipeCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!recipe) {
        return res
          .status(404)
          .send({ success: false, message: "Recipe not found" });
      }

      const featured = await featuredRecipesCollection.findOne({
        recipeId: id,
      });

      if (featured) {
        await featuredRecipesCollection.deleteOne({ recipeId: id });
        return res.send({
          success: true,
          featured: false,
          message: "Recipe removed from featured",
        });
      }

      await featuredRecipesCollection.insertOne({
        recipeId: id,
        featuredAt: new Date(),
      });

      res.send({
        success: true,
        featured: true,
        message: "Recipe added to featured",
      });
    } catch (err) {
      res.status(500).send({ success: false, message: err.message });
    }
  });

  // get featured recipes
  app.get("/featured-recipes", async (req, res) => {
    try {
      const recipes = await featuredRecipesCollection
        .aggregate([
          {
            $addFields: {
              recipeObjectId: { $toObjectId: "$recipeId" },
            },
          },
          {
            $lookup: {
              from: "allRecipe",
              localField: "recipeObjectId",
              foreignField: "_id",
              as: "recipeDetails",
            },
          },
          { $unwind: "$recipeDetails" },
          {
            $project: {
              _id: "$recipeDetails._id",
              recipeId: "$recipeId",
              title: "$recipeDetails.title",
              image: "$recipeDetails.image",
              category: "$recipeDetails.category",
              cuisine: "$recipeDetails.cuisine",
              author: "$recipeDetails.author",
              featuredAt: 1,
            },
          },
          { $sort: { featuredAt: -1 } },
        ])
        .toArray();

      res.send(recipes);
    } catch (err) {
      res.status(500).send({ message: err.message });
    }
  });

  // ==================== RECIPE REPORT SYSTEM ====================

  // 1. Submit a Recipe Report (User)
  app.post("/reports", async (req, res) => {
    try {
      const { recipeId, userId, userName, userEmail, reason, details } =
        req.body;

      if (!recipeId || !reason) {
        return res.status(400).send({
          success: false,
          message: "Recipe ID and Reason are required.",
        });
      }

      const reportData = {
        recipeId,
        userId: userId || "Anonymous",
        userName: userName || "Unknown User",
        userEmail: userEmail || "N/A",
        reason, // "Spam", "Offensive Content", "Copyright Issue"
        details: details || "",
        reportedAt: new Date(),
      };

      const result = await reportsCollection.insertOne(reportData);

      res.status(201).send({
        success: true,
        message: "Report submitted successfully!",
        insertedId: result.insertedId,
      });
    } catch (err) {
      res.status(500).send({ success: false, message: err.message });
    }
  });

  // 2. Get All Reports with Recipe Details (Admin)
  app.get("/reports", async (req, res) => {
    try {
      const reports = await reportsCollection
        .aggregate([
          {
            $addFields: {
              recipeObjectId: { $toObjectId: "$recipeId" },
            },
          },
          {
            $lookup: {
              from: "allRecipe",
              localField: "recipeObjectId",
              foreignField: "_id",
              as: "recipeDetails",
            },
          },
          {
            $unwind: {
              path: "$recipeDetails",
              preserveNullAndEmptyArrays: true, // রেসিপি ডিলিট হয়ে গেলেও যেন ক্র্যাশ না করে
            },
          },
          { $sort: { reportedAt: -1 } },
        ])
        .toArray();

      res.send(reports);
    } catch (err) {
      res.status(500).send({ success: false, message: err.message });
    }
  });

  // 3. Dismiss Report (Admin Action - Deletes ONLY the report)
  app.delete("/reports/:id", async (req, res) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res
          .status(400)
          .send({ success: false, message: "Invalid Report ID" });
      }

      const result = await reportsCollection.deleteOne({
        _id: new ObjectId(id),
      });

      if (result.deletedCount === 0) {
        return res
          .status(404)
          .send({ success: false, message: "Report not found" });
      }

      res.send({
        success: true,
        message: "Report dismissed successfully. Recipe remains intact.",
      });
    } catch (err) {
      res.status(500).send({ success: false, message: err.message });
    }
  });

  // 4. Remove Recipe & Clear Related Reports (Admin Action - Deletes Recipe + Reports)
  app.delete("/reports/recipe/:recipeId", async (req, res) => {
    try {
      const { recipeId } = req.params;

      if (!ObjectId.isValid(recipeId)) {
        return res
          .status(400)
          .send({ success: false, message: "Invalid Recipe ID" });
      }

      // ১. মূল রেসিপি রিমুভ
      const recipeDeleteResult = await allRecipeCollection.deleteOne({
        _id: new ObjectId(recipeId),
      });

      // ২. Featured recipes তালিকায় থাকলে সেখান থেকেও রিমুভ (Optional/Safe)
      await featuredRecipesCollection.deleteOne({ recipeId: recipeId });

      // ৩. ঐ রেসিপির বিরুদ্ধে থাকা সমস্ত রিপোর্ট ক্লিনআপ
      await reportsCollection.deleteMany({ recipeId: recipeId });

      if (recipeDeleteResult.deletedCount === 0) {
        return res
          .status(404)
          .send({ success: false, message: "Recipe not found" });
      }

      res.send({
        success: true,
        message: "Recipe and associated reports removed successfully.",
      });
    } catch (err) {
      res.status(500).send({ success: false, message: err.message });
    }
  });
};

run();

app.listen(port, () => {
  console.log(`Sever Successfully run on port-${port}`);
});
