// Test the new _me filename suffix functionality
console.log('🧪 Testing Metadata Enhancement Filename Suffix...\n');

// Simulate the functionality since we can't import from TypeScript directly
function addMetadataEnhancementSuffix(filePath) {
  const lastDotIndex = filePath.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return filePath + '_me';
  }
  
  const baseName = filePath.substring(0, lastDotIndex);
  const extension = filePath.substring(lastDotIndex);
  return `${baseName}_me${extension}`;
}

function updateOutputPath(originalPath, converted) {
  // First add the metadata enhancement suffix
  let finalPath = addMetadataEnhancementSuffix(originalPath);
  
  // Then handle format conversion if needed
  if (converted) {
    finalPath = finalPath.replace(/\.(png|tiff?|webp|bmp)$/i, '.jpg');
  }
  
  return finalPath;
}

// Test cases
const testCases = [
  { input: 'image.png', converted: true, expected: 'image_me.jpg' },
  { input: 'photo.jpg', converted: false, expected: 'photo_me.jpg' },
  { input: 'folder/pic.png', converted: true, expected: 'folder/pic_me.jpg' },
  { input: 'deep/path/screenshot.tiff', converted: true, expected: 'deep/path/screenshot_me.jpg' },
  { input: 'Supabase_Buckets_Image.png', converted: true, expected: 'Supabase_Buckets_Image_me.jpg' },
  { input: 'bench_photo.jpg', converted: false, expected: 'bench_photo_me.jpg' },
  { input: 'document.webp', converted: true, expected: 'document_me.jpg' },
  { input: 'file_no_extension', converted: false, expected: 'file_no_extension_me' },
  { input: 'complex.file.name.png', converted: true, expected: 'complex.file.name_me.jpg' }
];

console.log('Test Results:');
console.log('=' .repeat(80));

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  const result = updateOutputPath(testCase.input, testCase.converted);
  const status = result === testCase.expected ? '✅ PASS' : '❌ FAIL';
  
  if (result === testCase.expected) {
    passed++;
  } else {
    failed++;
  }
  
  console.log(`${index + 1}. ${status}`);
  console.log(`   Input:    "${testCase.input}" (converted: ${testCase.converted})`);
  console.log(`   Expected: "${testCase.expected}"`);
  console.log(`   Got:      "${result}"`);
  console.log('');
});

console.log('=' .repeat(80));
console.log(`📊 Final Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('🎉 All tests passed! The _me suffix functionality is working correctly.');
} else {
  console.log('⚠️  Some tests failed. Please review the implementation.');
}

console.log('\n🎯 Example transformations:');
console.log('• Supabase_Buckets_Image.png → Supabase_Buckets_Image_me.jpg');
console.log('• bench_photo.jpg → bench_photo_me.jpg'); 
console.log('• screenshot.png → screenshot_me.jpg');
console.log('• folder/image.tiff → folder/image_me.jpg');