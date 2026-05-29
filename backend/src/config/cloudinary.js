const cloudinary = require('cloudinary').v2;
require('dotenv').config();

let isConfigured = false;

// 1. Support Option A: Individual credentials
if (
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_SECRET
) {
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    isConfigured = true;
    console.log('✔ Cloudinary Storage Service initialized using separate credentials.');
  } catch (error) {
    console.error('✘ Error configuring Cloudinary with separate keys:', error.message);
  }
} 
// 2. Support Option B: Unified single environment URL
else if (process.env.CLOUDINARY_URL) {
  try {
    // Cloudinary SDK automatically reads CLOUDINARY_URL from env if config() is called empty
    cloudinary.config();
    isConfigured = true;
    console.log('✔ Cloudinary Storage Service initialized using unified connection URL.');
  } catch (error) {
    console.error('✘ Error configuring Cloudinary with CLOUDINARY_URL:', error.message);
  }
} 
// 3. Fallback to Local Disk
else {
  console.warn('⚠️  Cloudinary credentials are not set. The platform will fall back to Local Disk Storage.');
}

module.exports = {
  cloudinary,
  isConfigured
};
