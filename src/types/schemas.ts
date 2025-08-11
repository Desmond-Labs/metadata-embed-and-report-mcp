/**
 * TypeScript interfaces for ORBIT Metadata Schemas
 * Supports Lifestyle, Product, and Base (Orbit) schemas
 */

// Base metadata structure
export interface BaseMetadata {
  title?: string;
  description?: string;
  keywords?: string[];
  creator?: string;
  timestamp?: string;
}

// Lifestyle schema for social dynamics and cultural context
export interface LifestyleMetadata extends BaseMetadata {
  scene_overview?: {
    setting?: string;
    time_of_day?: string;
    season?: string;
    occasion?: string;
    primary_activity?: string;
  };
  human_elements?: {
    number_of_people?: number;
    demographics?: string[];
    interactions?: string;
    emotional_states?: string[];
    clothing_style?: string;
    social_dynamics?: string;
  };
  environment?: {
    location_type?: string;
    architectural_elements?: string[];
    natural_elements?: string[];
    urban_context?: string;
    spatial_arrangement?: string;
  };
  key_objects?: {
    food_beverage?: string[];
    furniture?: string[];
    technology?: string[];
    decorative_items?: string[];
    defining_props?: string[];
  };
  atmospheric_elements?: {
    lighting_quality?: string;
    color_palette?: string[];
    mood?: string;
    sensory_cues?: string[];
    weather_conditions?: string;
  };
  narrative_analysis?: {
    story?: string;
    cultural_significance?: string;
    socioeconomic_indicators?: string[];
    values_represented?: string[];
    lifestyle_category?: string;
  };
  photographic_elements?: {
    composition?: string;
    perspective?: string;
    focal_points?: string[];
    depth_of_field?: string;
    visual_style?: string;
  };
  marketing_potential?: {
    target_demographic?: string;
    aspirational_elements?: string[];
    brand_alignment_opportunities?: string[];
    emotional_hooks?: string[];
    market_appeal?: string;
  };
}

// Product schema for design and commercial analysis
export interface ProductMetadata extends BaseMetadata {
  product_identification?: {
    product_type?: string;
    product_category?: string;
    design_style?: string;
    brand?: string;
    model?: string;
  };
  physical_characteristics?: {
    primary_color?: string;
    secondary_colors?: string[];
    material?: string;
    pattern_type?: string;
    surface_texture?: string;
    finish?: string;
    dimensions?: string;
    weight?: string;
  };
  structural_elements?: {
    frame_type?: string;
    frame_design?: string;
    leg_structure?: string;
    support_systems?: string[];
    construction_details?: string[];
  };
  design_attributes?: {
    aesthetic_category?: string;
    design_era?: string;
    visual_weight?: string;
    design_influence?: string;
    style_elements?: string[];
    intended_setting?: string;
  };
  commercial_analysis?: {
    market_positioning?: string;
    target_market?: string[];
    price_point_indication?: string;
    competitive_advantages?: string[];
    market_differentiation?: string;
    retail_category?: string;
  };
  quality_assessment?: {
    construction_quality?: string;
    material_quality?: string;
    finish_quality?: string;
    craftsmanship_level?: string;
    durability_indicators?: string[];
    value_proposition?: string;
  };
}

// Base (Orbit) schema for comprehensive visual intelligence
export interface OrbitMetadata extends BaseMetadata {
  scene_overview?: {
    setting?: string;
    time_of_day?: string;
    activities?: string[];
    overall_mood?: string;
    scene_complexity?: string;
  };
  human_elements?: {
    people_count?: number;
    age_groups?: string[];
    gender_distribution?: string;
    ethnicity_diversity?: string;
    interactions?: string;
    emotions?: string[];
  };
  environment?: {
    location_type?: string;
    architecture_style?: string;
    natural_elements?: string[];
    weather_conditions?: string;
    lighting_conditions?: string;
  };
  key_objects?: {
    products?: string[];
    technology?: string[];
    furniture?: string[];
    vehicles?: string[];
    notable_items?: string[];
  };
  atmospheric_elements?: {
    color_scheme?: string[];
    lighting_quality?: string;
    visual_mood?: string;
    energy_level?: string;
    aesthetic_style?: string;
  };
  narrative_analysis?: {
    story_elements?: string[];
    cultural_context?: string;
    social_dynamics?: string;
    values_expressed?: string[];
    lifestyle_indicators?: string[];
  };
  photographic_elements?: {
    composition_style?: string;
    camera_angle?: string;
    depth_of_field?: string;
    focus_points?: string[];
    technical_quality?: string;
  };
  marketing_potential?: {
    demographics?: string[];
    psychographics?: string[];
    brand_categories?: string[];
    emotional_appeal?: string[];
    commercial_viability?: string;
  };
}

// Union type for all metadata schemas
export type MetadataSchema = LifestyleMetadata | ProductMetadata | OrbitMetadata;

// Schema type identifier
export type SchemaType = 'lifestyle' | 'product' | 'orbit';

// Tool request/response interfaces
export interface EmbedMetadataRequest {
  source_path: string;
  metadata: MetadataSchema;
  output_path: string;
  schema_type?: SchemaType;
  compression_quality?: number;
}

export interface ReadMetadataRequest {
  image_path: string;
  format?: 'json' | 'text';
  include_xmp?: boolean;
  include_exif?: boolean;
}

export interface ValidateSchemaRequest {
  metadata: MetadataSchema;
  schema_type?: SchemaType;
  strict_mode?: boolean;
}

export interface CreateXMPRequest {
  metadata: MetadataSchema;
  schema_type?: SchemaType;
  output_path?: string;
  include_wrappers?: boolean;
  pretty_print?: boolean;
}

// Response interfaces
export interface ProcessingResponse {
  success: boolean;
  message?: string;
  error?: string;
  processing_time?: number;
  
  // File processing info
  source_path?: string;
  output_path?: string;
  schema_type?: SchemaType;
  
  // Size information
  original_size?: number;
  processed_size?: number;
  xmp_packet_size?: number;
  field_count?: number;
  completeness_score?: number;
  
  // Conversion information
  format_converted?: boolean;
  original_format?: string;
  target_format?: string;
  conversion_time?: number;
  final_output_path?: string;
  
  // Validation results
  validation_warnings?: string[];
  
  [key: string]: any;
}

export interface ValidationResult {
  valid: boolean;
  schema_type: SchemaType;
  errors: string[];
  warnings: string[];
  completeness_score: number;
  field_count: number;
}

export interface XMPPacketInfo {
  xmp_content: string;
  packet_size: number;
  namespace_count: number;
  field_count: number;
}