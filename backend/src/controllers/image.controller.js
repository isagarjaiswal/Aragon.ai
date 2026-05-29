const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const validationPipeline = require('../services/validation/pipeline');
const storageService = require('../services/storage.service');

/**
 * ImageController governs HTTP requests for managing and auditing assets.
 */
class ImageController {
  /**
   * Upload and process an image through the validation pipeline.
   * POST /api/images/upload
   */
  async uploadImage(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded. Please send an image file.' });
      }

      console.log(`\n📥 Received upload request: "${req.file.originalname}" (${(req.file.size / 1024).toFixed(1)} KB)`);

      // 1. Run the raw buffer through our automated validation pipeline
      const auditResult = await validationPipeline.execute(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        req.file.size
      );

      console.log(`🔍 Validation Result: status=${auditResult.status}, reasonsCount=${auditResult.rejectionReasons.length}`);

      // 2. Upload file to Cloudinary (or Local Fallback)
      // Note: We upload BOTH Accepted and Rejected files so the user gets an image preview of failures!
      console.log('📤 Transmitting asset to cloud storage...');
      const uploadResult = await storageService.upload(
        auditResult.processedBuffer,
        auditResult.originalName,
        auditResult.mimeType
      );

      // 3. Write metadata record to PostgreSQL database via Prisma ORM
      console.log('💾 Storing image record in PostgreSQL...');
      const newImage = await prisma.image.create({
        data: {
          filename: pathNameOnly(uploadResult.storageUrl) || auditResult.originalName,
          originalName: auditResult.originalName,
          mimeType: auditResult.mimeType,
          size: auditResult.processedBuffer.length,
          width: auditResult.width,
          height: auditResult.height,
          status: auditResult.status,
          s3Url: uploadResult.storageUrl, // Aligned with s3Url spec
          publicId: uploadResult.publicId,
          imageHash: auditResult.dHash, // Aligned with imageHash spec
          blurScore: auditResult.blurScore,
          faceCount: auditResult.faceCount,
          faceSizeRatio: auditResult.faceSizeRatio,
          rejectReason: auditResult.rejectionReasons[0] || null // Aligned with rejectReason spec (taking the primary specific reason)
        }
      });

      console.log(`✔ Transaction Complete! DB ID: ${newImage.id} [${newImage.status}]`);

      // Return created object
      return res.status(201).json(newImage);
    } catch (error) {
      console.error('✘ Error in uploadImage controller:', error);
      return res.status(500).json({
        error: 'An internal error occurred while processing your upload.',
        details: error.message
      });
    }
  }

  /**
   * Fetch lists of uploaded images. Supports status filtering.
   * GET /api/images
   */
  async getImages(req, res) {
    try {
      const { status } = req.query;
      
      const filter = {};
      if (status && ['ACCEPTED', 'REJECTED', 'PENDING'].includes(status.toUpperCase())) {
        filter.status = status.toUpperCase();
      }

      const images = await prisma.image.findMany({
        where: filter,
        orderBy: { createdAt: 'desc' }
      });

      return res.status(200).json(images);
    } catch (error) {
      console.error('✘ Error in getImages controller:', error);
      return res.status(500).json({ error: 'Failed to retrieve image logs.', details: error.message });
    }
  }

  /**
   * Fetch complete audit logs for a single image asset.
   * GET /api/images/:id
   */
  async getImageById(req, res) {
    try {
      const { id } = req.params;
      const image = await prisma.image.findUnique({
        where: { id }
      });

      if (!image) {
        return res.status(404).json({ error: 'Image record not found.' });
      }

      return res.status(200).json(image);
    } catch (error) {
      console.error('✘ Error in getImageById controller:', error);
      return res.status(500).json({ error: 'Failed to retrieve image audit details.', details: error.message });
    }
  }

  /**
   * Purge an image asset from cloud storage and PostgreSQL.
   * DELETE /api/images/:id
   */
  async deleteImage(req, res) {
    try {
      const { id } = req.params;

      const image = await prisma.image.findUnique({
        where: { id }
      });

      if (!image) {
        return res.status(404).json({ error: 'Image record not found.' });
      }

      console.log(`\n🗑 Initiating deletion request for Image ID: ${id} ("${image.originalName}")`);

      // 1. Delete asset from Cloudinary or local folder
      await storageService.delete(image.publicId);

      // 2. Delete record from database
      await prisma.image.delete({
        where: { id }
      });

      console.log(`✔ Image and storage purged successfully.`);

      return res.status(200).json({ message: 'Image successfully deleted from database and storage.' });
    } catch (error) {
      console.error('✘ Error in deleteImage controller:', error);
      return res.status(500).json({ error: 'Failed to execute image purge.', details: error.message });
    }
  }
}

/**
 * Helper to parse clean filename from url.
 */
function pathNameOnly(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return parsed.pathname.split('/').pop();
  } catch (e) {
    return null;
  }
}

module.exports = new ImageController();
