const sharp = require('sharp');

/**
 * SizeValidator audits basic physical properties:
 * 1. File size (rejects files < 10KB).
 * 2. True image format (detects JPG, PNG, HEIF/HEIC via internal magic bytes).
 * 3. Dimensions (rejects images smaller than 200x200 pixels).
 */
class SizeValidator {
  constructor(minSizeBytes = 10240, minDimensions = 200) {
    this.minSizeBytes = minSizeBytes; // 10KB
    this.minDimensions = minDimensions; // 200px
    this.allowedFormats = ['jpeg', 'png', 'heif']; // Sharp maps heic to heif
  }

  /**
   * Performs physical audit on image.
   * @param {Buffer} buffer - Raw file buffer.
   * @param {number} fileSize - File size in bytes.
   * @returns {Promise<{ isValid: boolean, width: number, height: number, format: string, reason: string|null }>}
   */
  async validate(buffer, fileSize) {
    try {
      // 1. Audit byte size
      if (fileSize < this.minSizeBytes) {
        return {
          isValid: false,
          width: 0,
          height: 0,
          format: 'unknown',
          reason: `File size is too small (${(fileSize / 1024).toFixed(1)} KB < Minimum: ${(this.minSizeBytes / 1024).toFixed(0)} KB)`
        };
      }

      // 2. Fetch metadata using sharp
      const metadata = await sharp(buffer).metadata();
      const format = metadata.format;
      const width = metadata.width || 0;
      const height = metadata.height || 0;

      // 3. Audit image format
      if (!this.allowedFormats.includes(format)) {
        const readableFormat = format ? format.toUpperCase() : 'UNKNOWN';
        return {
          isValid: false,
          width,
          height,
          format: readableFormat,
          reason: `Unsupported format "${readableFormat}". Only JPG, PNG, and HEIC are permitted.`
        };
      }

      // 4. Audit dimensions
      if (width < this.minDimensions || height < this.minDimensions) {
        return {
          isValid: false,
          width,
          height,
          format,
          reason: `Image resolution is too low (${width}x${height}px < Minimum: ${this.minDimensions}x${this.minDimensions}px)`
        };
      }

      return {
        isValid: true,
        width,
        height,
        format,
        reason: null
      };
    } catch (error) {
      console.error('Error executing SizeValidator:', error);
      return {
        isValid: false,
        width: 0,
        height: 0,
        format: 'corrupt',
        reason: `Invalid or corrupt image: ${error.message}`
      };
    }
  }
}

module.exports = new SizeValidator();
