/**
 * Read Metadata Tool
 * Extract XMP metadata from Supabase Storage images using stream processing
 */

import { SupabaseImageClient, validateImageBuffer } from '../core/supabase-client.js';
import { XMPProcessor } from '../core/xmp-processor.js';
import { ReadMetadataRequest, ProcessingResponse } from '../types/schemas.js';

export class ReadMetadataTool {
  private supabaseClient: SupabaseImageClient;
  private xmpProcessor: XMPProcessor;

  constructor(supabaseClient: SupabaseImageClient) {
    this.supabaseClient = supabaseClient;
    this.xmpProcessor = new XMPProcessor();
  }

  /**
   * Execute metadata reading
   */
  async execute(params: ReadMetadataRequest): Promise<ProcessingResponse> {
    const startTime = Date.now();
    
    try {
      // Validate input parameters
      const validationResult = this.validateInput(params);
      if (!validationResult.valid) {
        return {
          success: false,
          error: `Input validation failed: ${validationResult.errors.join(', ')}`,
          processing_time: Date.now() - startTime
        };
      }

      // Check if image exists
      const imageExists = await this.supabaseClient.imageExists(params.image_path);
      if (!imageExists) {
        return {
          success: false,
          error: `Image not found: ${params.image_path}`,
          processing_time: Date.now() - startTime
        };
      }

      // Get image info
      const imageInfo = await this.supabaseClient.getImageInfo(params.image_path);

      // Download image to memory buffer
      const imageBuffer = await this.supabaseClient.downloadImageToBuffer(params.image_path);
      
      // Validate image buffer
      const bufferValidation = validateImageBuffer(imageBuffer);
      if (!bufferValidation.valid) {
        return {
          success: false,
          error: `Invalid image: ${bufferValidation.error}`,
          processing_time: Date.now() - startTime
        };
      }

      // Extract metadata
      const extractionResult = this.extractMetadata(imageBuffer, params);
      
      const processingTime = Date.now() - startTime;

      return {
        success: true,
        message: 'Metadata extracted successfully',
        processing_time: processingTime,
        image_path: params.image_path,
        image_format: bufferValidation.format,
        image_size: bufferValidation.size,
        image_info: imageInfo,
        ...extractionResult
      };

    } catch (error) {
      return {
        success: false,
        error: `Reading failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processing_time: Date.now() - startTime
      };
    }
  }

  /**
   * Extract metadata from image buffer
   */
  private extractMetadata(imageBuffer: Uint8Array, params: ReadMetadataRequest) {
    const result: any = {
      xmp_found: false,
      metadata: {}
    };

    // Extract XMP metadata if requested
    if (params.include_xmp !== false) {
      const xmpResult = this.xmpProcessor.extractXMPFromImage(imageBuffer);
      
      if (xmpResult.xmp_found) {
        result.xmp_found = true;
        result.xmp_raw_content = xmpResult.xmp_content;
        result.schema_type = xmpResult.schema_type;
        
        if (xmpResult.parsed_metadata) {
          result.metadata.orbit = xmpResult.parsed_metadata;
        }

        // Get XMP statistics
        if (xmpResult.xmp_content) {
          result.xmp_stats = this.xmpProcessor.getXMPStats(xmpResult.xmp_content);
        }
      }
    }

    // Basic EXIF extraction (simplified - would need exif library for full support)
    if (params.include_exif !== false) {
      result.metadata.exif = this.extractBasicExif(imageBuffer);
    }

    return result;
  }

  /**
   * Extract basic EXIF data (simplified implementation)
   */
  private extractBasicExif(imageBuffer: Uint8Array): any {
    const exif: any = {
      extracted: false,
      message: 'Basic EXIF extraction - install exif library for full support'
    };

    // For JPEG files, we can extract some basic info
    if (imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8) {
      exif.file_type = 'JPEG';
      exif.extracted = true;
      
      // Simple JPEG dimension extraction from SOF0 marker
      try {
        const dimensions = this.extractJPEGDimensions(imageBuffer);
        if (dimensions) {
          exif.image_width = dimensions.width;
          exif.image_height = dimensions.height;
        }
      } catch (error) {
        // Silent fail for EXIF extraction
      }
    } else if (Array.from(imageBuffer.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('') === '89504e470d0a1a0a') {
      exif.file_type = 'PNG';
      exif.extracted = true;
      
      // Extract PNG dimensions from IHDR chunk
      try {
        const dimensions = this.extractPNGDimensions(imageBuffer);
        if (dimensions) {
          exif.image_width = dimensions.width;
          exif.image_height = dimensions.height;
        }
      } catch (error) {
        // Silent fail for EXIF extraction
      }
    }

    return exif;
  }

  /**
   * Extract JPEG dimensions from SOF0 marker
   */
  private extractJPEGDimensions(buffer: Uint8Array): { width: number; height: number } | null {
    // Look for SOF0 marker (0xFFC0)
    for (let i = 0; i < buffer.length - 9; i++) {
      if (buffer[i] === 0xFF && buffer[i + 1] === 0xC0) {
        const height = (buffer[i + 5] << 8) | buffer[i + 6];
        const width = (buffer[i + 7] << 8) | buffer[i + 8];
        return { width, height };
      }
    }
    return null;
  }

  /**
   * Extract PNG dimensions from IHDR chunk
   */
  private extractPNGDimensions(buffer: Uint8Array): { width: number; height: number } | null {
    // PNG IHDR chunk starts at byte 16
    if (buffer.length > 24) {
      const width = (buffer[16] << 24) | (buffer[17] << 16) | (buffer[18] << 8) | buffer[19];
      const height = (buffer[20] << 24) | (buffer[21] << 16) | (buffer[22] << 8) | buffer[23];
      return { width, height };
    }
    return null;
  }

  /**
   * Validate input parameters
   */
  private validateInput(params: ReadMetadataRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Required parameters
    if (!params.image_path || typeof params.image_path !== 'string') {
      errors.push('image_path is required and must be a string');
    }

    // Optional parameters validation
    if (params.format && !['json', 'text'].includes(params.format)) {
      errors.push('format must be either "json" or "text"');
    }

    // File extension validation
    if (params.image_path) {
      const validExtensions = ['.jpg', '.jpeg', '.png', '.tiff'];
      const hasValidExtension = validExtensions.some(ext => 
        params.image_path.toLowerCase().endsWith(ext)
      );
      if (!hasValidExtension) {
        errors.push('image_path must have a valid image extension (.jpg, .jpeg, .png, .tiff)');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get tool schema for MCP registration
   */
  static getToolSchema() {
    return {
      name: 'read_image_metadata',
      description: 'Extract XMP and basic EXIF metadata from images in Supabase Storage',
      inputSchema: {
        type: 'object',
        properties: {
          image_path: {
            type: 'string',
            description: 'Path to image in Supabase Storage (e.g., "folder/image.jpg")'
          },
          format: {
            type: 'string',
            enum: ['json', 'text'],
            description: 'Output format for metadata (default: json)'
          },
          include_xmp: {
            type: 'boolean',
            description: 'Include XMP metadata extraction (default: true)'
          },
          include_exif: {
            type: 'boolean',
            description: 'Include basic EXIF data extraction (default: true)'
          }
        },
        required: ['image_path']
      }
    };
  }

  /**
   * Format response for MCP
   */
  formatResponse(result: ProcessingResponse, format: string = 'json'): string {
    if (!result.success) {
      return `❌ **Metadata Reading Failed**\n\n**Error:** ${result.error}\n**Processing Time:** ${result.processing_time}ms`;
    }

    if (format === 'text') {
      return this.formatTextResponse(result);
    } else {
      return this.formatJsonResponse(result);
    }
  }

  /**
   * Format response as JSON
   */
  private formatJsonResponse(result: ProcessingResponse): string {
    let response = `📊 **Metadata from:** ${result.image_path}\n\n`;
    
    const metadata: Record<string, any> = {
      success: result.success,
      image_info: {
        path: result.image_path,
        format: result.image_format,
        size_bytes: result.image_size,
        size_kb: Math.round(result.image_size / 1024),
        ...(result.image_info || {})
      },
      processing: {
        time_ms: result.processing_time,
        xmp_found: result.xmp_found
      }
    };

    if (result.xmp_found) {
      metadata.xmp_metadata = result.metadata?.orbit || {};
      metadata.xmp_stats = result.xmp_stats || {};
      metadata.schema_type = result.schema_type;
    }

    if (result.metadata?.exif) {
      metadata.exif_data = result.metadata.exif;
    }

    response += `\`\`\`json\n${JSON.stringify(metadata, null, 2)}\n\`\`\``;
    
    return response;
  }

  /**
   * Format response as text
   */
  private formatTextResponse(result: ProcessingResponse): string {
    let response = `📊 **Metadata Summary for:** ${result.image_path}\n\n`;
    
    response += `**File Information:**\n`;
    response += `• Format: ${result.image_format}\n`;
    response += `• Size: ${(result.image_size / 1024).toFixed(1)} KB\n`;
    response += `• Processing Time: ${result.processing_time}ms\n\n`;

    if (result.image_info) {
      response += `**Storage Information:**\n`;
      response += `• Content Type: ${result.image_info.contentType}\n`;
      response += `• Last Modified: ${result.image_info.lastModified}\n\n`;
    }

    if (result.xmp_found) {
      response += `**XMP Metadata:** ✅ Found\n`;
      response += `• Schema Type: ${result.schema_type}\n`;
      
      if (result.xmp_stats) {
        response += `• Packet Size: ${(result.xmp_stats.size_bytes / 1024).toFixed(2)} KB\n`;
        response += `• Field Count: ${result.xmp_stats.field_count}\n`;
        response += `• Namespaces: ${result.xmp_stats.namespaces_detected.join(', ')}\n`;
      }
      
      response += '\n';

      // Display key metadata fields
      if (result.metadata?.orbit) {
        response += `**Key Metadata Fields:**\n`;
        this.displayMetadataFields(result.metadata.orbit, response);
      }
    } else {
      response += `**XMP Metadata:** ❌ Not found\n\n`;
    }

    if (result.metadata?.exif?.extracted) {
      response += `**EXIF Data:** ✅ Basic extraction\n`;
      if (result.metadata.exif.image_width) {
        response += `• Dimensions: ${result.metadata.exif.image_width} × ${result.metadata.exif.image_height}\n`;
      }
      response += `• File Type: ${result.metadata.exif.file_type}\n\n`;
    }

    return response;
  }

  /**
   * Display metadata fields recursively
   */
  private displayMetadataFields(obj: any, response: string, indent: string = ''): void {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        response += `${indent}• ${key}:\n`;
        this.displayMetadataFields(value, response, indent + '  ');
      } else {
        response += `${indent}• ${key}: ${value}\n`;
      }
    }
  }
}