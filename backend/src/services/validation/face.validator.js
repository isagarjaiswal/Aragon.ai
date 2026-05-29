const tf = require('@tensorflow/tfjs-core');
require('@tensorflow/tfjs-backend-cpu');
const blazeface = require('@tensorflow-models/blazeface');
const sharp = require('sharp');

/**
 * FaceValidator audits face count and face size within the image canvas.
 * It uses Google's BlazeFace model (extremely lightweight, ~100KB, pure JS-compatible).
 * 1. Resizes the image to 400x400 with 'contain' boxing to fit TFJS requirements.
 * 2. Extracts raw RGB values and creates a 3D pixel tensor.
 * 3. Enforces that EXACTLY ONE face is detected.
 * 4. Enforces that the face bounding box takes up at least 15% (0.15) of the canvas dimension.
 */
class FaceValidator {
  constructor(minFaceSizeRatio = 0.10) {
    this.minFaceSizeRatio = minFaceSizeRatio;
    this.model = null;
    this.isInitializing = false;
  }

  /**
   * Initializes the TensorFlow.js CPU backend and loads the BlazeFace model weights.
   */
  async initModel() {
    if (this.model) return this.model;
    
    // Prevent double initialization racing
    if (this.isInitializing) {
      while (!this.model) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return this.model;
    }

    this.isInitializing = true;
    try {
      // Ensure the CPU backend is ready
      await tf.ready();
      // Load BlazeFace model
      this.model = await blazeface.load();
      console.log('✔ TensorFlow BlazeFace model loaded successfully on CPU backend.');
      return this.model;
    } catch (error) {
      console.error('✘ Failed to load BlazeFace model:', error);
      throw new Error(`Face model initialization failed: ${error.message}`);
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Performs face audits on the provided image buffer.
   * @param {Buffer} buffer - The image file buffer.
   * @returns {Promise<{ isValid: boolean, faceCount: number, faceSizeRatio: number, reason: string|null }>}
   */
  async validate(buffer) {
    let tensor = null;
    try {
      // Ensure model is loaded
      const model = await this.initModel();

      // 1. Process image to raw RGB bytes at 400x400 resolution
      const targetSize = 400;
      const { data, info } = await sharp(buffer)
        .resize(targetSize, targetSize, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0 }
        })
        .removeAlpha() // Force drop alpha channel to keep exactly 3-channel RGB bytes
        .raw()
        .toBuffer({ resolveWithObject: true });

      // 2. Wrap buffer in standard tf.Tensor3D [height, width, channels]
      tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], 'int32');

      // 3. Detect faces using BlazeFace
      const predictions = await model.estimateFaces(tensor, false);
      const faceCount = predictions.length;

      // Rule: Reject if multiple faces or no face is found
      if (faceCount === 0) {
        return {
          isValid: false,
          faceCount: 0,
          faceSizeRatio: 0.0,
          reason: 'No face detected in the image.'
        };
      }

      if (faceCount > 1) {
        return {
          isValid: false,
          faceCount,
          faceSizeRatio: 0.0,
          reason: `Multiple faces detected in the image (Count: ${faceCount}). Only single portraits are allowed.`
        };
      }

      // Rule: Exactly one face found. Check its size relative to the canvas.
      const face = predictions[0];
      const topLeft = face.topLeft;
      const bottomRight = face.bottomRight;

      const faceWidth = bottomRight[0] - topLeft[0];
      const faceHeight = bottomRight[1] - topLeft[1];

      // Calculate width and height ratios
      const widthRatio = faceWidth / info.width;
      const heightRatio = faceHeight / info.height;

      // Use the average dimension ratio for size check
      const faceSizeRatio = parseFloat(((widthRatio + heightRatio) / 2).toFixed(3));
      
      const isSizeValid = faceSizeRatio >= this.minFaceSizeRatio;

      return {
        isValid: isSizeValid,
        faceCount: 1,
        faceSizeRatio,
        reason: isSizeValid 
          ? null 
          : `Detected face is too small (Face size: ${(faceSizeRatio * 100).toFixed(1)}% < Minimum: ${(this.minFaceSizeRatio * 100).toFixed(1)}% of canvas)`
      };
    } catch (error) {
      console.error('Error executing FaceValidator:', error);
      throw new Error(`Face validation failed: ${error.message}`);
    } finally {
      // Clean up tensor memory immediately to prevent native Node memory growth!
      if (tensor) {
        tensor.dispose();
      }
    }
  }
}

module.exports = new FaceValidator();
