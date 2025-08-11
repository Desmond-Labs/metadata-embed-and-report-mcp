/**
 * Create XMP Tool
 * Generate standalone XMP metadata packets from metadata objects
 */

import { SupabaseImageClient } from '../core/supabase-client.js';
import { XMPProcessor } from '../core/xmp-processor.js';
import { MetadataValidator } from '../core/metadata-validator.js';
import { CreateXMPRequest, ProcessingResponse } from '../types/schemas.js';

export class CreateXMPTool {
  private supabaseClient: SupabaseImageClient;
  private xmpProcessor: XMPProcessor;
  private validator: MetadataValidator;

  constructor(supabaseClient: SupabaseImageClient) {
    this.supabaseClient = supabaseClient;
    this.xmpProcessor = new XMPProcessor();
    this.validator = new MetadataValidator();
  }

  /**
   * Execute XMP packet creation
   */
  async execute(params: CreateXMPRequest): Promise<ProcessingResponse> {
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

      // Create XMP packet
      const xmpPacketInfo = this.xmpProcessor.createXMPPacket(
        params.metadata,
        metadataValidation.schema_type,
        {
          includeWrappers: params.include_wrappers !== false,
          prettyPrint: params.pretty_print !== false,
          includeProcessingInfo: true
        }
      );

      // Validate the generated XMP packet
      const xmpValidation = this.xmpProcessor.validateXMPPacket(xmpPacketInfo.xmp_content);

      let uploadPath: string | undefined;

      // Save to Supabase Storage if output path is provided
      if (params.output_path) {
        try {
          const xmpBuffer = new TextEncoder().encode(xmpPacketInfo.xmp_content);
          uploadPath = await this.supabaseClient.uploadImageFromBuffer(
            params.output_path,
            xmpBuffer,
            'application/xml',
            true // upsert
          );
        } catch (uploadError) {
          return {
            success: false,
            error: `Failed to save XMP file: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`,
            processing_time: Date.now() - startTime
          };
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        message: 'XMP packet created successfully',
        processing_time: processingTime,
        schema_type: metadataValidation.schema_type,
        xmp_packet: xmpPacketInfo.xmp_content,
        xmp_stats: {
          packet_size: xmpPacketInfo.packet_size,
          field_count: xmpPacketInfo.field_count,
          namespace_count: xmpPacketInfo.namespace_count
        },
        xmp_validation: xmpValidation,
        metadata_validation: {
          field_count: metadataValidation.field_count,
          completeness_score: metadataValidation.completeness_score,
          warnings: metadataValidation.warnings
        },
        ...(uploadPath && { saved_to: uploadPath })
      };

    } catch (error) {
      return {
        success: false,
        error: `XMP creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processing_time: Date.now() - startTime
      };
    }
  }

  /**
   * Create XMP packet preview (shortened version)
   */
  async createPreview(params: CreateXMPRequest, maxLength: number = 500): Promise<ProcessingResponse> {
    const result = await this.execute(params);
    
    if (result.success && result.xmp_packet) {
      const fullPacket = result.xmp_packet;
      if (fullPacket.length > maxLength) {
        result.xmp_packet = fullPacket.substring(0, maxLength) + '\n... (truncated)';
        result.message = 'XMP packet preview created (truncated for display)';
        result.preview_truncated = true;
        result.full_packet_size = fullPacket.length;
      }
    }
    
    return result;
  }

  /**
   * Create multiple XMP packets (batch processing)
   */
  async createBatch(requests: CreateXMPRequest[]): Promise<ProcessingResponse[]> {
    const results: ProcessingResponse[] = [];
    
    for (const request of requests) {
      const result = await this.execute(request);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Validate input parameters
   */
  private validateInput(params: CreateXMPRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Required parameters
    if (!params.metadata || typeof params.metadata !== 'object') {
      errors.push('metadata is required and must be an object');
    }

    // Optional parameters validation
    if (params.schema_type && !['lifestyle', 'product', 'orbit'].includes(params.schema_type)) {
      errors.push('schema_type must be one of: lifestyle, product, orbit');
    }

    if (params.include_wrappers !== undefined && typeof params.include_wrappers !== 'boolean') {
      errors.push('include_wrappers must be a boolean');
    }

    if (params.pretty_print !== undefined && typeof params.pretty_print !== 'boolean') {
      errors.push('pretty_print must be a boolean');
    }

    // Output path validation
    if (params.output_path) {
      if (typeof params.output_path !== 'string') {
        errors.push('output_path must be a string');
      } else if (!params.output_path.toLowerCase().endsWith('.xmp') && 
                 !params.output_path.toLowerCase().endsWith('.xml')) {
        errors.push('output_path should have .xmp or .xml extension');
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
      name: 'create_xmp_packet',
      description: 'Create standalone XMP metadata packet from metadata object with validation',
      inputSchema: {
        type: 'object',
        properties: {
          metadata: {
            type: 'object',
            description: 'Metadata object to convert to XMP format (supports lifestyle, product, and orbit schemas)'
          },
          schema_type: {
            type: 'string',
            enum: ['lifestyle', 'product', 'orbit'],
            description: 'Schema type for metadata validation (auto-detected if not specified)'
          },
          output_path: {
            type: 'string',
            description: 'Path to save XMP file in Supabase Storage (optional, e.g., "metadata/sample.xmp")'
          },
          include_wrappers: {
            type: 'boolean',
            description: 'Include XMP packet wrappers (default: true)'
          },
          pretty_print: {
            type: 'boolean',
            description: 'Format XMP for readability with indentation (default: true)'
          }
        },
        required: ['metadata']
      }
    };
  }

  /**
   * Format response for MCP
   */
  formatResponse(result: ProcessingResponse): string {
    if (!result.success) {
      return `❌ **XMP Creation Failed**\n\n**Error:** ${result.error}\n**Processing Time:** ${result.processing_time}ms`;
    }

    let response = `✅ **XMP Packet Created Successfully**\n\n`;
    
    response += `**Metadata Information:**\n`;
    response += `• Schema Type: ${result.schema_type}\n`;
    response += `• Processing Time: ${result.processing_time}ms\n\n`;

    response += `**XMP Packet Information:**\n`;
    response += `• Packet Size: ${(result.xmp_stats.packet_size / 1024).toFixed(2)} KB\n`;
    response += `• Field Count: ${result.xmp_stats.field_count}\n`;
    response += `• Namespace Count: ${result.xmp_stats.namespace_count}\n\n`;

    if (result.saved_to) {
      response += `**Storage Information:**\n`;
      response += `• Saved to: ${result.saved_to}\n\n`;
    }

    // XMP Validation Results
    if (result.xmp_validation) {
      const validationIcon = result.xmp_validation.valid ? '✅' : '⚠️';
      response += `**XMP Validation:** ${validationIcon} ${result.xmp_validation.valid ? 'Valid' : 'Issues Found'}\n`;
      
      if (result.xmp_validation.warnings.length > 0) {
        response += `**XMP Warnings:**\n`;
        result.xmp_validation.warnings.forEach((warning: string, index: number) => {
          response += `${index + 1}. ${warning}\n`;
        });
        response += '\n';
      }
    }

    // Metadata Validation Results
    if (result.metadata_validation) {
      response += `**Metadata Quality:**\n`;
      response += `• Completeness Score: ${result.metadata_validation.completeness_score}%\n`;
      response += `• Fields Processed: ${result.metadata_validation.field_count}\n`;
      
      if (result.metadata_validation.warnings.length > 0) {
        response += `• Warnings: ${result.metadata_validation.warnings.length}\n`;
      }
      response += '\n';
    }

    // Show XMP content preview or full content
    if (result.preview_truncated) {
      response += `**XMP Preview** (${result.full_packet_size} bytes total):\n`;
    } else {
      response += `**XMP Content:**\n`;
    }
    
    response += `\`\`\`xml\n${result.xmp_packet}\n\`\`\`\n\n`;

    if (!result.saved_to) {
      response += `💡 **Tip:** Specify an \`output_path\` to save the XMP packet to Supabase Storage for future use.`;
    }

    return response;
  }

  /**
   * Format batch processing results
   */
  formatBatchResponse(results: ProcessingResponse[]): string {
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    
    let response = `📦 **Batch XMP Creation Results**\n\n`;
    response += `**Summary:**\n`;
    response += `• Total Requests: ${results.length}\n`;
    response += `• Successful: ${successful}\n`;
    response += `• Failed: ${failed}\n\n`;

    if (successful > 0) {
      const totalSize = results
        .filter(r => r.success)
        .reduce((sum, r) => sum + (r.xmp_stats?.packet_size || 0), 0);
      
      response += `**Success Statistics:**\n`;
      response += `• Total XMP Size: ${(totalSize / 1024).toFixed(2)} KB\n`;
      response += `• Average Processing Time: ${Math.round(
        results.filter(r => r.success).reduce((sum, r) => sum + (r.processing_time || 0), 0) / successful
      )}ms\n\n`;
    }

    if (failed > 0) {
      response += `**Failed Requests:**\n`;
      results.forEach((result, index) => {
        if (!result.success) {
          response += `${index + 1}. ${result.error}\n`;
        }
      });
    }

    return response;
  }

  /**
   * Generate XMP file with custom filename based on metadata
   */
  generateXMPFilename(metadata: any, schemaType: string): string {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Try to get a meaningful name from metadata
    let baseName = 'metadata';
    
    if (metadata.title) {
      baseName = metadata.title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    } else if (metadata.scene_overview?.setting) {
      baseName = metadata.scene_overview.setting.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    } else if (metadata.product_identification?.product_type) {
      baseName = metadata.product_identification.product_type.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    }
    
    return `xmp/${schemaType}_${baseName}_${timestamp}.xmp`;
  }
}