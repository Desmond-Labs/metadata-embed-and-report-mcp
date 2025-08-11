/**
 * Create Metadata Report Tool
 * Generate human-readable text files with metadata in ExifTool-style format
 */

import { SupabaseImageClient } from '../core/supabase-client.js';
import { XMPProcessor } from '../core/xmp-processor.js';

export interface CreateMetadataReportRequest {
  image_path: string;
  output_path?: string;
  format: 'detailed' | 'simple' | 'json-only';
  include_processing_info?: boolean;
  include_raw_json?: boolean;
}

export interface MetadataReportResponse {
  success: boolean;
  message?: string;
  error?: string;
  report_path?: string;
  format_used: string;
  field_count?: number;
  report_size?: number;
  processing_time: number;
}

// Category definitions for each schema type
interface CategoryDefinition {
  name: string;
  emoji: string;
  fields: string[];
}

type SchemaCategoryMap = {
  [key in 'lifestyle' | 'product' | 'orbit']: CategoryDefinition[];
};

export class CreateMetadataReportTool {
  private supabaseClient: SupabaseImageClient;
  private xmpProcessor: XMPProcessor;
  private schemaCategoryMap: SchemaCategoryMap;

  constructor(supabaseClient: SupabaseImageClient) {
    this.supabaseClient = supabaseClient;
    this.xmpProcessor = new XMPProcessor();
    this.schemaCategoryMap = this.initializeCategoryMaps();
  }

  /**
   * Execute metadata report creation
   */
  async execute(params: CreateMetadataReportRequest): Promise<MetadataReportResponse> {
    const startTime = Date.now();
    
    try {
      // Validate input parameters
      const validationResult = this.validateInput(params);
      if (!validationResult.valid) {
        return {
          success: false,
          error: `Input validation failed: ${validationResult.errors.join(', ')}`,
          format_used: params.format,
          processing_time: Date.now() - startTime
        };
      }

      // Check if image exists
      const imageExists = await this.supabaseClient.imageExists(params.image_path);
      if (!imageExists) {
        return {
          success: false,
          error: `Image not found: ${params.image_path}`,
          format_used: params.format,
          processing_time: Date.now() - startTime
        };
      }

      // Download image to read metadata
      const imageBuffer = await this.supabaseClient.downloadImageToBuffer(params.image_path);
      
      // Extract XMP metadata from the image
      const xmpResult = this.xmpProcessor.extractXMPFromImage(imageBuffer);
      if (!xmpResult.xmp_found || !xmpResult.parsed_metadata) {
        return {
          success: false,
          error: 'No XMP metadata found in image. Image may not have been processed with ORBIT MCP.',
          format_used: params.format,
          processing_time: Date.now() - startTime
        };
      }

      const parsedMetadata = xmpResult.parsed_metadata;
      if (!parsedMetadata || Object.keys(parsedMetadata).length === 0) {
        return {
          success: false,
          error: 'Failed to parse XMP metadata from image',
          format_used: params.format,
          processing_time: Date.now() - startTime
        };
      }

      // Enhance parsed metadata with all embedded fields
      const enhancedMetadata = this.enhanceMetadataWithAllFields(parsedMetadata);

      // Determine schema type from metadata
      const schemaType = this.detectSchemaType(parsedMetadata);

      // Generate report content based on format
      const reportContent = this.generateReportContent(
        enhancedMetadata,
        params,
        schemaType,
        startTime
      );

      // Generate output path if not provided
      const outputPath = params.output_path || this.generateDefaultOutputPath(params.image_path, params.format);

      // Upload report as text file to Supabase Storage
      const reportBuffer = new TextEncoder().encode(reportContent);
      const uploadPath = await this.supabaseClient.uploadImageFromBuffer(
        outputPath,
        reportBuffer,
        'text/plain',
        true // upsert
      );

      const processingTime = Date.now() - startTime;

      // Get proper field count from organized metadata
      const { totalFields } = this.organizeMetadataByCategories(enhancedMetadata, schemaType);

      return {
        success: true,
        message: `Metadata report created successfully in ${params.format} format`,
        report_path: uploadPath,
        format_used: params.format,
        field_count: totalFields,
        report_size: reportBuffer.length,
        processing_time: processingTime
      };

    } catch (error) {
      return {
        success: false,
        error: `Report creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        format_used: params.format,
        processing_time: Date.now() - startTime
      };
    }
  }

  /**
   * Generate report content based on format
   */
  private generateReportContent(
    metadata: Record<string, any>,
    params: CreateMetadataReportRequest,
    schemaType: string,
    startTime: number
  ): string {
    const currentDate = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    switch (params.format) {
      case 'json-only':
        return JSON.stringify(metadata, null, 2);
        
      case 'simple':
        return this.generateSimpleFormat(metadata, params.image_path, schemaType, currentDate, startTime);
        
      case 'detailed':
      default:
        return this.generateDetailedFormat(metadata, params, schemaType, currentDate, startTime);
    }
  }

  /**
   * Generate detailed format report
   */
  private generateDetailedFormat(
    metadata: Record<string, any>,
    params: CreateMetadataReportRequest,
    schemaType: string,
    currentDate: string,
    startTime: number
  ): string {
    const processingTime = Date.now() - startTime;
    const { totalCategories, totalFields } = this.organizeMetadataByCategories(metadata, schemaType);
    const fieldCount = totalFields;
    
    let report = '';
    
    // Header section
    report += '=================================================================\n';
    report += 'ORBIT Metadata Report - Enhanced Simple MCP v2.1\n';
    report += '=================================================================\n';
    report += `Source Image    : ${params.image_path}\n`;
    report += `Report Date     : ${currentDate}\n\n`;

    // Analysis type header
    const schemaDisplayName = schemaType.toUpperCase();
    report += `🎯 TYPE OF ANALYSIS COMPLETED: ${schemaDisplayName}\n`;
    
    // Get field count validation info
    const validationInfo = this.validateFieldCoverage(metadata, schemaType);
    report += `Categories Found: ${totalCategories} | Total Fields: ${fieldCount} | Processing Time: ${processingTime}ms\n`;
    
    if (validationInfo.missingFields > 0) {
      report += `⚠️  Coverage: ${validationInfo.coveragePercentage}% (${validationInfo.missingFields} fields may be missing)\n`;
    } else {
      report += `✅ Coverage: 100% (All embedded fields captured)\n`;
    }
    
    report += '=================================================================\n';

    // Category-organized metadata fields
    report += this.formatMetadataFields(metadata, true, schemaType);
    report += '\n\n';

    // Raw JSON section (if enabled)
    if (params.include_raw_json !== false) {
      report += '=================================================================\n';
      report += 'RAW JSON DATA (Machine Readable)\n';
      report += '=================================================================\n';
      report += JSON.stringify(metadata, null, 2); // Pretty formatted JSON
      report += '\n';
    }

    // Footer
    report += '=================================================================\n';
    report += 'END OF METADATA REPORT\n';
    report += '=================================================================\n';

    return report;
  }

  /**
   * Generate simple format report
   */
  private generateSimpleFormat(
    metadata: Record<string, any>,
    imagePath: string,
    schemaType: string,
    currentDate: string,
    startTime: number
  ): string {
    const processingTime = Date.now() - startTime;
    const { totalCategories, totalFields } = this.organizeMetadataByCategories(metadata, schemaType);
    const fieldCount = totalFields;
    
    let report = '';
    
    // Simple header with analysis type
    report += 'ORBIT Metadata Report\n';
    report += '=====================\n';
    report += `Image: ${imagePath.split('/').pop()}\n`;
    report += `Analysis: ${schemaType.toUpperCase()} (${totalCategories} categories, ${fieldCount} fields)\n`;
    report += `Date: ${currentDate}\n\n`;

    // Key metadata fields organized by categories
    report += 'Key Metadata by Category:\n';
    report += '-------------------------\n';
    const keyFields = this.selectKeyFieldsByCategory(metadata, schemaType);
    report += this.formatMetadataFields(keyFields, true, schemaType);
    report += '\n\n';

    // Processing info
    report += 'Processing Summary:\n';
    report += '------------------\n';
    report += `Processing Time: ${processingTime}ms\n`;
    report += `Total Categories: ${totalCategories}\n`;
    report += `Total Fields: ${fieldCount}\n`;

    return report;
  }

  /**
   * Check if a field matches a pattern using multiple methods
   */
  private fieldMatchesPattern(key: string, fieldPattern: string, schemaType: string): boolean {
    const keyLower = key.toLowerCase();
    const patternLower = fieldPattern.toLowerCase();
    
    // Method 1: Exact pattern matching
    if (key === fieldPattern || keyLower === patternLower) {
      return true;
    }
    
    // Method 2: Direct pattern matching (for original field names)
    const keyWithoutSchema = key.replace(/^(lifestyle|product|orbit|dublin_core|iptc|xmp_core|photoshop|processing)_/, '');
    if (keyWithoutSchema === fieldPattern || keyWithoutSchema.includes(fieldPattern) || key.includes(fieldPattern)) {
      return true;
    }
    
    // Method 3: Handle category-based matching (scene_overview_setting vs setting)
    const categoryParts = fieldPattern.split('_');
    if (categoryParts.length > 1) {
      const lastPart = categoryParts[categoryParts.length - 1];
      if (keyWithoutSchema === lastPart || keyLower.includes(lastPart.toLowerCase())) {
        return true;
      }
    }
    
    // Method 4: Partial matching on beautified names
    const keyWords = keyLower.replace(/_/g, ' ').split(' ').filter(w => w.length > 2);
    const patternWords = patternLower.replace(/_/g, ' ').split(' ').filter(w => w.length > 2);
    
    // Check if pattern words are contained in key words
    const hasAllPatternWords = patternWords.length > 0 && patternWords.every(patternWord => 
      keyWords.some(keyWord => keyWord.includes(patternWord) || patternWord.includes(keyWord))
    );
    
    if (hasAllPatternWords) {
      return true;
    }
    
    // Method 5: Case-insensitive contains matching
    if (keyLower.includes(patternLower) || patternLower.includes(keyLower)) {
      return true;
    }
    
    return false;
  }

  /**
   * Organize metadata by categories
   */
  private organizeMetadataByCategories(metadata: Record<string, any>, schemaType: string): {
    categories: { category: CategoryDefinition; fields: Record<string, any> }[];
    totalCategories: number;
    totalFields: number;
  } {
    const categories = this.schemaCategoryMap[schemaType as keyof SchemaCategoryMap] || [];
    const organizedCategories: { category: CategoryDefinition; fields: Record<string, any> }[] = [];
    let totalFields = 0;

    // Get the actual schema data (handle nested structure)
    let schemaData: Record<string, any> = {};
    if (metadata[schemaType] && typeof metadata[schemaType] === 'object') {
      // Nested structure: { lifestyle: { lifestyle_field: value } }
      schemaData = metadata[schemaType];
    } else {
      // Flat structure: { lifestyle_field: value }
      schemaData = metadata;
    }

    // Track assigned fields to prevent duplication
    const assignedFields = new Set<string>();

    for (const category of categories) {
      const categoryFields: Record<string, any> = {};
      
      // Find all metadata fields that belong to this category
      for (const fieldPattern of category.fields) {
        // Look for fields that match the pattern - handle both original and beautified names
        const matchingKeys = Object.keys(schemaData).filter(key => {
          // Skip Raw_JSON and other special fields
          if (key === 'Raw_JSON') return false;
          
          // Skip already assigned fields (exclusive assignment)
          if (assignedFields.has(key)) return false;
          
          return this.fieldMatchesPattern(key, fieldPattern, schemaType);
        });
        
        matchingKeys.forEach(key => {
          categoryFields[key] = schemaData[key];
          assignedFields.add(key); // Mark field as assigned
          totalFields++;
        });
      }
      
      // Only include categories that have fields
      if (Object.keys(categoryFields).length > 0) {
        organizedCategories.push({ category, fields: categoryFields });
      }
    }

    // Add catch-all category for any unmatched fields
    const unmatchedFields: Record<string, any> = {};
    Object.keys(schemaData).forEach(key => {
      if (!assignedFields.has(key) && key !== 'Raw_JSON') {
        unmatchedFields[key] = schemaData[key];
        totalFields++;
      }
    });

    // Add unmatched fields category if there are any
    if (Object.keys(unmatchedFields).length > 0) {
      organizedCategories.push({
        category: {
          name: 'Additional Metadata',
          emoji: '📝',
          fields: []
        },
        fields: unmatchedFields
      });
    }

    return {
      categories: organizedCategories,
      totalCategories: organizedCategories.length,
      totalFields
    };
  }

  /**
   * Format metadata fields with alignment (enhanced for categories)
   */
  private formatMetadataFields(metadata: Record<string, any>, useCategories = false, schemaType = 'unknown'): string {
    if (!useCategories) {
      // Legacy flat formatting
      return this.formatMetadataFieldsFlat(metadata);
    }

    // Category-based formatting
    const { categories } = this.organizeMetadataByCategories(metadata, schemaType);
    const formattedSections: string[] = [];

    for (const { category, fields } of categories) {
      if (Object.keys(fields).length === 0) continue;

      // Category header
      formattedSections.push(`\n${category.emoji} ${category.name.toUpperCase()}`);
      formattedSections.push('-'.repeat(65));
      
      // Format fields in this category with clean alignment
      const fieldNames = Object.keys(fields).map(key => this.beautifyFieldName(key));
      const maxLength = Math.max(...fieldNames.map(name => name.length));
      const paddingWidth = Math.max(maxLength + 1, 25); // Reasonable max padding
      
      for (const [key, value] of Object.entries(fields)) {
        const beautifiedName = this.beautifyFieldName(key);
        const formattedValue = this.formatFieldValue(value);
        // Clean spacing format: "Field Name : Value"
        const padding = ' '.repeat(Math.max(1, paddingWidth - beautifiedName.length));
        formattedSections.push(`${beautifiedName}${padding}: ${formattedValue}`);
      }
    }

    return formattedSections.join('\n');
  }

  /**
   * Format metadata fields with alignment (flat/legacy)
   */
  private formatMetadataFieldsFlat(metadata: Record<string, any>): string {
    const fieldNames = Object.keys(metadata).map(key => this.beautifyFieldName(key));
    const maxLength = Math.max(...fieldNames.map(name => name.length));
    const paddingWidth = Math.max(maxLength + 1, 25); // Reasonable max padding
    const formattedFields: string[] = [];
    
    for (const [key, value] of Object.entries(metadata)) {
      const beautifiedName = this.beautifyFieldName(key);
      const formattedValue = this.formatFieldValue(value);
      // Clean spacing format: "Field Name : Value"
      const padding = ' '.repeat(Math.max(1, paddingWidth - beautifiedName.length));
      formattedFields.push(`${beautifiedName}${padding}: ${formattedValue}`);
    }
    
    return formattedFields.join('\n');
  }

  /**
   * Beautify field names (same logic as XMP processor)
   */
  private beautifyFieldName(key: string): string {
    // Remove schema prefixes (product_, lifestyle_, orbit_)
    let cleanKey = key;
    
    // Remove leading schema type
    cleanKey = cleanKey.replace(/^(product|lifestyle|orbit)_/, '');
    
    // Remove common section prefixes but preserve meaningful context
    const sectionPrefixes = [
      'scene_overview_',
      'human_elements_',
      'environment_',
      'key_objects_',
      'atmospheric_elements_',
      'narrative_analysis_',
      'photographic_elements_',
      'marketing_potential_',
      'product_identification_',
      'physical_characteristics_',
      'structural_elements_',
      'design_attributes_',
      'commercial_analysis_',
      'quality_assessment_'
    ];
    
    // Remove section prefixes
    for (const prefix of sectionPrefixes) {
      if (cleanKey.startsWith(prefix)) {
        cleanKey = cleanKey.substring(prefix.length);
        break;
      }
    }
    
    // Special handling for compound field names that should be preserved
    const specialCases: Record<string, string> = {
      'food_beverage': 'food_and_beverage',
      'and_beverage': 'food_and_beverage', // Fix for the specific case
      'beverage': 'food_and_beverage' // Also handle this case
    };
    
    // Check if this is a special case that needs fixing
    if (specialCases[cleanKey]) {
      cleanKey = specialCases[cleanKey];
    }
    
    // For remaining compound terms, preserve meaningful context
    // Split on underscore and keep important descriptive words
    const parts = cleanKey.split('_');
    
    // If it's a single word or already short, use as-is
    if (parts.length <= 1) {
      return this.toTitleCase(cleanKey);
    }
    
    // For compound terms, intelligently preserve context
    let processedName = '';
    
    // Special cases for common 3+ part compound terms that should be kept whole
    const wholeTermPatterns = [
      'time_of_day',
      'number_of_people',
      'age_group',
      'construction_quality',
      'material_quality',
      'finish_quality'
    ];
    
    // Check if this is a special compound term that should be kept whole
    const isWholeCompoundTerm = wholeTermPatterns.some(pattern => 
      cleanKey.endsWith(pattern) || cleanKey === pattern
    );
    
    if (isWholeCompoundTerm) {
      // Keep the entire term for special compound cases
      processedName = cleanKey;
    } else if (parts.length === 2) {
      // For two parts, usually both are important (e.g., "primary_color", "emotional_hooks")
      processedName = parts.join('_');
    } else if (parts.length >= 3) {
      // For 3+ part terms, intelligently preserve meaningful context
      // Instead of just taking last 2 parts, look for descriptive adjectives + nouns
      
      // Common descriptive patterns that should be preserved together
      const meaningfulPatterns = [
        ['emotional', 'hooks'],
        ['social', 'dynamics'], 
        ['primary', 'color'],
        ['target', 'market'],
        ['product', 'type'],
        ['design', 'style'],
        ['visual', 'style'],
        ['market', 'positioning'],
        ['brand', 'alignment'],
        ['lifestyle', 'values'],
        ['cultural', 'significance'],
        ['technical', 'qualities'],
        ['focal', 'points']
      ];
      
      // Check if the last two parts form a meaningful pattern
      const lastTwo = parts.slice(-2);
      const isMatchingPattern = meaningfulPatterns.some(pattern => 
        pattern[0] === lastTwo[0] && pattern[1] === lastTwo[1]
      );
      
      if (isMatchingPattern || parts.length === 3) {
        // For 3-part terms or matching patterns, use last 2 parts
        processedName = parts.slice(-2).join('_');
      } else {
        // For 4+ part terms without matching patterns, still use last 2 parts
        // This covers cases like "marketing_potential_emotional_hooks" -> "emotional_hooks"
        processedName = parts.slice(-2).join('_');
      }
    }
    
    // Convert snake_case to Title Case
    return this.toTitleCase(processedName);
  }
  
  /**
   * Convert snake_case string to Title Case
   */
  private toTitleCase(str: string): string {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Select key fields for simple format based on schema categories
   */
  private selectKeyFieldsByCategory(metadata: Record<string, any>, schemaType: string): Record<string, any> {
    const { categories } = this.organizeMetadataByCategories(metadata, schemaType);
    const keyFields: Record<string, any> = {};
    
    // Select top 2 fields from each category for simple format
    for (const { fields } of categories) {
      const fieldEntries = Object.entries(fields);
      const topFields = fieldEntries.slice(0, 2); // Top 2 fields per category
      
      topFields.forEach(([key, value]) => {
        keyFields[key] = value;
      });
    }
    
    return keyFields;
  }

  /**
   * Select key fields for simple format based on schema (legacy support)
   */
  private selectKeyFields(metadata: Record<string, any>, schemaType: string): Record<string, any> {
    return this.selectKeyFieldsByCategory(metadata, schemaType);
  }

  /**
   * Initialize category mappings for all schema types
   */
  private initializeCategoryMaps(): SchemaCategoryMap {
    // Standard namespace categories (apply to all schema types)
    const standardCategories: CategoryDefinition[] = [
      {
        name: 'Image Metadata',
        emoji: '📋',
        fields: ['dublin_core_title', 'dublin_core_description', 'dublin_core_subject', 'dublin_core_creator', 'dublin_core_rights', 'dublin_core_format', 'dublin_core_identifier']
      },
      {
        name: 'Technical Metadata', 
        emoji: '📷',
        fields: ['xmp_core_creator_tool', 'xmp_core_create_date', 'xmp_core_metadata_date', 'xmp_core_toolkit', 'photoshop_color_mode', 'iptc_source', 'iptc_instructions', 'iptc_person_in_image']
      },
      {
        name: 'Processing Metadata',
        emoji: '⚙️', 
        fields: ['processing_processed_timestamp', 'processing_processor_version', 'processing_schema_type', 'processing_processor_location']
      }
    ];

    return {
      lifestyle: [
        ...standardCategories,
        {
          name: 'Scene Overview',
          emoji: '📊',
          fields: ['scene_overview_setting', 'setting', 'scene_overview_time_of_day', 'time_of_day', 'scene_overview_season', 'season', 'scene_overview_occasion', 'occasion', 'scene_overview_primary_activity', 'primary_activity']
        },
        {
          name: 'Human Elements',
          emoji: '👥',
          fields: ['human_elements_number_of_people', 'number_of_people', 'human_elements_social_dynamics', 'social_dynamics', 'human_elements_demographics', 'demographics', 'human_elements_interactions', 'interactions', 'human_elements_emotional_states', 'emotional_states', 'human_elements_clothing_style', 'clothing_style']
        },
        {
          name: 'Environment',
          emoji: '🌍',
          fields: ['environment_location_type', 'location_type', 'environment_architectural_elements', 'architectural_elements', 'environment_natural_elements', 'natural_elements', 'environment_urban_context', 'urban_context', 'environment_spatial_arrangement', 'spatial_arrangement']
        },
        {
          name: 'Key Objects',
          emoji: '🏺',
          fields: ['key_objects_food_beverage', 'food_and_beverage', 'key_objects_furniture', 'furniture', 'key_objects_technology', 'technology', 'key_objects_decorative_items', 'decorative_items', 'key_objects_defining_props', 'defining_props', 'key_objects_personal_items', 'personal_items']
        },
        {
          name: 'Atmospheric Elements',
          emoji: '🌅',
          fields: ['atmospheric_elements_lighting_quality', 'lighting_quality', 'atmospheric_elements_color_palette', 'color_palette', 'atmospheric_elements_primary_colors', 'primary_colors', 'atmospheric_elements_mood', 'mood', 'atmospheric_elements_mood_indicators', 'mood_indicators', 'atmospheric_elements_sensory_cues', 'sensory_cues', 'atmospheric_elements_weather_conditions', 'weather_conditions']
        },
        {
          name: 'Narrative Analysis',
          emoji: '📖',
          fields: ['narrative_analysis_story', 'narrative_analysis_story_elements', 'story_implied', 'Story_Implied', 'narrative_analysis_cultural_significance', 'cultural_significance', 'narrative_analysis_cultural_context', 'cultural_context', 'historical_context', 'Historical_Context', 'narrative_analysis_socioeconomic_indicators', 'socioeconomic_indicators', 'narrative_analysis_values_represented', 'values_represented', 'narrative_analysis_lifestyle_category', 'lifestyle_values']
        },
        {
          name: 'Photographic Elements',
          emoji: '📷',
          fields: ['photographic_elements_composition', 'composition', 'photographic_elements_perspective', 'perspective', 'photographic_elements_focal_points', 'focal_points', 'photographic_elements_depth_of_field', 'depth_of_field', 'photographic_elements_visual_style', 'visual_style', 'photographic_elements_technical_qualities', 'technical_qualities']
        },
        {
          name: 'Marketing Potential',
          emoji: '🎯',
          fields: ['marketing_potential_target_demographic', 'target_demographic', 'marketing_potential_aspirational_elements', 'aspirational_elements', 'marketing_potential_brand_alignment_opportunities', 'brand_alignment_opportunities', 'marketing_potential_emotional_hooks', 'emotional_hooks', 'marketing_potential_market_appeal', 'alignment_opportunities']
        }
      ],
      product: [
        ...standardCategories,
        {
          name: 'Product Identification',
          emoji: '🏷️',
          fields: ['product_identification_product_type', 'product_type', 'product_identification_product_category', 'product_category', 'product_identification_design_style', 'design_style', 'product_identification_brand', 'brand', 'product_identification_model', 'model']
        },
        {
          name: 'Physical Characteristics',
          emoji: '🔍',
          fields: ['physical_characteristics_primary_color', 'primary_color', 'physical_characteristics_secondary_colors', 'secondary_colors', 'physical_characteristics_material', 'material', 'physical_characteristics_pattern_type', 'pattern_type', 'physical_characteristics_surface_texture', 'surface_texture', 'physical_characteristics_finish', 'finish', 'physical_characteristics_dimensions', 'dimensions', 'physical_characteristics_weight', 'weight']
        },
        {
          name: 'Structural Elements',
          emoji: '🏗️',
          fields: ['structural_elements_frame_type', 'frame_type', 'structural_elements_frame_design', 'frame_design', 'structural_elements_leg_structure', 'leg_structure', 'structural_elements_support_systems', 'support_systems', 'structural_elements_construction_details', 'construction_details']
        },
        {
          name: 'Design Attributes',
          emoji: '🎨',
          fields: ['design_attributes_aesthetic_category', 'aesthetic_category', 'design_attributes_design_era', 'design_era', 'design_attributes_visual_weight', 'visual_weight', 'design_attributes_design_influence', 'design_influence', 'design_attributes_style_elements', 'style_elements', 'design_attributes_intended_setting', 'intended_setting']
        },
        {
          name: 'Commercial Analysis',
          emoji: '💼',
          fields: ['commercial_analysis_market_positioning', 'market_positioning', 'commercial_analysis_target_market', 'target_market', 'commercial_analysis_price_point_indication', 'price_point', 'commercial_analysis_competitive_advantages', 'competitive_advantages', 'commercial_analysis_market_differentiation', 'market_differentiation', 'commercial_analysis_retail_category', 'retail_category']
        },
        {
          name: 'Quality Assessment',
          emoji: '⭐',
          fields: ['quality_assessment_construction_quality', 'construction_quality', 'quality_assessment_material_quality', 'material_quality', 'quality_assessment_finish_quality', 'finish_quality', 'quality_assessment_craftsmanship_level', 'craftsmanship_level', 'quality_assessment_durability_indicators', 'durability_indicators', 'quality_assessment_value_proposition', 'value_proposition']
        }
      ],
      orbit: [
        ...standardCategories,
        {
          name: 'Scene Overview',
          emoji: '📊',
          fields: ['scene_overview_setting', 'scene_overview_time_of_day', 'scene_overview_activities', 'scene_overview_overall_mood', 'scene_overview_scene_complexity']
        },
        {
          name: 'Human Elements',
          emoji: '👥',
          fields: ['human_elements_people_count', 'human_elements_age_groups', 'human_elements_gender_distribution', 'human_elements_ethnicity_diversity', 'human_elements_interactions', 'human_elements_emotions']
        },
        {
          name: 'Environment',
          emoji: '🌍',
          fields: ['environment_location_type', 'environment_architecture_style', 'environment_natural_elements', 'environment_weather_conditions', 'environment_lighting_conditions']
        },
        {
          name: 'Key Objects',
          emoji: '🏺',
          fields: ['key_objects_products', 'key_objects_technology', 'key_objects_furniture', 'key_objects_vehicles', 'key_objects_notable_items']
        },
        {
          name: 'Atmospheric Elements',
          emoji: '🌅',
          fields: ['atmospheric_elements_color_scheme', 'atmospheric_elements_lighting_quality', 'atmospheric_elements_visual_mood', 'atmospheric_elements_energy_level', 'atmospheric_elements_aesthetic_style']
        },
        {
          name: 'Narrative Analysis',
          emoji: '📖',
          fields: ['narrative_analysis_story_elements', 'narrative_analysis_cultural_context', 'narrative_analysis_social_dynamics', 'narrative_analysis_values_expressed', 'narrative_analysis_lifestyle_indicators']
        },
        {
          name: 'Photographic Elements',
          emoji: '📷',
          fields: ['photographic_elements_composition_style', 'photographic_elements_camera_angle', 'photographic_elements_depth_of_field', 'photographic_elements_focus_points', 'photographic_elements_technical_quality']
        },
        {
          name: 'Marketing Potential',
          emoji: '🎯',
          fields: ['marketing_potential_demographics', 'marketing_potential_psychographics', 'marketing_potential_brand_categories', 'marketing_potential_emotional_appeal', 'marketing_potential_commercial_viability']
        }
      ]
    };
  }

  /**
   * Get key field patterns for each schema type (legacy support)
   */
  private getKeyFieldPatterns(schemaType: string): string[] {
    const categories = this.schemaCategoryMap[schemaType as keyof SchemaCategoryMap];
    if (!categories) return [];
    
    // Return top fields from each category for simple format
    const keyPatterns: string[] = [];
    categories.forEach(category => {
      keyPatterns.push(...category.fields.slice(0, 2)); // Top 2 fields per category
    });
    
    return keyPatterns.map(field => field.split('_').pop() || field);
  }

  /**
   * Detect schema type from metadata keys with improved detection
   */
  private detectSchemaType(metadata: Record<string, any>): string {
    console.log('🎯 DEBUG: Detecting schema type from metadata keys:', Object.keys(metadata).slice(0, 10));
    
    // Check for top-level schema keys first (nested structure)
    if (metadata.lifestyle && typeof metadata.lifestyle === 'object') {
      console.log('✅ Schema detected: lifestyle (nested object)');
      return 'lifestyle';
    }
    if (metadata.product && typeof metadata.product === 'object') {
      console.log('✅ Schema detected: product (nested object)');
      return 'product';
    }
    if (metadata.orbit && typeof metadata.orbit === 'object') {
      console.log('✅ Schema detected: orbit (nested object)');
      return 'orbit';
    }
    
    // Check Raw_JSON for schema type
    const rawJson = this.extractRawJSONFromMetadata(metadata);
    if (rawJson && rawJson.processing && rawJson.processing.schema_type) {
      const schemaFromProcessing = rawJson.processing.schema_type;
      console.log(`✅ Schema detected from processing info: ${schemaFromProcessing}`);
      return schemaFromProcessing;
    }
    
    // Check for schema-specific field patterns
    const keys = Object.keys(metadata);
    const keyString = keys.join(' ').toLowerCase();
    
    // Lifestyle-specific patterns
    const lifestylePatterns = [
      'lifestyle_', 'emotional_hooks', 'target_demographic', 'social_dynamics',
      'marketing_potential', 'aspirational_elements', 'brand_alignment',
      'cultural_significance', 'lifestyle_values', 'socioeconomic_indicators'
    ];
    
    // Product-specific patterns  
    const productPatterns = [
      'product_', 'commercial_analysis', 'target_market', 'price_point',
      'design_style', 'material_quality', 'construction_quality',
      'market_positioning', 'product_type', 'physical_characteristics'
    ];
    
    // Orbit-specific patterns
    const orbitPatterns = [
      'orbit_', 'scene_complexity', 'energy_level', 'aesthetic_style',
      'visual_mood', 'commercial_viability', 'photographic_elements'
    ];
    
    // Count pattern matches
    const lifestyleMatches = lifestylePatterns.filter(pattern => keyString.includes(pattern)).length;
    const productMatches = productPatterns.filter(pattern => keyString.includes(pattern)).length;
    const orbitMatches = orbitPatterns.filter(pattern => keyString.includes(pattern)).length;
    
    console.log(`🎯 DEBUG: Pattern matches - lifestyle: ${lifestyleMatches}, product: ${productMatches}, orbit: ${orbitMatches}`);
    
    if (lifestyleMatches > productMatches && lifestyleMatches > orbitMatches) {
      console.log('✅ Schema detected: lifestyle (pattern matching)');
      return 'lifestyle';
    }
    if (productMatches > lifestyleMatches && productMatches > orbitMatches) {
      console.log('✅ Schema detected: product (pattern matching)');
      return 'product';
    }
    if (orbitMatches > lifestyleMatches && orbitMatches > productMatches) {
      console.log('✅ Schema detected: orbit (pattern matching)');
      return 'orbit';
    }
    
    // Fallback: check for any schema prefix
    if (keyString.includes('lifestyle_')) return 'lifestyle';
    if (keyString.includes('product_')) return 'product';
    if (keyString.includes('orbit_')) return 'orbit';
    
    console.log('⚠️ Schema detection failed, defaulting to lifestyle');
    return 'lifestyle'; // Default to lifestyle instead of unknown
  }

  /**
   * Generate default output path
   */
  private generateDefaultOutputPath(imagePath: string, format: string): string {
    const pathParts = imagePath.split('/');
    const filename = pathParts.pop() || 'metadata';
    const directory = pathParts.join('/');
    
    // Remove extension and add metadata suffix
    const baseName = filename.replace(/\.[^/.]+$/, '');
    const suffix = format === 'json-only' ? '.json' : '.txt';
    
    return directory ? `${directory}/${baseName}_metadata${suffix}` : `${baseName}_metadata${suffix}`;
  }

  /**
   * Enhance metadata with all embedded fields including standard namespaces
   * Now includes deduplication to prevent duplicate field display
   */
  private enhanceMetadataWithAllFields(parsedMetadata: Record<string, any>): Record<string, any> {
    console.log('🎯 DEBUG: Input parsed metadata keys:', Object.keys(parsedMetadata));
    const enhanced: Record<string, any> = {};
    const seenFields = new Set<string>();

    // Extract standard namespace fields from raw XMP if available
    const rawJson = this.extractRawJSONFromMetadata(parsedMetadata);
    console.log('🎯 DEBUG: Raw JSON extraction result:', rawJson ? Object.keys(rawJson) : 'null');
    
    if (rawJson) {
      // ONLY use original nested metadata - this prevents field duplication
      if (rawJson.original_metadata) {
        console.log('✅ Using ONLY original metadata to prevent duplication, structure:', Object.keys(rawJson.original_metadata));
        const flattenedOriginal = this.flattenNestedMetadata(rawJson.original_metadata);
        
        Object.entries(flattenedOriginal).forEach(([key, value]) => {
          const normalizedKey = this.normalizeFieldKey(key);
          if (!seenFields.has(normalizedKey)) {
            enhanced[key] = this.formatFieldValue(value);
            seenFields.add(normalizedKey);
          }
        });
      }
      
      // If no original metadata, fall back to flattened fields
      else if (rawJson.flattened_fields) {
        console.log('⚠️ No original metadata found, using flattened fields as fallback, count:', Object.keys(rawJson.flattened_fields).length);
        Object.entries(rawJson.flattened_fields).forEach(([key, value]) => {
          const normalizedKey = this.normalizeFieldKey(key);
          if (!seenFields.has(normalizedKey)) {
            enhanced[key] = this.formatFieldValue(value);
            seenFields.add(normalizedKey);
          }
        });
      }

      // Priority 3: Add standard namespace fields (deduplicated)
      if (rawJson.standard_metadata) {
        console.log('✅ Adding standard metadata sections:', Object.keys(rawJson.standard_metadata));
        
        // Add Dublin Core fields
        if (rawJson.standard_metadata.dublin_core) {
          Object.entries(rawJson.standard_metadata.dublin_core).forEach(([key, value]) => {
            const prefixedKey = `dublin_core_${key}`;
            const normalizedKey = this.normalizeFieldKey(prefixedKey);
            if (!seenFields.has(normalizedKey)) {
              enhanced[prefixedKey] = this.formatFieldValue(value);
              seenFields.add(normalizedKey);
            }
          });
        }

        // Add IPTC fields  
        if (rawJson.standard_metadata.iptc) {
          Object.entries(rawJson.standard_metadata.iptc).forEach(([key, value]) => {
            const prefixedKey = `iptc_${key}`;
            const normalizedKey = this.normalizeFieldKey(prefixedKey);
            if (!seenFields.has(normalizedKey)) {
              enhanced[prefixedKey] = this.formatFieldValue(value);
              seenFields.add(normalizedKey);
            }
          });
        }

        // Add XMP Core fields
        if (rawJson.standard_metadata.xmp_core) {
          Object.entries(rawJson.standard_metadata.xmp_core).forEach(([key, value]) => {
            const prefixedKey = `xmp_core_${key}`;
            const normalizedKey = this.normalizeFieldKey(prefixedKey);
            if (!seenFields.has(normalizedKey)) {
              enhanced[prefixedKey] = this.formatFieldValue(value);
              seenFields.add(normalizedKey);
            }
          });
        }

        // Add Photoshop fields
        if (rawJson.standard_metadata.photoshop) {
          Object.entries(rawJson.standard_metadata.photoshop).forEach(([key, value]) => {
            const prefixedKey = `photoshop_${key}`;
            const normalizedKey = this.normalizeFieldKey(prefixedKey);
            if (!seenFields.has(normalizedKey)) {
              enhanced[prefixedKey] = this.formatFieldValue(value);
              seenFields.add(normalizedKey);
            }
          });
        }
      }

      // Priority 4: Add processing info (always unique)
      if (rawJson.processing) {
        console.log('✅ Adding processing metadata fields:', Object.keys(rawJson.processing).length);
        Object.entries(rawJson.processing).forEach(([key, value]) => {
          enhanced[`processing_${key}`] = this.formatFieldValue(value);
        });
      }
    }

    // Add any remaining parsed metadata fields that weren't in Raw_JSON
    Object.entries(parsedMetadata).forEach(([key, value]) => {
      if (key !== 'Raw_JSON') {
        const normalizedKey = this.normalizeFieldKey(key);
        if (!seenFields.has(normalizedKey)) {
          enhanced[key] = this.formatFieldValue(value);
          seenFields.add(normalizedKey);
        }
      }
    });

    console.log('🎯 DEBUG: Final enhanced metadata field count (deduplicated):', Object.keys(enhanced).length);
    return enhanced;
  }

  /**
   * Normalize field key for deduplication comparison
   */
  private normalizeFieldKey(key: string): string {
    return key.toLowerCase()
      .replace(/^(lifestyle|product|orbit)_/, '')
      .replace(/[^a-z0-9]/g, '');
  }

  /**
   * Format field value for consistent display
   */
  private formatFieldValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        // Join arrays with commas, filter out empty values
        return value.filter(v => v !== null && v !== undefined && v !== '').join(', ');
      } else {
        // Convert objects to readable string - show actual values instead of field count
        try {
          const entries = Object.entries(value);
          if (entries.length === 0) return '';
          
          // For all objects, create readable format showing actual values
          return entries
            .filter(([k, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) => {
              // If value is array, join it
              if (Array.isArray(v)) {
                return v.filter(item => item !== null && item !== undefined && item !== '').join(', ');
              }
              return String(v);
            })
            .join(', ');
        } catch {
          return '[Complex Object]';
        }
      }
    }
    
    return String(value);
  }

  /**
   * Flatten nested metadata structure while preserving category prefixes
   */
  private flattenNestedMetadata(nestedData: any, prefix = ''): Record<string, any> {
    const flattened: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(nestedData)) {
      const fullKey = prefix ? `${prefix}_${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively flatten nested objects
        Object.assign(flattened, this.flattenNestedMetadata(value, fullKey));
      } else {
        // Store primitive values and arrays
        flattened[fullKey] = value;
      }
    }
    
    return flattened;
  }

  /**
   * Extract raw JSON data from metadata structure
   */
  private extractRawJSONFromMetadata(metadata: Record<string, any>): any {
    console.log('🎯 DEBUG: Looking for Raw_JSON in metadata with keys:', Object.keys(metadata));
    
    // Look for Raw_JSON field in various locations
    const rawJsonSources = [
      { source: 'root', value: metadata.Raw_JSON },
      { source: 'lifestyle', value: metadata.lifestyle?.Raw_JSON },
      { source: 'product', value: metadata.product?.Raw_JSON },
      { source: 'orbit', value: metadata.orbit?.Raw_JSON }
    ];

    for (const { source, value: rawJsonString } of rawJsonSources) {
      if (rawJsonString && typeof rawJsonString === 'string') {
        console.log(`🎯 DEBUG: Found Raw_JSON in ${source}, length:`, rawJsonString.length);
        console.log(`🎯 DEBUG: Raw_JSON preview:`, rawJsonString.substring(0, 100) + '...');
        
        try {
          // Fix the JSON format - replace . separators with commas if needed
          let cleanedJsonString = rawJsonString;
          if (rawJsonString.includes('.\n  "') || rawJsonString.includes('. "')) {
            console.log('🔧 Cleaning JSON format (replacing . separators)');
            cleanedJsonString = rawJsonString.replace(/\.\s*\n\s*"/g, ',\n  "').replace(/\.\s+"/g, ', "');
          }
          
          const parsed = JSON.parse(cleanedJsonString);
          console.log(`✅ Successfully parsed Raw_JSON from ${source} with keys:`, Object.keys(parsed));
          return parsed;
        } catch (error) {
          console.warn(`❌ Failed to parse Raw_JSON from ${source}:`, error);
          console.warn('🎯 DEBUG: Problematic JSON preview:', rawJsonString.substring(0, 200));
        }
      } else {
        console.log(`🎯 DEBUG: No Raw_JSON found in ${source}`);
      }
    }

    console.warn('❌ No valid Raw_JSON found in any location');
    return null;
  }

  /**
   * Validate field coverage to ensure all embedded fields are captured
   */
  private validateFieldCoverage(metadata: Record<string, any>, schemaType: string): {
    totalEmbeddedFields: number;
    capturedFields: number;
    missingFields: number;
    coveragePercentage: number;
  } {
    // Get all fields that should be in the metadata
    const rawJson = this.extractRawJSONFromMetadata(metadata);
    let totalEmbeddedFields = 0;
    
    if (rawJson) {
      // Count original metadata fields
      if (rawJson.original_metadata) {
        totalEmbeddedFields += this.countNestedFields(rawJson.original_metadata);
      }
      
      // Count standard metadata fields
      if (rawJson.standard_metadata) {
        totalEmbeddedFields += this.countNestedFields(rawJson.standard_metadata);
      }
      
      // Count processing fields
      if (rawJson.processing) {
        totalEmbeddedFields += Object.keys(rawJson.processing).length;
      }
    }
    
    // Count captured fields (excluding Raw_JSON)
    const capturedFields = Object.keys(metadata).filter(key => key !== 'Raw_JSON').length;
    
    // If we couldn't get embedded field count, estimate based on captured fields
    if (totalEmbeddedFields === 0) {
      totalEmbeddedFields = capturedFields;
    }
    
    const missingFields = Math.max(0, totalEmbeddedFields - capturedFields);
    const coveragePercentage = totalEmbeddedFields > 0 ? 
      Math.round((capturedFields / totalEmbeddedFields) * 100) : 100;
    
    return {
      totalEmbeddedFields,
      capturedFields,
      missingFields,
      coveragePercentage
    };
  }

  /**
   * Count nested fields in an object recursively
   */
  private countNestedFields(obj: any, depth = 0): number {
    if (!obj || typeof obj !== 'object' || depth > 3) {
      return 0;
    }
    
    let count = 0;
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Count nested object fields
        count += this.countNestedFields(value, depth + 1);
      } else {
        // Count primitive fields
        count += 1;
      }
    }
    
    return count;
  }

  /**
   * Validate input parameters
   */
  private validateInput(params: CreateMetadataReportRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Required parameters
    if (!params.image_path || typeof params.image_path !== 'string') {
      errors.push('image_path is required and must be a string');
    }

    if (!params.format || !['detailed', 'simple', 'json-only'].includes(params.format)) {
      errors.push('format must be one of: detailed, simple, json-only');
    }

    // Optional parameters validation
    if (params.output_path && typeof params.output_path !== 'string') {
      errors.push('output_path must be a string if provided');
    }

    if (params.include_processing_info !== undefined && typeof params.include_processing_info !== 'boolean') {
      errors.push('include_processing_info must be a boolean if provided');
    }

    if (params.include_raw_json !== undefined && typeof params.include_raw_json !== 'boolean') {
      errors.push('include_raw_json must be a boolean if provided');
    }

    // Path validation
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
      name: 'create_metadata_report',
      description: 'Generate human-readable text reports from XMP metadata embedded in images',
      inputSchema: {
        type: 'object',
        properties: {
          image_path: {
            type: 'string',
            description: 'Path to image with embedded XMP metadata (e.g., "folder/image_me.jpg")'
          },
          output_path: {
            type: 'string',
            description: 'Path where report will be saved (auto-generated if not provided)'
          },
          format: {
            type: 'string',
            enum: ['detailed', 'simple', 'json-only'],
            description: 'Report format: detailed (full report), simple (key fields), json-only (raw data)'
          },
          include_processing_info: {
            type: 'boolean',
            description: 'Include processing information in the report (default: true)'
          },
          include_raw_json: {
            type: 'boolean',
            description: 'Include raw JSON data in detailed format (default: true)'
          }
        },
        required: ['image_path', 'format']
      }
    };
  }

  /**
   * Format success response for MCP
   */
  formatSuccessResponse(result: MetadataReportResponse): string {
    if (!result.success) {
      return `❌ **Report Creation Failed**\n\n**Error:** ${result.error}\n**Format:** ${result.format_used}\n**Processing Time:** ${result.processing_time}ms`;
    }

    let response = `✅ **Metadata Report Created Successfully**\n\n`;
    response += `📄 **Report Path:** ${result.report_path}\n`;
    response += `📋 **Format:** ${result.format_used}\n`;
    response += `⚡ **Processing Time:** ${result.processing_time}ms\n`;
    response += `📊 **Field Count:** ${result.field_count || 0}\n`;
    response += `📁 **Report Size:** ${((result.report_size || 0) / 1024).toFixed(1)} KB\n\n`;

    response += `**Format Details:**\n`;
    switch (result.format_used) {
      case 'detailed':
        response += `• Full metadata report with all fields\n`;
        response += `• Professional formatting with headers and sections\n`;
        response += `• Includes raw JSON data for machine processing\n`;
        break;
      case 'simple':
        response += `• Condensed report with key fields only\n`;
        response += `• Clean, readable format for quick review\n`;
        response += `• Processing summary included\n`;
        break;
      case 'json-only':
        response += `• Raw JSON metadata only\n`;
        response += `• Perfect for API integration or data processing\n`;
        response += `• Machine-readable format\n`;
        break;
    }

    response += `\nThe report is now available as a text file that can be downloaded or shared easily.`;

    return response;
  }
}