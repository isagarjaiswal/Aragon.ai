const fs = require('fs');
const path = require('path');
const { cloudinary, isConfigured } = require('../config/cloudinary');

// Ensure local uploads directory exists for fallback mode
const LOCAL_UPLOADS_DIR = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
  fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
}

/**
 * StorageService manages file uploads and deletions.
 * Swaps transparently between Cloudinary and Local File System based on configuration.
 */
class StorageService {
  /**
   * Upload an image buffer to the active storage system.
   * @param {Buffer} buffer - The image file buffer.
   * @param {string} originalName - Original name of the uploaded file.
   * @param {string} mimeType - The mime type (e.g. image/png).
   * @returns {Promise<{ storageUrl: string, publicId: string }>}
   */
  async upload(buffer, originalName, mimeType) {
    if (isConfigured) {
      return this.uploadToCloudinary(buffer, originalName);
    } else {
      return this.uploadToLocalDisk(buffer, originalName);
    }
  }

  /**
   * Delete an image from the active storage system.
   * @param {string} publicId - The unique Cloudinary publicId or Local file path.
   * @returns {Promise<void>}
   */
  async delete(publicId) {
    if (!publicId) return;

    if (isConfigured) {
      try {
        await cloudinary.uploader.destroy(publicId);
        console.log(`✔ Cloudinary asset successfully deleted: ${publicId}`);
      } catch (error) {
        console.error(`✘ Failed to delete Cloudinary asset (${publicId}):`, error.message);
      }
    } else {
      try {
        const filePath = path.join(LOCAL_UPLOADS_DIR, path.basename(publicId));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`✔ Local asset successfully deleted: ${filePath}`);
        }
      } catch (error) {
        console.error(`✘ Failed to delete local asset (${publicId}):`, error.message);
      }
    }
  }

  /**
   * Internal method to upload to Cloudinary inside the 'aragon' folder.
   */
  uploadToCloudinary(buffer, originalName) {
    return new Promise((resolve, reject) => {
      const filenameWithoutExt = path.parse(originalName).name.replace(/[^a-zA-Z0-9]/g, '_');
      const uniquePublicId = `${filenameWithoutExt}_${Date.now()}`;

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'aragon', // Organize files under the 'aragon' folder
          public_id: uniquePublicId,
          resource_type: 'image'
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary Upload Stream Error:', error);
            return reject(new Error(`Cloudinary upload failed: ${error.message}`));
          }
          resolve({
            storageUrl: result.secure_url,
            publicId: result.public_id // Holds 'aragon/filename_timestamp'
          });
        }
      );

      uploadStream.end(buffer);
    });
  }

  /**
   * Internal method to upload to Local Disk as fallback.
   */
  async uploadToLocalDisk(buffer, originalName) {
    const ext = path.extname(originalName) || '.jpg';
    const filenameWithoutExt = path.parse(originalName).name.replace(/[^a-zA-Z0-9]/g, '_');
    const uniqueName = `${filenameWithoutExt}_${Date.now()}${ext}`;
    const destinationPath = path.join(LOCAL_UPLOADS_DIR, uniqueName);

    await fs.promises.writeFile(destinationPath, buffer);

    // Generate local URL served via backend static mapping
    const port = process.env.PORT || 5000;
    const storageUrl = `http://localhost:${port}/uploads/${uniqueName}`;

    return {
      storageUrl,
      publicId: uniqueName // Used locally to identify the file in public/uploads/
    };
  }
}

module.exports = new StorageService();
