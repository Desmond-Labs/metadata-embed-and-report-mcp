/**
 * Simple Metadata Validator
 * Basic schema validation without security features
 */

import { MetadataSchema, SchemaType, ValidationResult } from '../types/schemas.js';

export class MetadataValidator {

  /**
   * Validate metadata against schema requirements
   */
  validateMetadata(
    metadata: MetadataSchema, 
    schemaType?: SchemaType,
    strictMode: boolean = false
  ): ValidationResult {
    const detectedSchemaType = schemaType || this.detectSchemaType(metadata);
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic structure validation
    if (!metadata || typeof metadata !== 'object') {
      errors.push('Metadata must be a valid object');
      return {
        valid: false,
        schema_type: detectedSchemaType,
        errors,
        warnings,
        completeness_score: 0,
        field_count: 0
      };
    }

    // Validate based on schema type
    switch (detectedSchemaType) {
      case 'lifestyle':
        this.validateLifestyleSchema(metadata, errors, warnings, strictMode);
        break;
      case 'product':
        this.validateProductSchema(metadata, errors, warnings, strictMode);
        break;
      case 'orbit':
        this.validateOrbitSchema(metadata, errors, warnings, strictMode);
        break;
      default:
        warnings.push('Unknown schema type, using basic validation');
    }

    // Calculate completeness and field count
    const { completeness_score, field_count } = this.calculateCompleteness(metadata, detectedSchemaType);

    return {
      valid: errors.length === 0,
      schema_type: detectedSchemaType,
      errors,
      warnings,
      completeness_score,
      field_count
    };
  }

  /**
   * Detect schema type from metadata structure
   */
  detectSchemaType(metadata: any): SchemaType {
    // Check for lifestyle-specific fields
    if (metadata.scene_overview || metadata.human_elements || metadata.marketing_potential) {
      if (metadata.product_identification || metadata.commercial_analysis) {
        return 'product';
      }
      return 'lifestyle';
    }

    // Check for product-specific fields
    if (metadata.product_identification || metadata.physical_characteristics || metadata.commercial_analysis) {
      return 'product';
    }

    // Default to orbit schema
    return 'orbit';
  }

  /**
   * Validate lifestyle schema
   */
  private validateLifestyleSchema(metadata: any, errors: string[], warnings: string[], strictMode: boolean): void {
    const requiredSections = ['scene_overview', 'human_elements'];
    const recommendedSections = ['environment', 'atmospheric_elements', 'marketing_potential'];

    // Check required sections
    requiredSections.forEach(section => {
      if (!metadata[section]) {
        if (strictMode) {
          errors.push(`Required section missing: ${section}`);
        } else {
          warnings.push(`Recommended section missing: ${section}`);
        }
      } else if (typeof metadata[section] !== 'object') {
        errors.push(`Section ${section} must be an object`);
      }
    });

    // Check recommended sections
    recommendedSections.forEach(section => {
      if (!metadata[section]) {
        warnings.push(`Recommended section missing: ${section}`);
      }
    });

    // Validate specific fields
    if (metadata.human_elements?.number_of_people !== undefined) {
      if (typeof metadata.human_elements.number_of_people !== 'number' || 
          metadata.human_elements.number_of_people < 0) {
        errors.push('number_of_people must be a non-negative number');
      }
    }

    // Validate array fields
    this.validateArrayField(metadata.human_elements?.demographics, 'demographics', errors, warnings);
    this.validateArrayField(metadata.atmospheric_elements?.color_palette, 'color_palette', errors, warnings);
  }

  /**
   * Validate product schema
   */
  private validateProductSchema(metadata: any, errors: string[], warnings: string[], strictMode: boolean): void {
    const requiredSections = ['product_identification', 'physical_characteristics'];
    const recommendedSections = ['commercial_analysis', 'quality_assessment'];

    // Check required sections
    requiredSections.forEach(section => {
      if (!metadata[section]) {
        if (strictMode) {
          errors.push(`Required section missing: ${section}`);
        } else {
          warnings.push(`Recommended section missing: ${section}`);
        }
      } else if (typeof metadata[section] !== 'object') {
        errors.push(`Section ${section} must be an object`);
      }
    });

    // Check recommended sections
    recommendedSections.forEach(section => {
      if (!metadata[section]) {
        warnings.push(`Recommended section missing: ${section}`);
      }
    });

    // Validate product type
    if (metadata.product_identification && !metadata.product_identification.product_type) {
      warnings.push('product_type is recommended for product identification');
    }

    // Validate color information
    if (metadata.physical_characteristics?.primary_color && 
        typeof metadata.physical_characteristics.primary_color !== 'string') {
      errors.push('primary_color must be a string');
    }
  }

  /**
   * Validate orbit schema
   */
  private validateOrbitSchema(metadata: any, errors: string[], warnings: string[], strictMode: boolean): void {
    const recommendedSections = [
      'scene_overview', 'human_elements', 'environment', 
      'key_objects', 'atmospheric_elements'
    ];

    // Check recommended sections
    recommendedSections.forEach(section => {
      if (!metadata[section]) {
        warnings.push(`Recommended section missing: ${section}`);
      } else if (typeof metadata[section] !== 'object') {
        warnings.push(`Section ${section} should be an object`);
      }
    });

    // Validate people count
    if (metadata.human_elements?.people_count !== undefined) {
      if (typeof metadata.human_elements.people_count !== 'number' || 
          metadata.human_elements.people_count < 0) {
        errors.push('people_count must be a non-negative number');
      }
    }
  }

  /**
   * Validate array field
   */
  private validateArrayField(field: any, fieldName: string, errors: string[], warnings: string[]): void {
    if (field !== undefined) {
      if (!Array.isArray(field)) {
        errors.push(`${fieldName} must be an array`);
      } else if (field.length === 0) {
        warnings.push(`${fieldName} is empty`);
      } else {
        // Check if all items are strings
        const nonStringItems = field.filter(item => typeof item !== 'string');
        if (nonStringItems.length > 0) {
          warnings.push(`${fieldName} contains non-string items`);
        }
      }
    }
  }

  /**
   * Calculate completeness score and field count
   */
  private calculateCompleteness(metadata: any, schemaType: SchemaType): {
    completeness_score: number;
    field_count: number;
  } {
    const fieldCount = this.countFields(metadata);
    
    // Expected field counts for each schema type
    const expectedCounts = {
      lifestyle: 35, // Approximate expected fields
      product: 25,   // Approximate expected fields
      orbit: 40      // Approximate expected fields
    };

    const expectedCount = expectedCounts[schemaType];
    const completeness_score = Math.min(100, Math.round((fieldCount / expectedCount) * 100));

    return {
      completeness_score,
      field_count: fieldCount
    };
  }

  /**
   * Recursively count all fields in metadata
   */
  private countFields(obj: any): number {
    if (!obj || typeof obj !== 'object') {
      return 0;
    }

    let count = 0;
    for (const value of Object.values(obj)) {
      if (value !== null && value !== undefined) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          count += this.countFields(value);
        } else {
          count += 1;
        }
      }
    }

    return count;
  }

  /**
   * Sanitize metadata by removing invalid fields
   */
  sanitizeMetadata(metadata: any): any {
    if (!metadata || typeof metadata !== 'object') {
      return {};
    }

    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      if (value !== null && value !== undefined) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          const sanitizedNested = this.sanitizeMetadata(value);
          if (Object.keys(sanitizedNested).length > 0) {
            sanitized[key] = sanitizedNested;
          }
        } else if (Array.isArray(value)) {
          const sanitizedArray = value.filter(item => 
            item !== null && item !== undefined && item !== ''
          );
          if (sanitizedArray.length > 0) {
            sanitized[key] = sanitizedArray;
          }
        } else if (typeof value === 'string' && value.trim() !== '') {
          sanitized[key] = value.trim();
        } else if (typeof value === 'number' && !isNaN(value)) {
          sanitized[key] = value;
        } else if (typeof value === 'boolean') {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }

  /**
   * Get schema requirements for documentation
   */
  getSchemaRequirements(schemaType: SchemaType): {
    required_sections: string[];
    recommended_sections: string[];
    optional_sections: string[];
    description: string;
  } {
    const requirements = {
      lifestyle: {
        required_sections: ['scene_overview', 'human_elements'],
        recommended_sections: ['environment', 'atmospheric_elements', 'marketing_potential'],
        optional_sections: ['key_objects', 'narrative_analysis', 'photographic_elements'],
        description: 'Schema for analyzing lifestyle images with social dynamics and cultural context'
      },
      product: {
        required_sections: ['product_identification', 'physical_characteristics'],
        recommended_sections: ['commercial_analysis', 'quality_assessment'],
        optional_sections: ['structural_elements', 'design_attributes'],
        description: 'Schema for product analysis including design and commercial aspects'
      },
      orbit: {
        required_sections: [],
        recommended_sections: ['scene_overview', 'human_elements', 'environment', 'key_objects'],
        optional_sections: ['atmospheric_elements', 'narrative_analysis', 'photographic_elements', 'marketing_potential'],
        description: 'Comprehensive schema for general visual intelligence analysis'
      }
    };

    return requirements[schemaType];
  }
}