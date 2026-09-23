const express = require("express");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "today-internet",
    allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
  },
});

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const upload = multer({ storage, limits: { fileSize: MAX_SIZE } });

router.post("/", authenticate, (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file was uploaded" });
    }
    res.json({ url: req.file.path });
  });
});

module.exports = router;