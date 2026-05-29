require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const imageRouter = require('./routes/image.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Enable Cross-Origin Resource Sharing (CORS)
app.use(cors({
  origin: '*', // In production, limit this to the React frontend address
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. Request body parsing middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Serve local uploaded files statically (active during Cloudinary fallback mode)
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// 4. API Routes
app.use('/api/images', imageRouter);

// 5. Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// 6. Centralized Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Central Server Error:', err.message);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds limit. Max permitted size is 10MB.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }

  return res.status(err.status || 500).json({
    error: err.message || 'An unexpected error occurred on the server.'
  });
});

// Helper for multer recognition inside error handler
const multer = require('multer');

// 7. Initialize server listener
app.listen(PORT, () => {
  console.log('========================================================');
  console.log(`🚀 ARAGON IMAGE PLATFORM SERVER STARTED SUCCESSFULLY`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📁 Local Static Uploads: http://localhost:${PORT}/uploads/`);
  console.log('========================================================');
});
