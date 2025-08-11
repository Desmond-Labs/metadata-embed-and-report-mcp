/**
 * Supabase Client Wrapper for Stream-Based Image Processing
 * Handles cloud storage operations without local file downloads
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class SupabaseImageClient {
  private client: SupabaseClient;
  private bucketName: string;

  constructor(supabaseUrl?: string, supabaseKey?: string, bucketName?: string) {
    const url = supabaseUrl || process.env.SUPABASE_URL;
    // Try service role key first, fall back to anon key
    const key = supabaseKey || 
                process.env.SUPABASE_SERVICE_ROLE_KEY || 
                process.env.SUPABASE_ANON_KEY;
    // Use environment variable for bucket name, default to 'images'
    const bucket = bucketName || 
                   process.env.SUPABASE_BUCKET_NAME || 
                   'images';
    
    if (!url || !key) {
      throw new Error('Supabase URL and key are required. Set SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY environment variables.');
    }

    this.client = createClient(url, key);
    this.bucketName = bucket;
    
    // Log configuration for debugging (without exposing the full key)
    const keyType = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon';
    const keyPreview = key.substring(0, 20) + '...';
    console.error(`📦 Supabase configured: bucket="${this.bucketName}", key_type="${keyType}", key="${keyPreview}"`);
  }

  /**
   * Download image directly into memory buffer
   */
  async downloadImageToBuffer(imagePath: string): Promise<Uint8Array> {
    try {
      const { data: imageBlob, error } = await this.client.storage
        .from(this.bucketName)
        .download(imagePath);

      if (error) {
        throw new Error(`Failed to download image: ${error.message}`);
      }

      if (!imageBlob) {
        throw new Error('No image data received');
      }

      const arrayBuffer = await imageBlob.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      throw new Error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload processed image from memory buffer
   */
  async uploadImageFromBuffer(
    outputPath: string, 
    imageBuffer: Uint8Array, 
    contentType: string = 'image/jpeg',
    upsert: boolean = true
  ): Promise<string> {
    try {
      const { data, error } = await this.client.storage
        .from(this.bucketName)
        .upload(outputPath, imageBuffer, {
          contentType,
          upsert
        });

      if (error) {
        throw new Error(`Failed to upload image: ${error.message}`);
      }

      return data.path;
    } catch (error) {
      throw new Error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if image exists
   */
  async imageExists(imagePath: string): Promise<boolean> {
    try {
      // Get directory and filename from the full path
      const pathParts = imagePath.split('/');
      const filename = pathParts.pop(); // Get the filename
      const directory = pathParts.join('/'); // Get the directory path
      
      const { data, error } = await this.client.storage
        .from(this.bucketName)
        .list(directory, {
          search: filename
        });

      if (error) {
        return false;
      }

      return data.some((file: any) => file.name === filename);
    } catch {
      return false;
    }
  }

  /**
   * Get image metadata (size, type, etc.)
   */
  async getImageInfo(imagePath: string): Promise<{
    size: number;
    contentType: string;
    lastModified: string;
  } | null> {
    try {
      const { data, error } = await this.client.storage
        .from(this.bucketName)
        .list(imagePath.substring(0, imagePath.lastIndexOf('/')), {
          search: imagePath.split('/').pop()
        });

      if (error || !data.length) {
        return null;
      }

      const fileInfo = data[0];
      return {
        size: fileInfo.metadata?.size || 0,
        contentType: fileInfo.metadata?.mimetype || 'image/jpeg',
        lastModified: fileInfo.updated_at || new Date().toISOString()
      };
    } catch {
      return null;
    }
  }

  /**
   * Create signed URL for image access
   */
  async createSignedUrl(imagePath: string, expiresIn: number = 3600): Promise<string> {
    try {
      const { data, error } = await this.client.storage
        .from(this.bucketName)
        .createSignedUrl(imagePath, expiresIn);

      if (error) {
        throw new Error(`Failed to create signed URL: ${error.message}`);
      }

      return data.signedUrl;
    } catch (error) {
      throw new Error(`Signed URL creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List images in a directory
   */
  async listImages(directory: string = '', limit: number = 100): Promise<string[]> {
    try {
      const { data, error } = await this.client.storage
        .from(this.bucketName)
        .list(directory, {
          limit
        });

      if (error) {
        throw new Error(`Failed to list images: ${error.message}`);
      }

      return data
        .filter((file: any) => {
          const name = file.name.toLowerCase();
          return name.endsWith('.jpg') || name.endsWith('.jpeg') || 
                 name.endsWith('.png') || name.endsWith('.tiff');
        })
        .map((file: any) => directory ? `${directory}/${file.name}` : file.name);
    } catch (error) {
      throw new Error(`List images failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete image
   */
  async deleteImage(imagePath: string): Promise<boolean> {
    try {
      const { error } = await this.client.storage
        .from(this.bucketName)
        .remove([imagePath]);

      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Get public URL for image
   */
  getPublicUrl(imagePath: string): string {
    const { data } = this.client.storage
      .from(this.bucketName)
      .getPublicUrl(imagePath);

    return data.publicUrl;
  }

  /**
   * Test connection to Supabase
   */
  async testConnection(): Promise<boolean> {
    try {
      const { data, error } = await this.client.storage.listBuckets();
      return !error && Array.isArray(data);
    } catch {
      return false;
    }
  }
}

// Utility function to detect image format from buffer
export function detectImageFormat(buffer: Uint8Array): string {
  if (buffer.length < 10) return 'unknown';
  
  // JPEG
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) return 'image/jpeg';
  
  // PNG - Check PNG signature: 137 80 78 71 13 10 26 10
  if (buffer.length >= 8 && 
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
      buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A) {
    return 'image/png';
  }
  
  // TIFF
  if ((buffer[0] === 0x49 && buffer[1] === 0x49) || (buffer[0] === 0x4D && buffer[1] === 0x4D)) {
    return 'image/tiff';
  }
  
  return 'unknown';
}

// Utility function to validate image buffer
export function validateImageBuffer(buffer: Uint8Array): {
  valid: boolean;
  format: string;
  size: number;
  error?: string;
} {
  if (!buffer || buffer.length === 0) {
    return {
      valid: false,
      format: 'unknown',
      size: 0,
      error: 'Empty buffer'
    };
  }

  const format = detectImageFormat(buffer);
  const size = buffer.length;

  if (format === 'unknown') {
    return {
      valid: false,
      format,
      size,
      error: 'Unsupported image format'
    };
  }

  const maxSize = 50 * 1024 * 1024; // 50MB
  if (size > maxSize) {
    return {
      valid: false,
      format,
      size,
      error: `Image too large: ${size} bytes (max ${maxSize} bytes)`
    };
  }

  return {
    valid: true,
    format,
    size
  };
}