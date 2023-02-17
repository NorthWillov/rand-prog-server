const mongoose = require("mongoose");

const programSchema = new mongoose.Schema({
  filename: String,
  duration: { minutes: Number, seconds: Number },
  category: String,
});

module.exports = mongoose.model("Program", programSchema);
