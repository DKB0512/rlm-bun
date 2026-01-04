# Contributing to rlm-bun

Thank you for your interest in contributing! This document provides guidelines for contributing to the rlm-bun project.

## How to Contribute

### Reporting Bugs

1. Check existing issues to avoid duplicates
2. Create a new issue with:
   - Clear title describing the bug
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (Bun version, Node.js version, OS)

### Suggesting Features

1. Check existing feature requests
2. Create a new issue with:
   - Clear description of the feature
   - Use cases and benefits
   - Possible implementation approach (if known)

### Submitting Code Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature-name`)
3. Make your changes following the code style
4. Write tests if applicable
5. Commit with clear messages
6. Push to your fork
7. Open a Pull Request

### Code Style

- Follow TypeScript best practices
- Keep functions small and focused
- Add JSDoc comments for public functions
- Run `bun run --filter index.ts typecheck` before committing (if available)

## Pull Request Guidelines

- Keep PRs focused on a single issue
- Update documentation if needed
- Ensure all tests pass
- Respond to review feedback promptly

## Questions?

Feel free to open an issue with the "question" label.
