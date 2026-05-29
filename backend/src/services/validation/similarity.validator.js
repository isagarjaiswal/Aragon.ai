const sharp = require('sharp');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * SimilarityValidator detects near-duplicate images using Perceptual Hashing (dHash).
 * 1. Resizes image to 9x8 pixels (greyscale).
 * 2. Compares adjacent horizontal pixels (col vs col + 1).
 * 3. Builds a 64-bit fingerprint stored as a 16-character hex string.
 * 4. Measures similarity using the Hamming distance (number of differing bits).
 * 5. If Hamming distance is <= 10 (out of 64), the image is flagged as a duplicate.
 */
class SimilarityValidator {
  constructor(threshold = 10) {
    this.threshold = threshold; // Reject if Hamming distance <= threshold
  }

  /**
   * Generates a 64-bit difference hash (dHash) for an image.
   * @param {Buffer} buffer - The image file buffer.
   * @returns {Promise<string>} 16-character hex string.
   */
  async generateHash(buffer) {
    try {
      // Downsample to 9x8 greyscale (72 pixels)
      const { data } = await sharp(buffer)
        .resize(9, 8, { fit: 'fill' })
        .removeAlpha() // Drop alpha channel completely
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      let hashBin = '';
      // 8 rows, each row has 9 pixels. Compare pixel at col with pixel at col + 1.
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const leftPixel = data[row * 9 + col];
          const rightPixel = data[row * 9 + (col + 1)];
          hashBin += leftPixel > rightPixel ? '1' : '0';
        }
      }

      // Convert 64-bit binary string to 16-char hex string
      let hexHash = '';
      for (let i = 0; i < 64; i += 4) {
        const nibble = hashBin.substring(i, i + 4);
        hexHash += parseInt(nibble, 2).toString(16);
      }

      return hexHash;
    } catch (error) {
      console.error('Error generating dHash:', error);
      throw new Error(`Failed to generate perceptual hash: ${error.message}`);
    }
  }

  /**
   * Calculates the Hamming distance between two hex hashes.
   * @param {string} hash1 - First 16-char hex string.
   * @param {string} hash2 - Second 16-char hex string.
   * @returns {number} Hamming distance (0 to 64).
   */
  calculateHammingDistance(hash1, hash2) {
    if (!hash1 || !hash2 || hash1.length !== 16 || hash2.length !== 16) {
      return 64; // Treat as completely different if invalid
    }

    // Convert hex to 64-bit BigInts
    const val1 = BigInt(`0x${hash1}`);
    const val2 = BigInt(`0x${hash2}`);

    // XOR the values (bits that differ will be set to 1)
    let diff = val1 ^ val2;

    // Count the number of set bits (Hamming weight / popcount)
    let distance = 0;
    while (diff > 0n) {
      if (diff & 1n) distance++;
      diff >>= 1n;
    }

    return distance;
  }

  /**
   * Validates if the image is too similar to any existing ACCEPTED image.
   * @param {Buffer} buffer - The image file buffer.
   * @param {string} newHash - Precomputed dHash (optional, will compute if not provided).
   * @returns {Promise<{ isValid: boolean, hash: string, reason: string|null, matchFile: string|null }>}
   */
  async validate(buffer, newHash = null) {
    try {
      const hash = newHash || (await this.generateHash(buffer));

      // Retrieve all existing ACCEPTED images from PostgreSQL database
      const existingImages = await prisma.image.findMany({
        where: { status: 'ACCEPTED' },
        select: { id: true, originalName: true, imageHash: true }
      });

      for (const img of existingImages) {
        const distance = this.calculateHammingDistance(hash, img.imageHash);
        
        if (distance <= this.threshold) {
          return {
            isValid: false,
            hash,
            reason: `Image is too similar to an existing uploaded image "${img.originalName}" (Hamming Distance: ${distance} <= ${this.threshold})`,
            matchFile: img.originalName
          };
        }
      }

      return {
        isValid: true,
        hash,
        reason: null,
        matchFile: null
      };
    } catch (error) {
      console.error('Error executing SimilarityValidator:', error);
      throw new Error(`Similarity validation failed: ${error.message}`);
    }
  }
}

module.exports = new SimilarityValidator();
