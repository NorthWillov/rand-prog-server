const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require('cors');

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

app.get("/", (request, response, next) => {
  response.json({ message: "Hey! This is your server response!" });
  next();
});

// register endpoint
app.post("/register", (request, response) => {
  // hash the password
  bcrypt
    .hash(request.body.password, 10)
    .then((hashedPassword) => {
      // create a new user instance and collect the data
      const user = new User({
        email: request.body.email,
        password: hashedPassword,
      });

      // save the new user
      user
        .save()
        // return success if the new user is added to the database successfully
        .then((result) => {
          response.status(201).send({
            message: "User Created Successfully",
            result,
          });
        })
        // catch erroe if the new user wasn't added successfully to the database
        .catch((error) => {
          response.status(500).send({
            message: "Error creating user",
            error,
          });
        });
    })
    // catch error if the password hash isn't successful
    .catch((e) => {
      response.status(500).send({
        message: "Password was not hashed successfully",
        e,
      });
    });
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

app.post("/logout", (req, res) => {
  // clear the JWT token from the client-side
  res.clearCookie("TOKEN");
  // update the user's logged-out status
  res.json({ success: true });
});

// free endpoint
app.get("/free-endpoint", (request, response) => {
  response.json({ message: "You are free to access me anytime" });
});

// authentication endpoint
app.get("/auth-endpoint", auth, (request, response) => {
  response.send({ message: "You are authorized to access me" });
});

app.get("/fetch-palette", auth, async (req, res) => {
  const palette = await Palette.findOne({ user: req.user.userId });
  res.send(palette);
});

app.post("/auth-endpoint-post", auth, async (request, response) => {
  console.log(request.user);

  try {
    const newPalette = {
      user: request.user.userId,
      tvPrograms: [
        {
          filename: "POR",
          duration: { minutes: 2, seconds: 3 },
          category: "promo",
        },
      ],
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

module.exports = app;
