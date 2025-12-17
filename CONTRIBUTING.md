# Contributing to MovaLab

Thank you for your interest in contributing to MovaLab! This document provides guidelines for contributing to the project.

## Ways to Contribute

- **Bug Reports**: Found something broken? Open an issue with details
- **Feature Requests**: Have an idea? We'd love to hear it
- **Code Contributions**: Fix bugs or implement new features
- **Documentation**: Improve docs, fix typos, add examples
- **Testing**: Help test new features and report issues

## Development Setup

### Prerequisites

- Node.js 18.0 or higher
- npm, pnpm, yarn, or bun
- Supabase account (free tier works)
- Git

### Getting Started

1. **Fork the repository** on GitHub

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/MovaLab.git
   cd MovaLab
   ```

3. **Install dependencies**
   ```bash
   bun install
   # or: npm install
   ```

4. **Set up environment variables**

   Create `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

5. **Start the development server**
   ```bash
   bun run dev
   # or: npm run dev
   ```

6. **Open** [http://localhost:3000](http://localhost:3000)

## Code Style

- **TypeScript**: All code should be written in TypeScript with proper types
- **Formatting**: Follow existing code patterns in the codebase
- **Components**: Use functional components with hooks
- **Naming**: Use descriptive names for variables, functions, and components

## Pull Request Process

1. **Create a branch** for your changes
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** with clear, focused commits

3. **Test your changes** locally

4. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Open a Pull Request** against the `main` branch

6. **Describe your changes** clearly in the PR description

### PR Requirements

- Provide a clear description of what changed and why
- Ensure the build passes (`npm run build`)
- Test your changes thoroughly
- Keep PRs focused on a single change when possible

## Reporting Issues

When reporting bugs, please include:

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Browser/OS information if relevant
- Screenshots if applicable

## Feature Requests

When requesting features:

- Describe the problem you're trying to solve
- Explain your proposed solution
- Consider alternatives you've thought about
- Provide context on how it would be used

## Questions?

- Open a GitHub Discussion for general questions
- Check existing issues before creating new ones
- Be patient - maintainers are volunteers

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
