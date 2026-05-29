const heicConvert = require('heic-convert');
const sizeValidator = require('./size.validator');
const blurValidator = require('./blur.validator');
const similarityValidator = require('./similarity.validator');
const faceValidator = require('./face.validator');

/**
 * ValidationPipeline coordinates and executes the sequential/parallel image validation rules.
 * Design Pattern: Pipeline Pattern / Chain of Responsibility
 */
class ValidationPipeline {
  /**
   * Run the full suite of image audits.
   * @param {Buffer} buffer - Original uploaded file buffer.
   * @param {string} originalName - Filename of the uploaded file.
   * @param {string} mimeType - Browser provided mime type.
   * @param {number} fileSize - File size in bytes.
   * @returns {Promise<{
   *   status: 'ACCEPTED'|'REJECTED',
   *   rejectionReasons: string[],
   *   width: number,
   *   height: number,
   *   dHash: string,
   *   blurScore: number,
   *   faceCount: number,
   *   faceSizeRatio: number,
   *   processedBuffer: Buffer,
   *   mimeType: string,
   *   originalName: string
   * }>}
   */
  async execute(buffer, originalName, mimeType, fileSize) {
    const rejectionReasons = [];
    let processedBuffer = buffer;
    let finalMimeType = mimeType;
    let finalName = originalName;

    // 1. Check if the image format is HEIC/HEIF and convert it in-memory to JPEG
    const isHEIC = 
      originalName.toLowerCase().endsWith('.heic') || 
      originalName.toLowerCase().endsWith('.heif') || 
      mimeType === 'image/heic' || 
      mimeType === 'image/heif';

    if (isHEIC) {
      try {
        console.log(`🔄 HEIC/HEIF file detected: "${originalName}". Initiating in-memory conversion...`);
        processedBuffer = await heicConvert({
          buffer: buffer,
          format: 'JPEG',
          quality: 0.92 // high quality
        });
        
        finalMimeType = 'image/jpeg';
        finalName = originalName.replace(/\.(heic|heif)$/i, '.jpg');
        fileSize = processedBuffer.length;
        console.log(`✔ Successfully converted "${originalName}" to JPEG. Size: ${(fileSize / 1024).toFixed(1)} KB`);
      } catch (error) {
        console.error('✘ HEIC conversion failed:', error);
        return {
          status: 'REJECTED',
          rejectionReasons: [`Failed to convert HEIC image: ${error.message}`],
          width: 0,
          height: 0,
          dHash: '0000000000000000',
          blurScore: 0.0,
          faceCount: 0,
          faceSizeRatio: 0.0,
          processedBuffer: buffer,
          mimeType,
          originalName
        };
      }
    }

    // 2. Perform physical size and format validations (Early Exit if structurally invalid)
    const sizeResult = await sizeValidator.validate(processedBuffer, fileSize);
    if (!sizeResult.isValid) {
      rejectionReasons.push(sizeResult.reason);
      return {
        status: 'REJECTED',
        rejectionReasons,
        width: sizeResult.width,
        height: sizeResult.height,
        dHash: '0000000000000000',
        blurScore: 0.0,
        faceCount: 0,
        faceSizeRatio: 0.0,
        processedBuffer,
        mimeType: finalMimeType,
        originalName: finalName
      };
    }

    // 3. Precompute perceptual hash (dHash) for similarity audits
    let dHash = '0000000000000000';
    try {
      dHash = await similarityValidator.generateHash(processedBuffer);
    } catch (error) {
      rejectionReasons.push(`Similarity parsing error: ${error.message}`);
    }

    // 4. Run detailed audits (Similarity, Blur, Face)
    // Run independent tasks sequentially to minimize memory spikes and provide clean logs
    
    // Audit A: Perceptual Similarity Check (collides with DB accepted records)
    let similarityPassed = true;
    if (rejectionReasons.length === 0) {
      try {
        const similarityResult = await similarityValidator.validate(processedBuffer, dHash);
        if (!similarityResult.isValid) {
          similarityPassed = false;
          rejectionReasons.push(similarityResult.reason);
        }
      } catch (error) {
        rejectionReasons.push(`Similarity validation failed: ${error.message}`);
      }
    }

    // Audit B: Blurriness Check (Laplacian edge density)
    let blurScore = 0.0;
    try {
      const blurResult = await blurValidator.validate(processedBuffer);
      blurScore = blurResult.score;
      if (!blurResult.isValid) {
        rejectionReasons.push(blurResult.reason);
      }
    } catch (error) {
      rejectionReasons.push(`Blur check failed: ${error.message}`);
    }

    // Audit C: Face Detection Audit (TFJS BlazeFace)
    let faceCount = 0;
    let faceSizeRatio = 0.0;
    try {
      const faceResult = await faceValidator.validate(processedBuffer);
      faceCount = faceResult.faceCount;
      faceSizeRatio = faceResult.faceSizeRatio;
      if (!faceResult.isValid) {
        rejectionReasons.push(faceResult.reason);
      }
    } catch (error) {
      rejectionReasons.push(`Face audit failed: ${error.message}`);
    }

    // 5. Final Status Assembly
    const status = rejectionReasons.length === 0 ? 'ACCEPTED' : 'REJECTED';

    return {
      status,
      rejectionReasons,
      width: sizeResult.width,
      height: sizeResult.height,
      dHash,
      blurScore,
      faceCount,
      faceSizeRatio,
      processedBuffer,
      mimeType: finalMimeType,
      originalName: finalName
    };
  }
}

module.exports = new ValidationPipeline();
