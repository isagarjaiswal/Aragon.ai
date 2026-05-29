const express = require('express');
const multer = require('multer');
const imageController = require('../controllers/image.controller');

const router = express.Router();

// 1. Configure Multer memory storage (keeps file in a buffer before validation & upload)
const storage = multer.memoryStorage();

// 2. Strict file format filtering at the route layer
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/heic',
    'image/heif'
  ];

  if (allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and HEIC files are allowed at the API layer.'), false);
  }
};

// 3. Instantiate multer middleware with a 10MB upload limit for security
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// 4. Register endpoints following standard RESTful guidelines
router.post('/upload', upload.single('image'), imageController.uploadImage);
router.get('/', imageController.getImages);
router.get('/:id', imageController.getImageById);
router.delete('/:id', imageController.deleteImage);

module.exports = router;
