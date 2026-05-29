const similarityValidator = require('../services/validation/similarity.validator');
const blurValidator = require('../services/validation/blur.validator');
const sizeValidator = require('../services/validation/size.validator');

/**
 * Self-contained validation verification test suite.
 */
async function runTests() {
  console.log('========================================================');
  console.log('🧪 RUNNING SANITY TESTS ON AUTOMATED VALIDATORS');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`  ✔ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✘ [FAIL] ${message}`);
      failed++;
    }
  };

  // ----------------------------------------------------
  // TEST CASE 1: Similarity Hash Hamming Distance
  // ----------------------------------------------------
  console.log('1. Auditing Similarity Perceptual Hashing (dHash)...');
  try {
    const hashA = 'ffff0000ffff0000'; // Mock hash A
    const hashB = 'ffff0000ffff0000'; // Exact match
    const hashC = 'ffff0000ffff000f'; // Very close (1 hex digit diff, 4 bits diff)
    const hashD = '0000ffff0000ffff'; // Completely different (32 bits diff)

    const distAB = similarityValidator.calculateHammingDistance(hashA, hashB);
    const distAC = similarityValidator.calculateHammingDistance(hashA, hashC);
    const distAD = similarityValidator.calculateHammingDistance(hashA, hashD);

    assert(distAB === 0, `Hamming distance between exact matches is 0 (Got: ${distAB})`);
    assert(distAC === 4, `Hamming distance between very close matches is 4 (Got: ${distAC})`);
    assert(distAD === 64, `Hamming distance between inverse matches is 64 (Got: ${distAD})`);
    
    // Check collision threshold trigger (threshold = 10)
    assert(distAC <= 10, 'dHash correctly flags hashC as collision/duplicate');
    assert(distAD > 10, 'dHash correctly flags hashD as unique');
  } catch (error) {
    console.error('  ✘ Error in similarity tests:', error.message);
    failed++;
  }

  // ----------------------------------------------------
  // TEST CASE 2: Size & Physical Attribute Auditing
  // ----------------------------------------------------
  console.log('\n2. Auditing Size & Format Validator...');
  try {
    // Generate a tiny fake mock buffer representing a small file
    const mockTinyBuffer = Buffer.alloc(100); // 100 bytes
    
    const sizeResult = await sizeValidator.validate(mockTinyBuffer, 100);
    assert(!sizeResult.isValid, `Correctly rejects files smaller than 10KB (Reason: "${sizeResult.reason}")`);
  } catch (error) {
    console.error('  ✘ Error in size tests:', error.message);
    failed++;
  }

  // ----------------------------------------------------
  // SUMMARY REPORT
  // ----------------------------------------------------
  console.log('\n========================================================');
  console.log(`📊 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  if (failed === 0) {
    console.log('🎉 ALL VALIDATION ALGORITHM TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error('⚠️ SOME TESTS FARED UNSATISFACTORILY.');
  }
  console.log('========================================================');
}

// Execute tests
runTests().catch(console.error);
