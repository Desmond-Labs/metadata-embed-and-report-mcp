# Contributing to Image Metadata Embed and Report

Thank you for your interest in contributing to this project! We welcome contributions from the community.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/image-metadata-embed-and-report.git`
3. Install dependencies: `npm install`
4. Set up your environment by copying `.env.example` to `.env` and configuring your Supabase credentials
5. Build the project: `npm run build`

## Development Workflow

1. Create a new branch for your feature: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Build and test your changes: `npm run build && npm run test`
4. Commit your changes: `git commit -m "feat: add your feature"`
5. Push to your fork: `git push origin feature/your-feature-name`
6. Create a Pull Request

## Code Style

- We use TypeScript for type safety
- Follow existing code conventions in the project
- Use meaningful variable and function names
- Add comments for complex logic

## Testing

Before submitting a PR:
- Ensure `npm run build` completes without errors
- Run tests with `npm run test` (requires configured .env file)
- Test your changes with a real Supabase project if possible

## Pull Request Guidelines

- Provide a clear description of your changes
- Reference any related issues
- Include tests for new functionality
- Update documentation as needed
- Keep PRs focused and atomic

## Reporting Issues

When reporting issues, please include:
- Node.js version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Any error messages

## Project Structure

```
src/
├── core/           # Core functionality (XMP processing, image conversion, etc.)
├── tools/          # MCP tools (embed, read, validate, create_xmp, create_report)
├── types/          # TypeScript type definitions
└── server.ts       # Main MCP server
```

## Areas for Contribution

- Bug fixes
- Performance improvements  
- New XMP schema support
- Enhanced error handling
- Documentation improvements
- Test coverage expansion

Thank you for contributing!