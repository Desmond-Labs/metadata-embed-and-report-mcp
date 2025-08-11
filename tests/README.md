# Enhanced Simple ORBIT MCP Tests

Test suite for Enhanced Simple ORBIT MCP v2.1 with beautiful XMP formatting and smart filename suffix features.

## Test Files

### Unit Tests
- **`test-filename-suffix.js`** - Tests "_me" filename suffix functionality
- **`test-enhanced-xmp.js`** - Tests beautiful XMP field formatting and alignment
- **`test-metadata-report.js`** - NEW! Tests category-based metadata reports

### Integration Tests  
- **`test-complete-integration.js`** - Full workflow test with Supabase integration

### Enhanced Tests
- **`test-enhanced-category-reports.js`** - NEW! Tests enhanced category-based report generation for all schema types

### Test Runner
- **`run-all-tests.js`** - Runs all unit tests and provides integration test instructions

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Test
```bash
npm run test:integration
```

### Individual Tests
```bash
# Test filename suffix transformation
node tests/test-filename-suffix.js

# Test XMP formatting enhancement
node tests/test-enhanced-xmp.js

# Test metadata report generation (NEW!)
node tests/test-metadata-report.js

# Test enhanced category-based reports (NEW!)
node test-enhanced-category-reports.js

# Test complete workflow (requires build)
npm run build && node tests/test-complete-integration.js
```

## Test Coverage

### Filename Suffix Tests
- ✅ Basic filename transformations
- ✅ Format conversion handling (PNG/TIFF → JPG)
- ✅ Directory path preservation
- ✅ Edge cases (no extension, complex names)

### XMP Formatting Tests
- ✅ Field name beautification (remove prefixes)
- ✅ Text alignment and padding
- ✅ Multiple schema support
- ✅ Professional display format

### Metadata Report Tests (NEW!)
- ✅ Category-based organization for all schemas
- ✅ Analysis type header generation
- ✅ Three report formats (detailed, simple, json-only)
- ✅ Professional formatting with emoji headers
- ✅ Raw JSON section separation

### Integration Tests
- ✅ Complete embedding workflow
- ✅ Supabase Storage integration  
- ✅ Stream processing validation
- ✅ Enhanced features verification

## Expected Outputs

### Filename Suffix Transformations
```
image.png → image_me.jpg
photo.jpg → photo_me.jpg  
folder/pic.png → folder/pic_me.jpg
Supabase_Buckets_Image.png → Supabase_Buckets_Image_me.jpg
```

### XMP Formatting Enhancement
```
Before: Lifestyle marketing potential emotional hooks: Value
After:  emotional hooks    : Value

Before: Product physical characteristics primary color: Silver
After:  primary color      : Silver
```

## Requirements

- Node.js 18+
- Built TypeScript project (`npm run build`)
- Valid Supabase credentials (for integration tests)
- Test images in Supabase Storage (for integration tests)

## Test Philosophy

These tests validate the core enhancements that make Simple ORBIT MCP v2.1 more user-friendly:

1. **Beautiful Metadata**: Professional XMP display without technical jargon
2. **Smart Filenames**: Clear visual indicators of processed images
3. **📊 Category-Based Reports**: NEW! Organized metadata with analysis type headers
4. **🎯 Multi-Format Output**: Detailed, simple, and JSON-only report formats
5. **Stream Processing**: Efficient memory-only operations
6. **Multi-Schema Support**: Lifestyle, Product, and Orbit schemas

All tests are designed to be fast, reliable, and provide clear feedback on the enhanced functionality including the new category-based reporting system.