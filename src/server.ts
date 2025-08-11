#!/usr/bin/env node

/**
 * Simple ORBIT Metadata MCP Server
 * Stream-based XMP metadata processing for Supabase Storage
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';

import { SupabaseImageClient } from './core/supabase-client.js';
import { EmbedMetadataTool } from './tools/embed-metadata.js';
import { ReadMetadataTool } from './tools/read-metadata.js';
import { ValidateSchemaTool } from './tools/validate-schema.js';
import { CreateXMPTool } from './tools/create-xmp.js';
import { CreateMetadataReportTool } from './tools/create-metadata-report.js';

class SimpleOrbitMCPServer {
  private server: Server;
  private supabaseClient: SupabaseImageClient;
  private embedTool: EmbedMetadataTool;
  private readTool: ReadMetadataTool;
  private validateTool: ValidateSchemaTool;
  private createXmpTool: CreateXMPTool;
  private createReportTool: CreateMetadataReportTool;

  constructor() {
    // Initialize MCP server
    this.server = new Server(
      {
        name: 'simple-orbit-metadata-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize Supabase client
    try {
      this.supabaseClient = new SupabaseImageClient();
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error);
      process.exit(1);
    }

    // Initialize tools
    this.embedTool = new EmbedMetadataTool(this.supabaseClient);
    this.readTool = new ReadMetadataTool(this.supabaseClient);
    this.validateTool = new ValidateSchemaTool();
    this.createXmpTool = new CreateXMPTool(this.supabaseClient);
    this.createReportTool = new CreateMetadataReportTool(this.supabaseClient);

    this.setupHandlers();
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          EmbedMetadataTool.getToolSchema(),
          ReadMetadataTool.getToolSchema(),
          ValidateSchemaTool.getToolSchema(),
          CreateXMPTool.getToolSchema(),
          CreateMetadataReportTool.getToolSchema()
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'embed_image_metadata':
            const embedResult = await this.embedTool.execute(args as any);
            return {
              content: [
                {
                  type: 'text',
                  text: this.embedTool.formatSuccessResponse(embedResult)
                }
              ]
            };

          case 'read_image_metadata':
            const readResult = await this.readTool.execute(args as any);
            return {
              content: [
                {
                  type: 'text',
                  text: this.readTool.formatResponse(readResult, (args as any)?.format)
                }
              ]
            };

          case 'validate_metadata_schema':
            const validateResult = await this.validateTool.execute(args as any);
            return {
              content: [
                {
                  type: 'text',
                  text: this.validateTool.formatResponse(validateResult)
                }
              ]
            };

          case 'create_xmp_packet':
            const createResult = await this.createXmpTool.execute(args as any);
            return {
              content: [
                {
                  type: 'text',
                  text: this.createXmpTool.formatResponse(createResult)
                }
              ]
            };

          case 'create_metadata_report':
            const reportResult = await this.createReportTool.execute(args as any);
            return {
              content: [
                {
                  type: 'text',
                  text: this.createReportTool.formatSuccessResponse(reportResult)
                }
              ]
            };

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        console.error(`Tool execution error for ${name}:`, error);
        
        if (error instanceof McpError) {
          throw error;
        }
        
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      // Test Supabase connection
      const connectionTest = await this.supabaseClient.testConnection();
      if (!connectionTest) {
        console.error('⚠️ Warning: Supabase connection test failed. Check your environment variables.');
      }

      // Create transport and connect
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      // Log startup info to stderr (not stdout which is used for MCP communication)
      this.logStartupInfo();
      
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Log startup information to stderr
   */
  private logStartupInfo(): void {
    console.error('🚀 Simple ORBIT Metadata MCP Server v1.0.0');
    console.error('📍 Stream-based XMP processing with Supabase Storage');
    console.error('');
    console.error('🛠️ Available Tools:');
    console.error('   • embed_image_metadata    - Embed XMP metadata into images');
    console.error('   • read_image_metadata     - Extract XMP metadata from images');
    console.error('   • validate_metadata_schema - Validate metadata against schemas');
    console.error('   • create_xmp_packet       - Create standalone XMP packets');
    console.error('   • create_metadata_report  - Generate human-readable metadata reports');
    console.error('');
    console.error('🧬 Supported Schemas:');
    console.error('   • lifestyle - Social dynamics and cultural context');
    console.error('   • product   - Design aesthetics and commercial analysis');
    console.error('   • orbit     - Comprehensive visual intelligence');
    console.error('');
    console.error('☁️ Processing Method: Memory-only stream processing');
    console.error('📦 Storage: Supabase Storage integration');
    console.error('🔒 Security: Simplified validation (no security manager)');
    console.error('');
    console.error('✅ Server ready for Claude Desktop connections');
    console.error('💡 Waiting for MCP requests via stdio...');
  }

  /**
   * Handle graceful shutdown
   */
  private setupShutdownHandlers(): void {
    const shutdown = (signal: string) => {
      console.error(`\n🛑 Received ${signal}, shutting down gracefully...`);
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }
}

// Start the server if this file is run directly
async function main() {
  const server = new SimpleOrbitMCPServer();
  
  // Setup shutdown handlers
  server['setupShutdownHandlers']();
  
  try {
    await server.start();
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { SimpleOrbitMCPServer };