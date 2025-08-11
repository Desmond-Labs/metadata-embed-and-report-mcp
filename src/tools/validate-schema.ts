/**
 * Validate Schema Tool
 * Validate metadata against ORBIT schemas without embedding
 */

import { MetadataValidator } from '../core/metadata-validator.js';
import { ValidateSchemaRequest, ProcessingResponse, ValidationResult } from '../types/schemas.js';

export class ValidateSchemaTool {
  private validator: MetadataValidator;

  constructor() {
    this.validator = new MetadataValidator();
  }

  /**
   * Execute schema validation
   */
  async execute(params: ValidateSchemaRequest): Promise<ProcessingResponse> {
    const startTime = Date.now();
    
    try {
      // Validate input parameters
      const inputValidation = this.validateInput(params);
      if (!inputValidation.valid) {
        return {
          success: false,
          error: `Input validation failed: ${inputValidation.errors.join(', ')}`,
          processing_time: Date.now() - startTime
        };
      }

      // Validate metadata schema
      const validationResult = this.validator.validateMetadata(
        params.metadata,
        params.schema_type,
        params.strict_mode || false
      );

      // Sanitize metadata
      const sanitizedMetadata = this.validator.sanitizeMetadata(params.metadata);

      // Get schema requirements
      const schemaRequirements = this.validator.getSchemaRequirements(validationResult.schema_type);

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        message: validationResult.valid ? 'Metadata validation passed' : 'Metadata validation failed',
        processing_time: processingTime,
        validation: validationResult,
        sanitized_metadata: sanitizedMetadata,
        schema_requirements: schemaRequirements,
        recommendations: this.generateRecommendations(validationResult, sanitizedMetadata)
      };

    } catch (error) {
      return {
        success: false,
        error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processing_time: Date.now() - startTime
      };
    }
  }

  /**
   * Generate recommendations based on validation results
   */
  private generateRecommendations(validation: ValidationResult, sanitizedMetadata: any): string[] {
    const recommendations: string[] = [];

    // Completeness recommendations
    if (validation.completeness_score < 50) {
      recommendations.push('Consider adding more metadata fields to improve completeness score');
    } else if (validation.completeness_score < 80) {
      recommendations.push('Good coverage! Add a few more optional fields for comprehensive metadata');
    }

    // Schema-specific recommendations
    switch (validation.schema_type) {
      case 'lifestyle':
        if (!sanitizedMetadata.scene_overview) {
          recommendations.push('Add scene_overview section for better lifestyle analysis');
        }
        if (!sanitizedMetadata.marketing_potential) {
          recommendations.push('Include marketing_potential section for commercial insights');
        }
        break;

      case 'product':
        if (!sanitizedMetadata.product_identification?.product_type) {
          recommendations.push('Specify product_type for better product categorization');
        }
        if (!sanitizedMetadata.commercial_analysis) {
          recommendations.push('Add commercial_analysis section for market positioning');
        }
        break;

      case 'orbit':
        if (validation.field_count < 20) {
          recommendations.push('Consider adding more descriptive fields for comprehensive analysis');
        }
        break;
    }

    // Error-based recommendations
    if (validation.errors.length > 0) {
      recommendations.push('Fix validation errors before embedding metadata');
    }

    // Warning-based recommendations
    if (validation.warnings.length > 3) {
      recommendations.push('Review validation warnings to improve metadata quality');
    }

    return recommendations;
  }

  /**
   * Validate input parameters
   */
  private validateInput(params: ValidateSchemaRequest): {
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

    if (params.strict_mode !== undefined && typeof params.strict_mode !== 'boolean') {
      errors.push('strict_mode must be a boolean');
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
      name: 'validate_metadata_schema',
      description: 'Validate metadata against ORBIT schemas without embedding (supports lifestyle, product, and orbit schemas)',
      inputSchema: {
        type: 'object',
        properties: {
          metadata: {
            type: 'object',
            description: 'Metadata object to validate against schema requirements'
          },
          schema_type: {
            type: 'string',
            enum: ['lifestyle', 'product', 'orbit'],
            description: 'Schema type for validation (auto-detected if not specified)'
          },
          strict_mode: {
            type: 'boolean',
            description: 'Enable strict validation mode (default: false)'
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
      return `❌ **Schema Validation Failed**\n\n**Error:** ${result.error}\n**Processing Time:** ${result.processing_time}ms`;
    }

    const validation = result.validation as ValidationResult;
    const statusIcon = validation.valid ? '✅' : '❌';
    const statusText = validation.valid ? 'Valid' : 'Invalid';

    let response = `${statusIcon} **Schema Validation Result:** ${statusText}\n\n`;
    
    response += `**Metadata Information:**\n`;
    response += `• Schema Type: ${validation.schema_type}\n`;
    response += `• Field Count: ${validation.field_count}\n`;
    response += `• Completeness Score: ${validation.completeness_score}%\n`;
    response += `• Processing Time: ${result.processing_time}ms\n\n`;

    // Schema requirements
    if (result.schema_requirements) {
      response += `**Schema Requirements:**\n`;
      response += `• Required Sections: ${result.schema_requirements.required_sections.join(', ') || 'None'}\n`;
      response += `• Recommended Sections: ${result.schema_requirements.recommended_sections.join(', ')}\n`;
      response += `• Description: ${result.schema_requirements.description}\n\n`;
    }

    // Validation errors
    if (validation.errors.length > 0) {
      response += `**Validation Errors (${validation.errors.length}):**\n`;
      validation.errors.forEach((error, index) => {
        response += `${index + 1}. ${error}\n`;
      });
      response += '\n';
    }

    // Validation warnings
    if (validation.warnings.length > 0) {
      response += `**Validation Warnings (${validation.warnings.length}):**\n`;
      validation.warnings.forEach((warning, index) => {
        response += `${index + 1}. ${warning}\n`;
      });
      response += '\n';
    }

    // Recommendations
    if (result.recommendations && result.recommendations.length > 0) {
      response += `**Recommendations:**\n`;
      result.recommendations.forEach((recommendation: string, index: number) => {
        response += `${index + 1}. ${recommendation}\n`;
      });
      response += '\n';
    }

    // Show sanitized metadata structure if valid
    if (validation.valid && result.sanitized_metadata) {
      response += `**Sanitized Metadata Structure:**\n`;
      response += this.formatMetadataStructure(result.sanitized_metadata);
    }

    return response;
  }

  /**
   * Format metadata structure for display
   */
  private formatMetadataStructure(metadata: any, indent: string = '', maxDepth: number = 3): string {
    if (maxDepth <= 0) return '';
    
    let structure = '';
    
    for (const [key, value] of Object.entries(metadata)) {
      if (value === null || value === undefined) continue;
      
      if (typeof value === 'object' && !Array.isArray(value)) {
        structure += `${indent}• **${key}:**\n`;
        structure += this.formatMetadataStructure(value, indent + '  ', maxDepth - 1);
      } else if (Array.isArray(value)) {
        structure += `${indent}• **${key}:** [${value.length} items]\n`;
      } else {
        const displayValue = String(value).length > 50 
          ? String(value).substring(0, 47) + '...' 
          : String(value);
        structure += `${indent}• **${key}:** ${displayValue}\n`;
      }
    }
    
    return structure;
  }

  /**
   * Validate multiple metadata objects (batch validation)
   */
  async validateBatch(metadataList: ValidateSchemaRequest[]): Promise<ProcessingResponse[]> {
    const results: ProcessingResponse[] = [];
    
    for (const params of metadataList) {
      const result = await this.execute(params);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Get validation summary for batch results
   */
  getBatchSummary(results: ProcessingResponse[]): {
    total: number;
    valid: number;
    invalid: number;
    average_completeness: number;
    common_errors: string[];
  } {
    const valid = results.filter(r => r.success && r.validation?.valid).length;
    const invalid = results.length - valid;
    
    const completenessScores = results
      .filter(r => r.validation?.completeness_score !== undefined)
      .map(r => r.validation.completeness_score);
    
    const averageCompleteness = completenessScores.length > 0 
      ? Math.round(completenessScores.reduce((a, b) => a + b, 0) / completenessScores.length)
      : 0;

    // Collect common errors
    const allErrors = results
      .filter(r => r.validation?.errors)
      .flatMap(r => r.validation.errors);
    
    const errorCounts = allErrors.reduce((acc, error) => {
      acc[error] = (acc[error] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const commonErrors = Object.entries(errorCounts)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([error]) => error);

    return {
      total: results.length,
      valid,
      invalid,
      average_completeness: averageCompleteness,
      common_errors: commonErrors
    };
  }
}