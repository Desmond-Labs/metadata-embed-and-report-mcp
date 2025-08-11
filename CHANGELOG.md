# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-08-11

### Added
- Initial open source release
- XMP metadata embedding with beautiful formatting
- Smart "_me" filename suffix for processed images
- Category-based metadata reports
- Support for Lifestyle, Product, and Orbit schemas
- Stream-based image processing with Supabase Storage
- TypeScript support with full type safety
- MCP (Model Context Protocol) server implementation

### Features
- 5 core tools: embed_image_metadata, read_image_metadata, validate_metadata_schema, create_xmp_packet, create_metadata_report
- Professional XMP display without technical prefixes
- Automatic format conversion (PNG/TIFF → JPG)
- Memory-only processing for security
- Multi-schema validation and processing