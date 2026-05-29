const sharp = require('sharp');

/**
 * BlurValidator detects if an image is out-of-focus or blurry.
 * It uses the 'Variance of the Laplacian' method:
 * 1. Convert the image to greyscale and resize to 300x300 to normalize resolution and speed.
 * 2. Convolve with a 3x3 Laplacian kernel [0, 1, 0, 1, -4, 1, 0, 1, 0].
 * 3. Extract raw pixel buffers and calculate the variance.
 * 4. A lower variance means fewer edges (smoother transitions), indicative of a blurry image.
 */
class BlurValidator {
  constructor(threshold = 12.0) {
    this.threshold = threshold; // Calibrated blur threshold
  }

  /**
   * Evaluates if the provided image is blurry.
   * @param {Buffer} buffer - The image file buffer.
   * @returns {Promise<{ isValid: boolean, score: number, reason: string|null }>}
   */
  async validate(buffer) {
    try {
      // 1. Process image using sharp: resize, greyscale, convolve
      const { data, info } = await sharp(buffer)
        .resize(300, 300, { fit: 'fill' }) // standard size
        .removeAlpha() // Drop alpha channel completely to prevent 2-channel skewing
        .greyscale()
        .convolve({
          width: 3,
          height: 3,
          kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0]
        })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const pixelCount = data.length;
      
      // 2. Calculate the mean of the convolved pixels
      let sum = 0;
      for (let i = 0; i < pixelCount; i++) {
        sum += data[i];
      }
      const mean = sum / pixelCount;

      // 3. Calculate the variance of the convolved pixels
      let sumSquares = 0;
      for (let i = 0; i < pixelCount; i++) {
        const diff = data[i] - mean;
        sumSquares += diff * diff;
      }
      const variance = sumSquares / pixelCount;

      const isValid = variance >= this.threshold;

      return {
        isValid,
        score: parseFloat(variance.toFixed(3)),
        reason: isValid ? null : `Image is too blurry (Blur Score: ${variance.toFixed(2)} < Threshold: ${this.threshold})`
      };
    } catch (error) {
      console.error('Error executing BlurValidator:', error);
      // Fallback: If processing fails, don't auto-reject, but log it
      throw new Error(`Blur validation failed: ${error.message}`);
    }
  }
}

module.exports = new BlurValidator();
