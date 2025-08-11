/**
 * Embed Metadata Tool
 * Stream-based XMP metadata embedding into Supabase Storage images
 */

import { SupabaseImageClient, validateImageBuffer } from '../core/supabase-client.js';
import { XMPProcessor } from '../core/xmp-processor.js';
import { MetadataValidator } from '../core/metadata-validator.js';
import { ImageConverter } from '../core/image-converter.js';
import { EmbedMetadataRequest, ProcessingResponse } from '../types/schemas.js';

export class EmbedMetadataTool {
  private supabaseClient: SupabaseImageClient;
  private xmpProcessor: XMPProcessor;
  private validator: MetadataValidator;
  private imageConverter: ImageConverter;

  constructor(supabaseClient: SupabaseImageClient) {
    this.supabaseClient = supabaseClient;
    this.xmpProcessor = new XMPProcessor();
    this.validator = new MetadataValidator();
    this.imageConverter = new ImageConverter();
  }

  /**
   * Execute metadata embedding
   */
  async execute(params: EmbedMetadataRequest): Promise<ProcessingResponse> {
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

      // Validate metadata schema
      const metadataValidation = this.validator.validateMetadata(
        params.metadata, 
        params.schema_type
      );

      if (!metadataValidation.valid) {
        return {
          success: false,
          error: `Metadata validation failed: ${metadataValidation.errors.join(', ')}`,
          validation_warnings: metadataValidation.warnings,
          processing_time: Date.now() - startTime
        };
      }

      // Check if source image exists
      const imageExists = await this.supabaseClient.imageExists(params.source_path);
      if (!imageExists) {
        return {
          success: false,
          error: `Source image not found: ${params.source_path}`,
          processing_time: Date.now() - startTime
        };
      }

      // Download image to memory buffer
      const imageBuffer = await this.supabaseClient.downloadImageToBuffer(params.source_path);
      
      // Convert to JPEG if needed (in-memory stream processing)
      const conversionResult = await this.imageConverter.processBuffer(imageBuffer, {
        quality: params.compression_quality || 95
      });
      
      // Update output path if format was converted
      const finalOutputPath = this.imageConverter.updateOutputPath(
        params.output_path, 
        conversionResult.converted
      );
      
      // Validate converted image buffer
      const bufferValidation = validateImageBuffer(conversionResult.buffer);
      if (!bufferValidation.valid) {
        return {
          success: false,
          error: `Invalid image after conversion: ${bufferValidation.error}`,
          processing_time: Date.now() - startTime,
          format_converted: conversionResult.converted,
          original_format: conversionResult.originalFormat,
          target_format: conversionResult.targetFormat,
          conversion_time: conversionResult.conversionTime
        };
      }

      // Create XMP packet
      const xmpPacketInfo = this.xmpProcessor.createXMPPacket(
        params.metadata,
        metadataValidation.schema_type,
        {
          includeWrappers: true,
          prettyPrint: true,
          includeProcessingInfo: true
        }
      );

      // Embed XMP into converted image
      const processedImageBuffer = this.xmpProcessor.embedXMPInImage(
        conversionResult.buffer,
        xmpPacketInfo.xmp_content
      );

      // Upload processed image with final path
      const uploadPath = await this.supabaseClient.uploadImageFromBuffer(
        finalOutputPath,
        processedImageBuffer,
        'image/jpeg', // Always JPEG after conversion
        true // upsert
      );

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        message: 'Metadata embedded successfully',
        processing_time: processingTime,
        source_path: params.source_path,
        output_path: uploadPath,
        final_output_path: finalOutputPath,
        schema_type: metadataValidation.schema_type,
        
        // Size information
        original_size: conversionResult.originalSize,
        processed_size: processedImageBuffer.length,
        xmp_packet_size: xmpPacketInfo.packet_size,
        field_count: xmpPacketInfo.field_count,
        completeness_score: metadataValidation.completeness_score,
        
        // Conversion information
        format_converted: conversionResult.converted,
        original_format: conversionResult.originalFormat,
        target_format: conversionResult.targetFormat,
        conversion_time: conversionResult.conversionTime,
        
        // Validation results
        validation_warnings: metadataValidation.warnings.length > 0 ? metadataValidation.warnings : undefined
      };

    } catch (error) {
      return {
        success: false,
        error: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processing_time: Date.now() - startTime
      };
    }
  }

  /**
   * Validate input parameters
   */
  private validateInput(params: EmbedMetadataRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Required parameters
    if (!params.source_path || typeof params.source_path !== 'string') {
      errors.push('source_path is required and must be a string');
    }

    if (!params.output_path || typeof params.output_path !== 'string') {
      errors.push('output_path is required and must be a string');
    }

    if (!params.metadata || typeof params.metadata !== 'object') {
      errors.push('metadata is required and must be an object');
    }

    // Optional parameters validation
    if (params.schema_type && !['lifestyle', 'product', 'orbit'].includes(params.schema_type)) {
      errors.push('schema_type must be one of: lifestyle, product, orbit');
    }

    if (params.compression_quality !== undefined) {
      if (typeof params.compression_quality !== 'number' || 
          params.compression_quality < 1 || 
          params.compression_quality > 100) {
        errors.push('compression_quality must be a number between 1 and 100');
      }
    }

    // Path validation
    if (params.source_path && params.source_path === params.output_path) {
      errors.push('source_path and output_path cannot be the same');
    }

    // File extension validation
    if (params.source_path) {
      const validExtensions = ['.jpg', '.jpeg', '.png', '.tiff'];
      const hasValidExtension = validExtensions.some(ext => 
        params.source_path.toLowerCase().endsWith(ext)
      );
      if (!hasValidExtension) {
        errors.push('source_path must have a valid image extension (.jpg, .jpeg, .png, .tiff)');
      }
    }

    if (params.output_path) {
      const validExtensions = ['.jpg', '.jpeg', '.png', '.tiff'];
      const hasValidExtension = validExtensions.some(ext => 
        params.output_path.toLowerCase().endsWith(ext)
      );
      if (!hasValidExtension) {
        errors.push('output_path must have a valid image extension (.jpg, .jpeg, .png, .tiff)');
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
      name: 'embed_image_metadata',
      description: 'Embed XMP metadata into images stored in Supabase Storage using stream processing',
      inputSchema: {
        type: 'object',
        properties: {
          source_path: {
            type: 'string',
            description: 'Path to source image in Supabase Storage (e.g., "folder/image.jpg")'
          },
          metadata: {
            type: 'object',
            description: 'Metadata object containing scene analysis (supports lifestyle, product, or orbit schemas)'
          },
          output_path: {
            type: 'string',
            description: 'Path where processed image with embedded metadata will be saved'
          },
          schema_type: {
            type: 'string',
            enum: ['lifestyle', 'product', 'orbit'],
            description: 'Schema type for metadata validation (auto-detected if not specified)'
          },
          compression_quality: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            description: 'JPEG compression quality (1-100, default: 95)'
          }
        },
        required: ['source_path', 'metadata', 'output_path']
      }
    };
  }

  /**
   * Format success response for MCP
   */
  formatSuccessResponse(result: ProcessingResponse): string {
    if (!result.success) {
      return `❌ **Embedding Failed**\n\n**Error:** ${result.error}\n**Processing Time:** ${result.processing_time}ms`;
    }

    let response = `✅ **Metadata Successfully Embedded**\n\n`;
    response += `📁 **Source:** ${result.source_path}\n`;
    response += `📁 **Output:** ${result.final_output_path || result.output_path}\n`;
    response += `🧬 **Schema:** ${result.schema_type}\n`;
    response += `⚡ **Processing Time:** ${result.processing_time}ms\n`;
    
    // Add conversion information if converted
    if (result.format_converted) {
      response += `🔄 **Format Converted:** ${result.original_format} → ${result.target_format}\n`;
      response += `⏱️ **Conversion Time:** ${result.conversion_time}ms\n`;
    }
    response += `\n`;
    
    response += `**File Information:**\n`;
    response += `• Original Size: ${((result.original_size || 0) / 1024).toFixed(1)} KB\n`;
    response += `• Processed Size: ${((result.processed_size || 0) / 1024).toFixed(1)} KB\n`;
    response += `• Size Change: ${(result.processed_size || 0) > (result.original_size || 0) ? '+' : ''}${(((result.processed_size || 0) - (result.original_size || 0)) / 1024).toFixed(1)} KB\n\n`;
    
    response += `**Metadata Information:**\n`;
    response += `• XMP Packet Size: ${((result.xmp_packet_size || 0) / 1024).toFixed(2)} KB\n`;
    response += `• Fields Embedded: ${result.field_count || 0}\n`;
    response += `• Completeness Score: ${result.completeness_score || 0}%\n\n`;

    if (result.validation_warnings && result.validation_warnings.length > 0) {
      response += `**Validation Warnings:**\n`;
      result.validation_warnings.forEach((warning: string, index: number) => {
        response += `${index + 1}. ${warning}\n`;
      });
      response += '\n';
    }

    response += `The image now contains portable XMP metadata that can be read by any XMP-compatible application.`;

    return response;
  }
}