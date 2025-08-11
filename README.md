# Image Metadata Embed and Report

A streamlined MCP server for XMP metadata embedding with beautiful formatting and smart filename indicators. Features professional XMP display and automatic "_me" suffix for processed images.

## ✨ Features

✅ **Beautiful XMP Formatting**: Clean, aligned metadata display without technical prefixes  
✅ **Smart "_me" Filename Suffix**: Instant visual indicator for metadata-enhanced images  
✅ **📊 Category-Based Reports**: Metadata organized by natural categories with analysis type headers  
✅ **🎯 Analysis Type Identification**: Clear "LIFESTYLE/PRODUCT/ORBIT" headers in all reports  
✅ **5 Core Tools**: embed, read, validate, create_xmp, **create_metadata_report** with improved UX  
✅ **Stream Processing**: Memory-only image processing, no local files  
✅ **Multi-Schema Support**: Lifestyle, Product, and Orbit schemas  
✅ **Supabase Integration**: Seamless cloud storage processing  
✅ **TypeScript**: Full type safety and modern development  
✅ **Zero Setup**: Single build command, immediate productivity  

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

Copy the example environment file and configure your Supabase credentials:

```bash
cp .env.example .env
```

Edit `.env` with your Supabase project details:
```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_BUCKET_NAME=your_storage_bucket_name
```

Get these values from your Supabase project dashboard at `https://supabase.com/dashboard/project/_/settings/api`

### 3. Build and Start

```bash
npm run build
npm start
```

### 4. Configure Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "image-metadata-embed-and-report": {
      "command": "node",
      "args": ["/path/to/your/image-metadata-embed-and-report/dist/server.js"],
      "env": {
        "SUPABASE_URL": "https://your-project-id.supabase.co",
        "SUPABASE_ANON_KEY": "your_anon_key_here",
        "SUPABASE_BUCKET_NAME": "your_storage_bucket_name"
      },
      "description": "Image Metadata Embed and Report - XMP metadata with beautiful formatting"
    }
  }
}
```

Replace `/path/to/your/image-metadata-embed-and-report/` with the actual path where you cloned this repository.

## ✨ Enhanced Features Overview

### **Beautiful XMP Display**
Transform technical metadata into professional, readable format:

**Before:**
```
Lifestyle marketing potential emotional hooks: Comfort, Pleasure, Well-being
Product physical characteristics primary color: Silver/Gray
```

**After:**
```
emotional hooks    : Comfort, Pleasure, Well-being
primary color      : Silver/Gray

--- Raw JSON ---
{"lifestyle_marketing_potential_emotional_hooks": "Comfort, Pleasure, Well-being", ...}
```

### **Smart Filename Suffix**
All processed images automatically get "_me" suffix:

```bash
# Input → Output
restaurant_scene.png → restaurant_scene_me.jpg
product_photo.tiff → product_photo_me.jpg
folder/image.png → folder/image_me.jpg
```

**Benefits:**
- ✅ Instant visual identification of processed images
- ✅ Preserves original file names and organization
- ✅ Automatic format conversion for universal XMP support

## Available Tools

### 1. embed_image_metadata (Enhanced)

Embed XMP metadata with beautiful formatting and smart filename suffix.

```javascript
{
  "source_path": "images/restaurant_scene.png",
  "metadata": {
    "scene_overview": {
      "setting": "Outdoor restaurant patio",
      "time_of_day": "Evening"
    },
    "human_elements": {
      "number_of_people": 8,
      "social_dynamics": "Friends enjoying dinner"
    },
    "marketing_potential": {
      "emotional_hooks": ["Social connection", "Relaxed dining"]
    }
  },
  "output_path": "processed/restaurant_scene.png",
  "schema_type": "lifestyle"
}
```

**Enhanced Output:**
- 📁 **File**: `processed/restaurant_scene_me.jpg` (automatic suffix + conversion)
- ✨ **Beautiful XMP**: Clean, aligned field display without technical prefixes
- 🔄 **Auto-conversion**: PNG/TIFF → JPG for universal compatibility
- 📊 **Metrics**: Processing time, field count, completeness score

### 2. read_image_metadata (Enhanced)

Extract and display metadata with beautiful formatting.

```javascript
{
  "image_path": "processed/restaurant_scene_me.jpg",
  "format": "formatted",
  "include_xmp": true
}
```

**Beautiful Output:**
```
setting           : Outdoor restaurant patio
time of day       : Evening
number of people  : 8
social dynamics   : Friends enjoying dinner
emotional hooks   : Social connection, Relaxed dining

--- Raw JSON ---
{"lifestyle_scene_overview_setting": "Outdoor restaurant patio", ...}
```

### 3. validate_metadata_schema

Validate metadata against schema requirements.

```javascript
{
  "metadata": {
    "product_identification": {
      "product_type": "Console Table",
      "design_style": "Minimalist"
    }
  },
  "schema_type": "product",
  "strict_mode": false
}
```

### 4. create_xmp_packet

Generate standalone XMP packets.

```javascript
{
  "metadata": {
    "scene_overview": {
      "setting": "Modern office",
      "activities": ["Working", "Collaboration"]
    }
  },
  "output_path": "metadata/office_scene.xmp",
  "pretty_print": true
}
```

### 5. create_metadata_report (NEW!)

Generate human-readable reports from XMP metadata with category organization.

```javascript
{
  "image_path": "processed/restaurant_scene_me.jpg",
  "format": "detailed",
  "include_raw_json": true
}
```

**Category-Based Output:**
```
🎯 TYPE OF ANALYSIS COMPLETED: LIFESTYLE
Categories Found: 8 | Total Fields: 14 | Processing Time: 4.2ms

📊 SCENE OVERVIEW
-----------------------------------------------------------------
Setting         : Elegant restaurant interior
Time Of Day     : Evening

👥 HUMAN ELEMENTS
-----------------------------------------------------------------
Number Of People: 6
Social Dynamics : Family celebration dinner

[... other organized categories ...]

=================================================================
RAW JSON DATA (Machine Readable)
=================================================================
{...complete metadata...}
```

**Three Report Formats:**
- **detailed**: Full categorized report with all metadata + raw JSON
- **simple**: Key fields organized by category for quick review  
- **json-only**: Raw machine-readable metadata only

## Supported Schemas

### Lifestyle Schema (36+ fields)
Social dynamics, cultural context, and lifestyle analysis
- `scene_overview` - Setting, time, occasion, activities
- `human_elements` - Demographics, interactions, emotions
- `environment` - Location, architecture, spatial arrangement
- `marketing_potential` - Target demographics, brand alignment

### Product Schema (25+ fields)  
Design aesthetics and commercial product analysis
- `product_identification` - Type, category, style, brand
- `physical_characteristics` - Color, material, texture, dimensions
- `commercial_analysis` - Market positioning, target market, pricing
- `quality_assessment` - Construction, materials, craftsmanship

### Orbit Schema (40+ fields)
Comprehensive visual intelligence analysis
- `scene_overview` - Setting, time, activities, mood
- `human_elements` - People count, age groups, interactions
- `key_objects` - Products, technology, notable items
- `atmospheric_elements` - Color scheme, lighting, visual mood

## Architecture

```
simple-orbit-mcp/
├── src/
│   ├── server.ts              # Main MCP server
│   ├── core/
│   │   ├── supabase-client.ts # Stream-based storage client
│   │   ├── xmp-processor.ts   # XMP creation and embedding
│   │   └── metadata-validator.ts # Schema validation
│   ├── tools/
│   │   ├── embed-metadata.ts  # Embedding tool
│   │   ├── read-metadata.ts   # Reading tool
│   │   ├── validate-schema.ts # Validation tool
│   │   ├── create-xmp.ts      # XMP creation tool
│   │   └── create-metadata-report.ts # NEW! Category-based reports
│   └── types/
│       └── schemas.ts         # TypeScript interfaces
└── dist/                      # Compiled JavaScript
```

## Development

### Build and Watch
```bash
npm run build     # Compile TypeScript
npm run watch     # Watch for changes
npm run dev       # Development mode with tsx
```

### Environment Setup
```bash
# Required environment variables
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here

# Optional: Use service role key for enhanced permissions
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Stream Processing Benefits

- ✅ **No Local Storage**: Images never touch your hard drive
- ✅ **Memory Efficient**: Process large images in RAM
- ✅ **Fast Processing**: Direct memory-to-memory operations  
- ✅ **Security**: No local file persistence or cleanup needed
- ✅ **Scalable**: Works with any Supabase Storage bucket

## Example Workflows

### Lifestyle Image Analysis
```bash
# 1. Validate lifestyle metadata
validate_metadata_schema({
  "metadata": {
    "scene_overview": { "setting": "Coffee shop", "time_of_day": "Morning" },
    "human_elements": { "number_of_people": 2, "social_dynamics": "Business meeting" }
  },
  "schema_type": "lifestyle"
})

# 2. Embed into image
embed_image_metadata({
  "source_path": "uploads/coffee_meeting.jpg",
  "metadata": { /* lifestyle metadata */ },
  "output_path": "processed/coffee_meeting_analyzed.jpg"
})

# 3. Verify embedding
read_image_metadata({
  "image_path": "processed/coffee_meeting_analyzed.jpg",
  "format": "json"
})
```

### Product Catalog Processing
```bash
# 1. Create XMP packet for product
create_xmp_packet({
  "metadata": {
    "product_identification": { "product_type": "Office Chair", "design_style": "Ergonomic" },
    "commercial_analysis": { "target_market": ["Businesses", "Home offices"] }
  },
  "schema_type": "product",
  "output_path": "metadata/office_chair.xmp"
})

# 2. Embed into product image
embed_image_metadata({
  "source_path": "catalog/chair_001.jpg",
  "metadata": { /* product metadata */ },
  "output_path": "catalog/processed/chair_001_metadata.jpg"
})
```

### Category-Based Report Generation
```bash
# 1. Generate detailed categorized report
create_metadata_report({
  "image_path": "processed/restaurant_celebration_me.jpg",
  "format": "detailed",
  "include_raw_json": true
})

# Output: Organized report with category headers:
# 🎯 TYPE OF ANALYSIS COMPLETED: LIFESTYLE
# 📊 SCENE OVERVIEW | 👥 HUMAN ELEMENTS | 🌍 ENVIRONMENT
# 🍽️ KEY OBJECTS | 🌅 ATMOSPHERIC ELEMENTS | etc.

# 2. Generate simple summary report for quick review
create_metadata_report({
  "image_path": "catalog/chair_001_me.jpg",
  "format": "simple"
})

# Output: Condensed report showing key fields by category
# Analysis: PRODUCT (6 categories, 13 fields)

# 3. Generate JSON-only report for API integration
create_metadata_report({
  "image_path": "orbit/workspace_me.jpg", 
  "format": "json-only"
})
```

## ✨ Enhanced Features Summary

### **Professional XMP Display**
- Clean field names without schema prefixes
- Aligned formatting for consistent appearance
- Dual format: human-readable + machine-parseable
- ExifTool compatible output

### **📊 Category-Based Reports (NEW!)**
- Metadata organized by natural categories (Scene Overview, Human Elements, etc.)
- Clear analysis type identification (LIFESTYLE/PRODUCT/ORBIT)
- Three report formats: detailed, simple, json-only
- Professional formatting with emoji headers and alignment
- Separated raw JSON section for machine processing

### **Smart Filename Management**
- Automatic "_me" suffix for processed images
- Preserves original file organization
- Format conversion for universal XMP support
- Clear visual indicators of enhancement

### **Stream Processing**
- Memory-only image processing
- No local file downloads or cleanup
- Fast, efficient operations
- Secure cloud-to-cloud processing

## Dependencies

- `@modelcontextprotocol/sdk` - MCP server framework
- `@supabase/supabase-js` - Supabase client for cloud storage
- `sharp` - High-performance image processing

## Requirements

- Node.js 18+
- TypeScript 5+
- Supabase project with Storage bucket
- Valid Supabase credentials

## Performance

- ✅ **Sub-5ms Processing**: Ultra-fast metadata embedding
- ✅ **Memory Efficient**: <256MB per request
- ✅ **Format Conversion**: Automatic PNG/TIFF → JPG optimization
- ✅ **Smart Filenames**: Instant visual feedback
- ✅ **Beautiful Display**: Professional XMP formatting
- ✅ **📊 Fast Reports**: <5ms category-based report generation
- ✅ **🎯 Multi-Format**: Detailed, simple, and JSON-only output formats

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/yourusername/image-metadata-embed-and-report/issues) on GitHub.

---

**Image Metadata Embed and Report** - Beautiful metadata, smart filenames, streamlined workflows