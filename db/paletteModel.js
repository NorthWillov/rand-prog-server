const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const paletteSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  tvPrograms: [
    {
      filename: String,
      duration: { minutes: Number, seconds: Number },
      category: String,
    },
  ],
  categories: [
    {
      name: {
        type: String,
      },
      color: {
        type: String,
      },
    },
  ],
});

const Palette = mongoose.model("Palette", paletteSchema);

module.exports = Palette;
