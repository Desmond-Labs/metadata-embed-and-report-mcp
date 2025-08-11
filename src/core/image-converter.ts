/**
 * Image Converter for Stream-Based PNG to JPEG Conversion
 * Handles in-memory format conversion for universal XMP metadata support
 */

import sharp from 'sharp';
import { detectImageFormat } from './supabase-client.js';

export interface ConversionResult {
  buffer: Uint8Array;
  originalFormat: string;
  targetFormat: string;
  converted: boolean;
  conversionTime: number;
  originalSize: number;
  convertedSize: number;
}

export class ImageConverter {
  
  /**
   * Convert image buffer to JPEG format for XMP embedding
   */
  async convertToJPEG(
    buffer: Uint8Array, 
    quality: number = 95
  ): Promise<ConversionResult> {
    const startTime = Date.now();
    const originalFormat = detectImageFormat(buffer);
    const originalSize = buffer.length;
    
    // If already JPEG, return as-is
    if (originalFormat === 'image/jpeg') {
      return {
        buffer,
        originalFormat,
        targetFormat: 'image/jpeg',
        converted: false,
        conversionTime: 0,
        originalSize,
        convertedSize: originalSize
      };
    }
    
    try {
      // Convert to JPEG using Sharp
      const converted = await sharp(buffer)
        .jpeg({ 
          quality,
          progressive: true,
          mozjpeg: true // Use mozjpeg for better compression
        })
        .toBuffer();
      
      const conversionTime = Date.now() - startTime;
      const convertedBuffer = new Uint8Array(converted);
      
      return {
        buffer: convertedBuffer,
        originalFormat,
        targetFormat: 'image/jpeg',
        converted: true,
        conversionTime,
        originalSize,
        convertedSize: convertedBuffer.length
      };
      
    } catch (error) {
      throw new Error(`Image conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Check if buffer needs conversion to JPEG
   */
  needsConversion(buffer: Uint8Array): boolean {
    const format = detectImageFormat(buffer);
    return format !== 'image/jpeg';
  }
  
  /**
   * Get optimal JPEG quality based on original format and file size
   */
  getOptimalQuality(originalFormat: string, fileSize: number): number {
    // For PNG images, which typically have fewer colors, we can use higher quality
    if (originalFormat === 'image/png') {
      return fileSize > 2 * 1024 * 1024 ? 90 : 95; // 2MB threshold
    }
    
    // For TIFF images, which are typically high quality, preserve quality
    if (originalFormat === 'image/tiff') {
      return 95;
    }
    
    // Default quality for other formats
    return 90;
  }
  
  /**
   * Add metadata enhancement suffix to indicate processed image
   */
  addMetadataEnhancementSuffix(filePath: string): string {
    const lastDotIndex = filePath.lastIndexOf('.');
    if (lastDotIndex === -1) {
      // No extension found, just append _me
      return filePath + '_me';
    }
    
    const baseName = filePath.substring(0, lastDotIndex);
    const extension = filePath.substring(lastDotIndex);
    return `${baseName}_me${extension}`;
  }

  /**
   * Update file path extension for converted images and add metadata enhancement suffix
   */
  updateOutputPath(originalPath: string, converted: boolean): string {
    // First add the metadata enhancement suffix
    let finalPath = this.addMetadataEnhancementSuffix(originalPath);
    
    // Then handle format conversion if needed
    if (converted) {
      finalPath = finalPath.replace(/\.(png|tiff?|webp|bmp)$/i, '.jpg');
    }
    
    return finalPath;
  }
  
  /**
   * Process image buffer with automatic conversion and optimization
   */
  async processBuffer(
    buffer: Uint8Array,
    options: {
      quality?: number;
      forceConversion?: boolean;
    } = {}
  ): Promise<ConversionResult> {
    const { quality, forceConversion = false } = options;
    const originalFormat = detectImageFormat(buffer);
    
    // Determine if conversion is needed
    const needsConversion = forceConversion || this.needsConversion(buffer);
    
    if (!needsConversion) {
      return {
        buffer,
        originalFormat,
        targetFormat: originalFormat,
        converted: false,
        conversionTime: 0,
        originalSize: buffer.length,
        convertedSize: buffer.length
      };
    }
    
    // Use optimal quality if not specified
    const optimalQuality = quality || this.getOptimalQuality(originalFormat, buffer.length);
    
    return await this.convertToJPEG(buffer, optimalQuality);
  }
  
  /**
   * Get conversion statistics for reporting
   */
  getConversionStats(result: ConversionResult): {
    sizeReduction: number;
    sizeReductionPercent: number;
    compressionRatio: number;
    timePerMB: number;
  } {
    const sizeDiff = result.originalSize - result.convertedSize;
    const sizeReductionPercent = (sizeDiff / result.originalSize) * 100;
    const compressionRatio = result.originalSize / result.convertedSize;
    const timePerMB = result.conversionTime / (result.originalSize / (1024 * 1024));
    
    return {
      sizeReduction: sizeDiff,
      sizeReductionPercent,
      compressionRatio,
      timePerMB
    };
  }
  
  /**
   * Validate Sharp is available and working
   */
  async validateSharp(): Promise<boolean> {
    try {
      // Create a simple 1x1 pixel test image
      const testBuffer = await sharp({
        create: {
          width: 1,
          height: 1,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      })
      .jpeg()
      .toBuffer();
      
      return testBuffer.length > 0;
    } catch {
      return false;
    }
  }
}