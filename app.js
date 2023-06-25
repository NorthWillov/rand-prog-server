const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const path = require("path");
const jwt = require("jsonwebtoken");
const cors = require("cors");

// require database connection
const dbConnect = require("./db/dbConnect");
const User = require("./db/userModel");
const Palette = require("./db/paletteModel");
const auth = require("./auth");

// execute database connection
dbConnect();

// Curb Cores Error by adding a header here
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content, Accept, Content-Type, Authorization"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );
  next();
});

// body parser configuration
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

app.post("/register", async (request, response) => {
  try {
    const hashedPassword = await bcrypt.hash(request.body.password, 10);

    const user = new User({
      email: request.body.email,
      password: hashedPassword,
    });

    const savedUser = await user.save();

    const newPalette = {
      user: savedUser._id,
      tvPrograms: [
        {
          filename: "test",
          duration: { minutes: 20, seconds: 20 },
          category: "wazne",
          info: "To jest testowy plik, mozna go usunac",
        },
      ],
      categories: [{ name: "wazne", color: "#000000" }],
    };

    const palette = new Palette(newPalette);

    await palette.save();

    response.status(201).send({
      message: "User Created Successfully",
      user: savedUser,
    });
  } catch (error) {
    console.log(error);
    response.status(500).send({
      message: "Error creating user",
      error,
    });
  }
});

// login endpoint
app.post("/login", (request, response) => {
  // check if email exists
  User.findOne({ email: request.body.email })

    // if email exists
    .then((user) => {
      // compare the password entered and the hashed password found
      bcrypt
        .compare(request.body.password, user.password)

        // if the passwords match
        .then((passwordCheck) => {
          // check if password matches
          if (!passwordCheck) {
            return response.status(400).send({
              message: "Passwords does not match",
              error,
            });
          }

          //   create JWT token
          const token = jwt.sign(
            {
              userId: user._id,
              userEmail: user.email,
            },
            process.env.TOKEN_SECRET,
            { expiresIn: "24h" }
          );

          //   return success response
          response.status(200).send({
            message: "Login Successful",
            email: user.email,
            token,
          });
        })
        // catch error if password do not match
        .catch((error) => {
          response.status(400).send({
            message: "Passwords does not match",
            error,
          });
        });
    })
    // catch error if email does not exist
    .catch((e) => {
      response.status(404).send({
        message: "Email not found",
        e,
      });
    });
});

app.delete("/:paletteId/programs/:programId", auth, (req, res) => {
  const paletteId = req.params.paletteId;
  const programId = req.params.programId;

  if (!mongoose.Types.ObjectId.isValid(paletteId)) {
    return res.status(400).json({ message: "Invalid palette ID format" });
  }
  if (!mongoose.Types.ObjectId.isValid(programId)) {
    return res.status(400).json({ message: "Invalid program ID format" });
  }

  Palette.findByIdAndUpdate(paletteId, {
    $pull: { tvPrograms: { _id: programId } },
  })
    .then(() => {
      res.status(204).send();
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    });
});

app.delete(
  "/:paletteId/delete-category/:categoryId",
  auth,
  async (req, res) => {
    const { paletteId, categoryId } = req.params;

    try {
      const palette = await Palette.findById(paletteId);

      if (!palette) {
        return res.status(404).json({ error: "Palette not found" });
      }

      // Find the index of the category in the categories array
      const categoryIndex = palette.categories.findIndex(
        (category) => category._id.toString() === categoryId
      );

      if (categoryIndex === -1) {
        return res.status(404).json({ error: "Category not found" });
      }

      // Remove the category from the categories array
      palette.categories.splice(categoryIndex, 1);

      // Save the updated palette
      const updatedPalette = await palette.save();

      res.json(updatedPalette);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

app.post("/:paletteId/programs", auth, async (req, res) => {
  const { paletteId } = req.params;
  const { newProg } = req.body;
  console.log(newProg);

  try {
    const updatedPalette = await Palette.findByIdAndUpdate(
      paletteId,
      {
        $push: { tvPrograms: newProg },
      },
      { new: true }
    );

    if (!updatedPalette) {
      return res.status(404).json({ error: "Palette not found" });
    }

    res.json(updatedPalette);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/:paletteId/edit/:progId", auth, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.paletteId)) {
    return res.status(400).json({ message: "Invalid palette ID format" });
  }
  if (!mongoose.Types.ObjectId.isValid(req.params.progId)) {
    return res.status(400).json({ message: "Invalid program ID format" });
  }

  const editProg = req.body.updProg;

  try {
    const updatedPalette = await Palette.updateOne(
      { _id: req.params.paletteId, "tvPrograms._id": req.params.progId },
      {
        $set: {
          "tvPrograms.$.filename": editProg.filename,
          "tvPrograms.$.duration": editProg.duration,
          "tvPrograms.$.category": editProg.category,
          "tvPrograms.$.info": editProg.info,
        },
      }
    );

    res.send(updatedPalette);
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
});

app.post("/:paletteId/insert-new-category", auth, async (req, res) => {
  const { paletteId } = req.params;

  try {
    const palette = await Palette.findById(paletteId);

    if (!palette) {
      return res.status(404).json({ error: "Palette not found" });
    }

    // Check if the category name already exists
    const existingCategory = palette.categories.find(
      (category) => category.name === req.body.newCategory.name
    );

    if (existingCategory) {
      return res.status(400).json({ error: "Category already exists" });
    }

    const updatedPalette = await Palette.findByIdAndUpdate(
      paletteId,
      {
        $push: { categories: req.body.newCategory },
      },
      { new: true }
    );

    if (!updatedPalette) {
      return res.status(404).json({ error: "Palette not found" });
    }

    res.json(updatedPalette);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/logout", (req, res) => {
  // clear the JWT token from the client-side
  res.clearCookie("TOKEN");
  // update the user's logged-out status
  res.json({ success: true });
});

// authentication endpoint
app.get("/auth-endpoint", auth, (request, response) => {
  response.send({ message: "You are authorized to access me" });
});

app.get("/fetch-palette", auth, async (req, res) => {
  const palette = await Palette.findOne({ user: req.user.userId });
  res.send(palette);
});

// app.get("/fetch-categories", auth, async (req, res) => {
//   const categories = await Category.d({ user: req.user.userId });
//   res.send(categories);
// });

app.post("/auth-endpoint-post", auth, async (request, response) => {
  try {
    const newPalette = {
      user: request.user.userId,
      tvPrograms: [],
      categories: [],
    };
    const palette = new Palette(newPalette);
    await palette.save();
    response.end();
  } catch (err) {
    console.log(err);
  }

  response.send({ message: "You are authorized to access me" });
});

app.put("/auth-endpoint-post", auth, async (req, res) => {
  const palette = await Palette.findOne({ user: req.user.userId });

  const newTvPrograms = [
    {
      filename: req.body.filename,
      duration: req.body.duration,
      category: req.body.category,
    },
    ...palette.tvPrograms,
  ];

  await Palette.findOneAndUpdate(
    { user: req.user.userId },
    {
      tvPrograms: newTvPrograms,
    }
  );

  res.send({ message: "You are authorized to access me" });
});

app.use(express.static(path.join(__dirname, "client", "build")));

// Serve the index.html file for all non-static routes

app.get("*", function (req, res) {
  res.sendFile(path.join(__dirname, "client", "build", "index.html"));
});

module.exports = app;
