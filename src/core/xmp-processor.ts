/**
 * XMP Processor for Custom Metadata Schemas
 * Handles creation, embedding, and extraction of XMP metadata
 */

import { MetadataSchema, SchemaType, XMPPacketInfo } from '../types/schemas.js';

// Simple XMP implementation - we'll create a basic version without external dependencies
// This replaces the xmp-editor package with a custom implementation

// Standard and Custom namespace URIs
export const NAMESPACES = {
  // Industry Standard Namespaces
  dc: 'http://purl.org/dc/elements/1.1/',
  iptc: 'http://iptc.org/std/Iptc4xmpExt/2008-02-29/',
  xmp: 'http://ns.adobe.com/xap/1.0/',
  photoshop: 'http://ns.adobe.com/photoshop/1.0/',
  xmpRights: 'http://ns.adobe.com/xap/1.0/rights/',
  exif: 'http://ns.adobe.com/exif/1.0/',
  
  // Custom ORBIT Namespaces
  lifestyle: 'http://orbit.com/lifestyle/1.0/',
  product: 'http://orbit.com/product/1.0/',
  orbit: 'http://orbit.com/orbit/1.0/',
  processing: 'http://orbit.com/processing/1.0/'
};

export class XMPProcessor {
  
  /**
   * Create XMP packet from metadata
   */
  createXMPPacket(
    metadata: MetadataSchema, 
    schemaType: SchemaType = 'orbit',
    options: {
      includeWrappers?: boolean;
      prettyPrint?: boolean;
      includeProcessingInfo?: boolean;
    } = {}
  ): XMPPacketInfo {
    const { includeWrappers = true, prettyPrint = true, includeProcessingInfo = true } = options;
    
    const timestamp = new Date().toISOString();
    const processingInfo: Record<string, string> = includeProcessingInfo ? {
      processed_timestamp: timestamp,
      processor_version: '1.0.0',
      schema_type: schemaType,
      processor_location: 'local_memory_stream'
    } : {};

    // Flatten metadata for XMP format
    const flattenedMetadata = this.flattenMetadata(metadata, schemaType);
    
    // Create XMP content with original metadata for raw JSON section
    let xmpContent = this.generateXMPContent(flattenedMetadata, schemaType, processingInfo, metadata);
    
    if (includeWrappers) {
      xmpContent = this.wrapXMPContent(xmpContent, prettyPrint);
    }

    const fieldCount = Object.keys(flattenedMetadata).length + 
                      (includeProcessingInfo ? Object.keys(processingInfo).length : 0);

    return {
      xmp_content: xmpContent,
      packet_size: Buffer.byteLength(xmpContent, 'utf8'),
      namespace_count: 1, // Currently using one namespace per schema
      field_count: fieldCount
    };
  }

  /**
   * Embed XMP into image buffer (simplified implementation)
   */
  embedXMPInImage(imageBuffer: Uint8Array, xmpPacket: string): Uint8Array {
    try {
      // All images are now converted to JPEG before this step, so we can always embed XMP
      if (this.isJPEG(imageBuffer)) {
        return this.embedXMPInJPEG(imageBuffer, xmpPacket);
      } else {
        // This should not happen with the new conversion workflow
        throw new Error('Image must be JPEG format for XMP embedding. Use ImageConverter to convert first.');
      }
    } catch (error) {
      throw new Error(`XMP embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract XMP from image buffer (simplified implementation)
   */
  extractXMPFromImage(imageBuffer: Uint8Array): {
    xmp_found: boolean;
    xmp_content?: string;
    parsed_metadata?: any;
    schema_type?: SchemaType;
  } {
    try {
      let xmpData: string | null = null;
      
      if (this.isJPEG(imageBuffer)) {
        xmpData = this.extractXMPFromJPEG(imageBuffer);
      }
      
      if (!xmpData) {
        return { xmp_found: false };
      }

      // Parse XMP to extract metadata
      const parsedMetadata = this.parseXMPContent(xmpData);
      const schemaType = this.detectSchemaType(parsedMetadata);

      return {
        xmp_found: true,
        xmp_content: xmpData,
        parsed_metadata: parsedMetadata,
        schema_type: schemaType
      };
    } catch (error) {
      return {
        xmp_found: false
      };
    }
  }

  /**
   * Flatten nested metadata object for XMP format
   */
  private flattenMetadata(metadata: any, prefix: string = ''): Record<string, string> {
    const flattened: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      const fullKey = prefix ? `${prefix}_${key}` : key;
      
      if (value === null || value === undefined) {
        continue;
      }
      
      if (typeof value === 'object' && !Array.isArray(value)) {
        // Recursively flatten nested objects
        Object.assign(flattened, this.flattenMetadata(value, fullKey));
      } else if (Array.isArray(value)) {
        // Convert arrays to comma-separated strings
        flattened[fullKey] = value.join(', ');
      } else {
        // Convert primitive values to strings
        flattened[fullKey] = String(value);
      }
    }
    
    return flattened;
  }

  /**
   * Beautify field names for human-readable display
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
   * Generate RDF Sequence (ordered array) for XMP
   */
  private generateRDFSeq(items: string[], indent: string = '    '): string {
    if (!items || items.length === 0) return '';
    
    const listItems = items
      .map(item => `${indent}    <rdf:li>${this.escapeXML(item)}</rdf:li>`)
      .join('\n');
    
    return `\n${indent}  <rdf:Seq>\n${listItems}\n${indent}  </rdf:Seq>\n${indent}`;
  }

  /**
   * Generate RDF Bag (unordered array) for XMP
   */
  private generateRDFBag(items: string[], indent: string = '    '): string {
    if (!items || items.length === 0) return '';
    
    const listItems = items
      .map(item => `${indent}    <rdf:li>${this.escapeXML(item)}</rdf:li>`)
      .join('\n');
    
    return `\n${indent}  <rdf:Bag>\n${listItems}\n${indent}  </rdf:Bag>\n${indent}`;
  }

  /**
   * Generate semantic RDF container based on field meaning
   */
  private generateSemanticRDFContainer(items: string[], fieldName: string, originalKey: string = '', indent: string = '    '): string {
    if (!items || items.length === 0) return '';
    
    const containerType = this.getSemanticContainerType(fieldName, originalKey, items);
    
    if (containerType === 'seq') {
      return this.generateRDFSeq(items, indent);
    } else {
      return this.generateRDFBag(items, indent);
    }
  }

  /**
   * Generate RDF Alternative (language alternatives) for XMP
   */
  private generateRDFAlt(value: string, lang: string = 'x-default', indent: string = '    '): string {
    return `\n${indent}  <rdf:Alt>\n${indent}    <rdf:li xml:lang='${lang}'>${this.escapeXML(value)}</rdf:li>\n${indent}  </rdf:Alt>\n${indent}`;
  }

  /**
   * Parse array values from comma-separated strings or actual arrays
   */
  private parseArrayValue(value: any): string[] {
    if (Array.isArray(value)) {
      return value.map(item => String(item));
    }
    if (typeof value === 'string' && value.includes(',')) {
      return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
    }
    return [String(value)];
  }

  /**
   * Determine semantic RDF container type based on field meaning and relationships
   */
  private getSemanticContainerType(fieldName: string, originalKey: string = '', values: string[] = []): 'bag' | 'seq' {
    const normalizedField = fieldName.toLowerCase();
    const normalizedKey = originalKey.toLowerCase();
    
    // rdf:Seq (Ordered) - when order/sequence matters
    const sequentialPatterns = [
      // Human demographics - general to specific hierarchy
      'demographics', 'age_group', 'gender', 'ethnicity', 'clothing_style',
      
      // Emotional progression - intensity or temporal progression
      'emotional_states', 'emotions', 'emotional_hooks', 'mood_indicators',
      
      // Visual/spatial prominence - by importance or visual weight
      'food_and_beverage', 'food_beverage', 'furniture', 'key_objects', 'defining_props',
      'focal_points', 'visual_elements', 'primary_elements',
      
      // Color hierarchy - dominant to accent
      'color_palette', 'primary_colors', 'secondary_colors', 'color_scheme',
      
      // Temporal/narrative sequence - chronological or logical progression
      'story_elements', 'narrative_elements', 'activities', 'interactions',
      'technical_qualities', 'quality_indicators',
      
      // Spatial arrangement - by proximity or importance
      'architectural_elements', 'natural_elements', 'defining_props',
      
      // Marketing hierarchy - by priority or targeting specificity
      'aspirational_elements', 'brand_alignment_opportunities'
    ];
    
    // rdf:Bag (Unordered) - when order is irrelevant
    const unorderedPatterns = [
      // Simple classifications and categories
      'keywords', 'tags', 'categories', 'classifications',
      'organizations', 'organisation', 'person_names', 'people_names',
      
      // Equipment and tools - just inventory
      'equipment', 'tools', 'technology', 'devices', 'gadgets',
      
      // Market segments and business categories
      'target_market', 'market_segments', 'competitive_advantages', 'advantages',
      'business_categories', 'industry_categories',
      
      // General descriptors without hierarchy
      'attributes', 'characteristics', 'features',
      'sensory_cues', 'ambient_sounds', 'weather_conditions',
      
      // Personal items and miscellaneous objects
      'personal_items', 'accessories', 'miscellaneous'
    ];
    
    // Check for unordered patterns FIRST (more specific)
    // This ensures "technology" beats "key_objects" in semantic conflicts
    for (const pattern of unorderedPatterns) {
      if (normalizedField.includes(pattern) || normalizedKey.includes(pattern)) {
        return 'bag';
      }
    }
    
    // Check for sequential patterns SECOND (more general)
    for (const pattern of sequentialPatterns) {
      if (normalizedField.includes(pattern) || normalizedKey.includes(pattern)) {
        return 'seq';
      }
    }
    
    // Contextual analysis for ambiguous cases
    if (values.length > 0) {
      // If values suggest hierarchy or progression, use sequence
      const firstValue = values[0].toLowerCase();
      const hasAgeProgression = values.some(v => v.match(/young|middle|old|adult|child|teen/i));
      const hasIntensityProgression = values.some(v => v.match(/high|low|medium|intense|mild|strong|weak/i));
      const hasTemporalProgression = values.some(v => v.match(/first|second|primary|secondary|main|background/i));
      
      if (hasAgeProgression || hasIntensityProgression || hasTemporalProgression) {
        return 'seq';
      }
    }
    
    // Default fallback based on field semantics
    if (normalizedField.includes('human') || normalizedField.includes('people') || 
        normalizedField.includes('emotional') || normalizedField.includes('visual') ||
        normalizedField.includes('narrative') || normalizedField.includes('story')) {
      return 'seq'; // Human/emotional/narrative elements usually have meaningful order
    }
    
    // Default to bag for general classifications
    return 'bag';
  }

  /**
   * Map ORBIT metadata to Dublin Core fields
   */
  private mapToDublinCore(metadata: any, schemaType: SchemaType): Record<string, any> {
    const dcFields: Record<string, any> = {};
    
    // Generate title from setting and primary activity
    const setting = metadata.scene_overview?.setting || metadata.setting;
    const activity = metadata.scene_overview?.primary_activity || metadata.primary_activity;
    if (setting && activity) {
      dcFields.title = `${setting} - ${activity}`;
    } else if (setting) {
      dcFields.title = setting;
    }

    // Generate description from multiple elements
    const description = this.generateSceneDescription(metadata, schemaType);
    if (description) {
      dcFields.description = description;
    }

    // Extract keywords from key objects and activities
    const keywords = this.extractKeywords(metadata);
    if (keywords.length > 0) {
      dcFields.subject = keywords;
    }

    // Set creator
    dcFields.creator = 'ORBIT AI Analysis System';

    return dcFields;
  }

  /**
   * Map ORBIT metadata to IPTC Extension fields
   */
  private mapToIPTC(metadata: any): Record<string, any> {
    const iptcFields: Record<string, any> = {};

    // Person in image from demographics
    const demographics = metadata.human_elements?.demographics || metadata.demographics;
    if (demographics) {
      const peopleArray = this.parseArrayValue(demographics);
      if (peopleArray.length > 0) {
        iptcFields.PersonInImage = peopleArray;
      }
    }

    // Organization from environment context
    const locationText = metadata.environment?.location_type || metadata.location_type;
    if (locationText && (locationText.includes('restaurant') || locationText.includes('bar') || locationText.includes('cafe'))) {
      iptcFields.OrganisationInImageName = ['Unidentified ' + locationText.toLowerCase()];
    }

    return iptcFields;
  }

  /**
   * Map ORBIT metadata to Adobe XMP Core fields
   */
  private mapToXMPCore(): Record<string, any> {
    const xmpFields: Record<string, any> = {};
    
    xmpFields.CreatorTool = 'ORBIT Metadata MCP v2.1';
    xmpFields.CreateDate = new Date().toISOString();
    xmpFields.MetadataDate = new Date().toISOString();
    
    return xmpFields;
  }

  /**
   * Map ORBIT metadata to Adobe Photoshop fields
   */
  private mapToPhotoshop(metadata: any): Record<string, any> {
    const psFields: Record<string, any> = {};

    // Instructions from marketing potential
    const marketingHooks = metadata.marketing_potential?.emotional_hooks || metadata.emotional_hooks;
    const targetDemo = metadata.marketing_potential?.target_demographic || metadata.target_demographic;
    
    if (marketingHooks || targetDemo) {
      let instructions = 'AI-analyzed image suitable for';
      if (targetDemo) {
        instructions += ` ${targetDemo} marketing`;
      }
      if (marketingHooks) {
        instructions += `. Emotional themes: ${marketingHooks}`;
      }
      psFields.Instructions = instructions;
    }

    psFields.Source = 'AI-generated metadata analysis';
    psFields.ColorMode = '3'; // RGB

    return psFields;
  }

  /**
   * Generate scene description from metadata
   */
  private generateSceneDescription(metadata: any, schemaType: SchemaType): string {
    const parts: string[] = [];
    
    const setting = metadata.scene_overview?.setting || metadata.setting;
    const timeOfDay = metadata.scene_overview?.time_of_day || metadata.time_of_day;
    const activity = metadata.scene_overview?.primary_activity || metadata.primary_activity;
    const numPeople = metadata.human_elements?.number_of_people || metadata.number_of_people;
    const mood = metadata.atmospheric_elements?.mood || metadata.mood;

    if (setting && activity) {
      parts.push(`A scene of ${activity.toLowerCase()} in ${setting.toLowerCase()}`);
    }
    
    if (numPeople) {
      parts.push(`featuring ${numPeople} people`);
    }
    
    if (timeOfDay) {
      parts.push(`during ${timeOfDay.toLowerCase()}`);
    }
    
    if (mood) {
      parts.push(`with a ${mood.toLowerCase()} atmosphere`);
    }

    return parts.length > 0 ? parts.join(' ') + '.' : '';
  }

  /**
   * Extract keywords from metadata for Dublin Core subject
   */
  private extractKeywords(metadata: any): string[] {
    const keywords: string[] = [];
    
    // From key objects
    const foodBev = metadata.key_objects?.food_and_beverage || metadata.food_and_beverage;
    if (foodBev) {
      const items = this.parseArrayValue(foodBev);
      keywords.push(...items.map(item => item.toLowerCase()));
    }

    const furniture = metadata.key_objects?.furniture || metadata.furniture;
    if (furniture) {
      const items = this.parseArrayValue(furniture);
      keywords.push(...items.map(item => item.toLowerCase()));
    }

    // From activities and context
    const activity = metadata.scene_overview?.primary_activity || metadata.primary_activity;
    if (activity) {
      keywords.push(activity.toLowerCase());
    }

    const location = metadata.environment?.location_type || metadata.location_type;
    if (location) {
      keywords.push(location.toLowerCase());
    }

    // Remove duplicates and return
    return [...new Set(keywords)].slice(0, 10); // Limit to 10 keywords
  }

  /**
   * Format fields with proper alignment for human-readable display
   */
  private formatFieldsWithAlignment(
    flattenedMetadata: Record<string, string>,
    processingInfo: Record<string, string> = {}
  ): string {
    // Combine all fields
    const allFields = { ...flattenedMetadata, ...processingInfo };
    
    // Calculate maximum field name length for alignment
    const fieldNames = Object.keys(allFields).map(key => this.beautifyFieldName(key));
    const maxLength = Math.max(...fieldNames.map(name => name.length));
    
    // Use consistent padding width (minimum 20 characters like exiftool -g)
    const paddingWidth = Math.max(maxLength, 20);
    
    // Format each field with proper alignment
    const formattedFields: string[] = [];
    
    // Add metadata fields
    for (const [key, value] of Object.entries(flattenedMetadata)) {
      const beautifiedName = this.beautifyFieldName(key);
      const padding = ' '.repeat(paddingWidth - beautifiedName.length);
      formattedFields.push(`${beautifiedName}${padding}: ${value}`);
    }
    
    // Add processing fields
    for (const [key, value] of Object.entries(processingInfo)) {
      const beautifiedName = this.beautifyFieldName(key);
      const padding = ' '.repeat(paddingWidth - beautifiedName.length);
      formattedFields.push(`${beautifiedName}${padding}: ${value}`);
    }
    
    return formattedFields.join('\n');
  }

  /**
   * Generate industry-standard multi-block XMP content
   */
  private generateXMPContent(
    flattenedMetadata: Record<string, string>, 
    schemaType: SchemaType,
    processingInfo: Record<string, string> = {},
    originalMetadata?: any
  ): string {
    const blocks: string[] = [];
    
    // Map to standard namespaces
    const dcFields = this.mapToDublinCore(originalMetadata || {}, schemaType);
    const iptcFields = this.mapToIPTC(originalMetadata || {});
    const xmpFields = this.mapToXMPCore();
    const psFields = this.mapToPhotoshop(originalMetadata || {});

    // Dublin Core block
    if (Object.keys(dcFields).length > 0) {
      blocks.push(this.generateDublinCoreBlock(dcFields));
    }

    // IPTC Extension block
    if (Object.keys(iptcFields).length > 0) {
      blocks.push(this.generateIPTCBlock(iptcFields));
    }

    // Adobe XMP Core block
    if (Object.keys(xmpFields).length > 0) {
      blocks.push(this.generateXMPCoreBlock(xmpFields));
    }

    // Adobe Photoshop block
    if (Object.keys(psFields).length > 0) {
      blocks.push(this.generatePhotoshopBlock(psFields));
    }

    // Custom ORBIT block with beautified field names
    blocks.push(this.generateCustomORBITBlock(flattenedMetadata, schemaType, originalMetadata));

    // Processing info block
    if (Object.keys(processingInfo).length > 0) {
      blocks.push(this.generateProcessingBlock(processingInfo));
    }

    return blocks.join('\n\n');
  }

  /**
   * Generate Dublin Core RDF block
   */
  private generateDublinCoreBlock(dcFields: Record<string, any>): string {
    let fields = '';
    
    for (const [key, value] of Object.entries(dcFields)) {
      if (key === 'title' || key === 'description') {
        // Use RDF Alt for title and description
        fields += `          <dc:${key}>${this.generateRDFAlt(String(value))}</dc:${key}>\n`;
      } else if (key === 'subject' && Array.isArray(value)) {
        // Use RDF Bag for subjects (keywords)
        fields += `          <dc:${key}>${this.generateRDFBag(value)}</dc:${key}>\n`;
      } else {
        // Simple string value
        fields += `          <dc:${key}>${this.escapeXML(String(value))}</dc:${key}>\n`;
      }
    }

    return `        <rdf:Description rdf:about=""
          xmlns:dc="${NAMESPACES.dc}">
${fields}        </rdf:Description>`;
  }

  /**
   * Generate IPTC Extension RDF block
   */
  private generateIPTCBlock(iptcFields: Record<string, any>): string {
    let fields = '';
    
    for (const [key, value] of Object.entries(iptcFields)) {
      if (Array.isArray(value)) {
        // Use semantic container for IPTC arrays (usually rdf:Bag for organizations, rdf:Seq for demographics)
        fields += `          <Iptc4xmpExt:${key}>${this.generateSemanticRDFContainer(value, key)}</Iptc4xmpExt:${key}>\n`;
      } else {
        fields += `          <Iptc4xmpExt:${key}>${this.escapeXML(String(value))}</Iptc4xmpExt:${key}>\n`;
      }
    }

    return `        <rdf:Description rdf:about=""
          xmlns:Iptc4xmpExt="${NAMESPACES.iptc}">
${fields}        </rdf:Description>`;
  }

  /**
   * Generate Adobe XMP Core RDF block
   */
  private generateXMPCoreBlock(xmpFields: Record<string, any>): string {
    let fields = '';
    
    for (const [key, value] of Object.entries(xmpFields)) {
      fields += `          <xmp:${key}>${this.escapeXML(String(value))}</xmp:${key}>\n`;
    }

    return `        <rdf:Description rdf:about=""
          xmlns:xmp="${NAMESPACES.xmp}">
${fields}        </rdf:Description>`;
  }

  /**
   * Generate Adobe Photoshop RDF block
   */
  private generatePhotoshopBlock(psFields: Record<string, any>): string {
    let fields = '';
    
    for (const [key, value] of Object.entries(psFields)) {
      fields += `          <photoshop:${key}>${this.escapeXML(String(value))}</photoshop:${key}>\n`;
    }

    return `        <rdf:Description rdf:about=""
          xmlns:photoshop="${NAMESPACES.photoshop}">
${fields}        </rdf:Description>`;
  }

  /**
   * Generate custom ORBIT RDF block with beautified field names and semantic arrays
   */
  private generateCustomORBITBlock(
    flattenedMetadata: Record<string, string>,
    schemaType: SchemaType,
    originalMetadata?: any
  ): string {
    const namespace = NAMESPACES[schemaType];
    const prefix = schemaType;
    let fields = '';
    
    // Add metadata fields with beautified names and semantic array handling
    for (const [key, value] of Object.entries(flattenedMetadata)) {
      const beautifiedName = this.beautifyFieldName(key);
      const fieldName = beautifiedName.replace(/\s+/g, '_');
      
      // Check if this should be an array based on comma separation
      const arrayValues = this.parseArrayValue(value);
      if (arrayValues.length > 1) {
        // Use semantic container selection based on field meaning
        fields += `          <${prefix}:${fieldName}>${this.generateSemanticRDFContainer(arrayValues, fieldName, key)}</${prefix}:${fieldName}>\n`;
      } else {
        // Simple string value
        fields += `          <${prefix}:${fieldName}>${this.escapeXML(value)}</${prefix}:${fieldName}>\n`;
      }
    }
    
    // Add comprehensive raw JSON with all embedded fields
    if (originalMetadata) {
      const completeRawData = this.generateCompleteRawJSON(flattenedMetadata, schemaType, originalMetadata);
      const rawJson = JSON.stringify(completeRawData, null, 2);
      const escapedJson = this.escapeXML(rawJson);
      fields += `          <${prefix}:Raw_JSON>${escapedJson}</${prefix}:Raw_JSON>\n`;
    }

    return `        <rdf:Description rdf:about=""
          xmlns:${prefix}="${namespace}">
${fields}        </rdf:Description>`;
  }

  /**
   * Generate complete raw JSON data including all embedded fields
   */
  private generateCompleteRawJSON(
    flattenedMetadata: Record<string, string>,
    schemaType: SchemaType,
    originalMetadata: any
  ): any {
    // Get all standard namespace mappings
    const dcFields = this.mapToDublinCore(originalMetadata, schemaType);
    const iptcFields = this.mapToIPTC(originalMetadata);
    const xmpFields = this.mapToXMPCore();
    const psFields = this.mapToPhotoshop(originalMetadata);
    
    // Generate processing info
    const processingInfo = {
      processed_timestamp: new Date().toISOString(),
      processor_version: '1.0.0',
      schema_type: schemaType,
      processor_location: 'local_memory_stream'
    };

    // Create beautified fields object (all flattened fields with beautified names)
    const beautifiedFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(flattenedMetadata)) {
      const beautifiedName = this.beautifyFieldName(key);
      const fieldName = beautifiedName.replace(/\s+/g, '_');
      
      // Parse arrays if applicable
      const arrayValues = this.parseArrayValue(value);
      beautifiedFields[fieldName] = arrayValues.length > 1 ? arrayValues : value;
    }

    // Return comprehensive raw data structure
    return {
      original_metadata: originalMetadata,
      flattened_fields: beautifiedFields,
      standard_metadata: {
        dublin_core: dcFields,
        iptc: iptcFields,
        xmp_core: xmpFields,
        photoshop: psFields
      },
      processing: processingInfo
    };
  }

  /**
   * Generate processing info RDF block
   */
  private generateProcessingBlock(processingInfo: Record<string, string>): string {
    let fields = '';
    
    for (const [key, value] of Object.entries(processingInfo)) {
      const beautifiedName = this.beautifyFieldName(key);
      const fieldName = beautifiedName.replace(/\s+/g, '_');
      fields += `          <processing:${fieldName}>${this.escapeXML(value)}</processing:${fieldName}>\n`;
    }

    return `        <rdf:Description rdf:about=""
          xmlns:processing="${NAMESPACES.processing}">
${fields}        </rdf:Description>`;
  }

  /**
   * Wrap XMP content with proper headers and toolkit declaration
   */
  private wrapXMPContent(content: string, prettyPrint: boolean = true): string {
    const indent = prettyPrint ? '\n      ' : '';
    const spacing = prettyPrint ? '\n    ' : '';
    
    return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
    <x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="ORBIT Metadata MCP v2.1">
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">${indent}${content}${spacing}
      </rdf:RDF>
    </x:xmpmeta>
    <?xpacket end="w"?>`;
  }

  /**
   * Parse XMP content to extract metadata
   */
  private parseXMPContent(xmpContent: string): any {
    const metadata: any = {};
    
    try {
      // First, try to extract the Raw_JSON field which contains complete metadata
      // Check all possible schema namespaces for Raw_JSON
      const rawJsonPatterns = [
        /<lifestyle:Raw_JSON>([^<]+)<\/lifestyle:Raw_JSON>/,
        /<product:Raw_JSON>([^<]+)<\/product:Raw_JSON>/,
        /<orbit:Raw_JSON>([^<]+)<\/orbit:Raw_JSON>/
      ];
      
      for (const pattern of rawJsonPatterns) {
        const rawJsonMatch = xmpContent.match(pattern);
        if (rawJsonMatch) {
          let rawJsonString = '';
          try {
            rawJsonString = this.unescapeXML(rawJsonMatch[1]);
            console.log('🎯 DEBUG: Raw JSON string length:', rawJsonString.length);
            console.log('🎯 DEBUG: Raw JSON preview (before cleanup):', rawJsonString.substring(0, 200) + '...');
            
            // Fix the embedded JSON format - replace period separators with commas
            // The embedded JSON uses . as separators instead of commas
            rawJsonString = rawJsonString.replace(/\.\s+"/g, ', "');
            console.log('🎯 DEBUG: Raw JSON preview (after cleanup):', rawJsonString.substring(0, 200) + '...');
            
            const parsedJson = JSON.parse(rawJsonString);
            console.log('🎯 DEBUG: Parsed JSON structure keys:', Object.keys(parsedJson));
            
            // The Raw JSON contains the complete structure, not nested under .metadata
            // It should have: original_metadata, flattened_fields, standard_metadata, processing
            if (parsedJson && (parsedJson.original_metadata || parsedJson.flattened_fields)) {
              console.log('✅ Using complete metadata from Raw_JSON field');
              console.log('🎯 DEBUG: Found sections:', Object.keys(parsedJson));
              
              // Create enhanced metadata structure with Raw_JSON attached
              const enhancedMetadata = { Raw_JSON: rawJsonString };
              
              // If we have original metadata structure, reconstruct it
              if (parsedJson.original_metadata) {
                Object.assign(enhancedMetadata, parsedJson.original_metadata);
              }
              
              return enhancedMetadata;
            }
          } catch (jsonError) {
            console.warn('❌ Failed to parse Raw_JSON field:', jsonError);
            console.warn('🎯 DEBUG: Problematic JSON string:', rawJsonString.substring(0, 500));
          }
        }
      }

      // Fallback: Simple regex-based parsing for our custom namespaces
      const patterns = [
        /<lifestyle:([^>]+)>([^<]+)<\/lifestyle:[^>]+>/g,
        /<product:([^>]+)>([^<]+)<\/product:[^>]+>/g,
        /<orbit:([^>]+)>([^<]+)<\/orbit:[^>]+>/g,
        /<processing:([^>]+)>([^<]+)<\/processing:[^>]+>/g
      ];

      const namespaces = ['lifestyle', 'product', 'orbit', 'processing'];
      
      patterns.forEach((pattern, index) => {
        const namespace = namespaces[index];
        let match;
        
        while ((match = pattern.exec(xmpContent)) !== null) {
          if (!metadata[namespace]) {
            metadata[namespace] = {};
          }
          const fieldName = match[1];
          const fieldValue = this.unescapeXML(match[2]);
          
          // Skip Raw_JSON field since we already processed it above
          if (fieldName === 'Raw_JSON') {
            continue;
          }
          
          // Convert beautified field names back to original format for consistency
          // This helps maintain compatibility with our schema validation
          metadata[namespace][fieldName] = fieldValue;
        }
      });

      return metadata;
    } catch (error) {
      return {};
    }
  }

  /**
   * Detect schema type from parsed metadata
   */
  private detectSchemaType(parsedMetadata: any): SchemaType {
    if (parsedMetadata.lifestyle && Object.keys(parsedMetadata.lifestyle).length > 0) {
      return 'lifestyle';
    }
    if (parsedMetadata.product && Object.keys(parsedMetadata.product).length > 0) {
      return 'product';
    }
    return 'orbit';
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Unescape XML special characters
   */
  private unescapeXML(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }

  /**
   * Validate XMP packet format
   */
  validateXMPPacket(xmpContent: string): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for basic XMP structure
    if (!xmpContent.includes('<x:xmpmeta')) {
      errors.push('Missing XMP metadata wrapper');
    }

    if (!xmpContent.includes('<rdf:RDF')) {
      errors.push('Missing RDF wrapper');
    }

    if (!xmpContent.includes('<rdf:Description')) {
      errors.push('Missing RDF description');
    }

    // Check for our custom namespaces
    const hasCustomNamespace = Object.keys(NAMESPACES).some(ns => 
      xmpContent.includes(`xmlns:${ns}=`) || xmpContent.includes(`<${ns}:`)
    );

    if (!hasCustomNamespace) {
      warnings.push('No custom ORBIT namespaces detected');
    }

    // Check for proper XML formatting
    try {
      // Basic XML validation (simplified)
      const openTags = (xmpContent.match(/<[^\/][^>]*>/g) || []).length;
      const closeTags = (xmpContent.match(/<\/[^>]*>/g) || []).length;
      const selfCloseTags = (xmpContent.match(/<[^>]*\/>/g) || []).length;
      
      if (openTags !== closeTags + selfCloseTags) {
        warnings.push('Possible XML tag mismatch detected');
      }
    } catch (error) {
      warnings.push('XML structure validation failed');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get XMP packet statistics
   */
  getXMPStats(xmpContent: string): {
    size_bytes: number;
    field_count: number;
    namespace_count: number;
    namespaces_detected: string[];
  } {
    const namespaces_detected: string[] = [];
    let field_count = 0;

    // Detect our custom namespaces
    Object.keys(NAMESPACES).forEach(ns => {
      if (xmpContent.includes(`<${ns}:`)) {
        namespaces_detected.push(ns);
        // Count fields in this namespace
        const pattern = new RegExp(`<${ns}:[^>]+>`, 'g');
        const matches = xmpContent.match(pattern);
        if (matches) {
          field_count += matches.length;
        }
      }
    });

    return {
      size_bytes: Buffer.byteLength(xmpContent, 'utf8'),
      field_count,
      namespace_count: namespaces_detected.length,
      namespaces_detected
    };
  }

  /**
   * Check if buffer is JPEG format
   */
  private isJPEG(buffer: Uint8Array): boolean {
    return buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xD8;
  }

  /**
   * Embed XMP into JPEG buffer (simplified implementation)
   */
  private embedXMPInJPEG(buffer: Uint8Array, xmpPacket: string): Uint8Array {
    // This is a simplified implementation - in production you'd want a proper JPEG parser
    // For now, we'll insert the XMP as an APP1 segment after the SOI marker
    
    const xmpBytes = new TextEncoder().encode(xmpPacket);
    const app1Header = new Uint8Array([
      0xFF, 0xE1, // APP1 marker
      0x00, 0x00, // Length placeholder (will be filled)
      // XMP signature
      0x68, 0x74, 0x74, 0x70, 0x3A, 0x2F, 0x2F, 0x6E, 0x73, 0x2E, 
      0x61, 0x64, 0x6F, 0x62, 0x65, 0x2E, 0x63, 0x6F, 0x6D, 0x2F, 
      0x78, 0x61, 0x70, 0x2F, 0x31, 0x2E, 0x30, 0x2F, 0x00
    ]);

    // Calculate length (header + XMP data)
    const totalLength = app1Header.length + xmpBytes.length - 2; // -2 for the marker itself
    app1Header[2] = (totalLength >> 8) & 0xFF;
    app1Header[3] = totalLength & 0xFF;

    // Create new buffer with XMP inserted
    const result = new Uint8Array(buffer.length + app1Header.length + xmpBytes.length);
    
    // Copy SOI marker (first 2 bytes)
    result.set(buffer.slice(0, 2), 0);
    
    // Insert APP1 segment with XMP
    result.set(app1Header, 2);
    result.set(xmpBytes, 2 + app1Header.length);
    
    // Copy rest of original image
    result.set(buffer.slice(2), 2 + app1Header.length + xmpBytes.length);

    return result;
  }

  /**
   * Extract XMP from JPEG buffer (simplified implementation)
   */
  private extractXMPFromJPEG(buffer: Uint8Array): string | null {
    // Look for APP1 segments with XMP signature
    for (let i = 0; i < buffer.length - 30; i++) {
      if (buffer[i] === 0xFF && buffer[i + 1] === 0xE1) {
        // Found APP1 marker, check for XMP signature
        const segmentLength = (buffer[i + 2] << 8) | buffer[i + 3];
        const signatureStart = i + 4;
        
        // Check for XMP signature
        const xmpSignature = 'http://ns.adobe.com/xap/1.0/\0';
        let isXMP = true;
        for (let j = 0; j < xmpSignature.length; j++) {
          if (buffer[signatureStart + j] !== xmpSignature.charCodeAt(j)) {
            isXMP = false;
            break;
          }
        }
        
        if (isXMP) {
          // Extract XMP data
          const xmpStart = signatureStart + xmpSignature.length;
          const xmpLength = segmentLength - xmpSignature.length - 2;
          const xmpBytes = buffer.slice(xmpStart, xmpStart + xmpLength);
          return new TextDecoder().decode(xmpBytes);
        }
        
        // Skip to next potential marker
        i += segmentLength + 2;
      }
    }
    
    return null;
  }
}