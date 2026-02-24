# Contributing to DevFunding

Thank you for your interest in contributing to DevFunding! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to foster an open and welcoming environment.

## Development Workflow

### 1. Fork and Clone

```bash
# Fork the repository on GitHub
# Clone your fork locally
git clone https://github.com/YOUR_USERNAME/devfunding-stacks.git
cd devfunding-stacks

# Add upstream remote
git remote add upstream https://github.com/developerfred/devfunding-stacks.git
```

### 2. Create a Branch

```bash
# Create a feature branch
git checkout -b feat/feature-name

# Or bug fix branch
git checkout -b fix/issue-description
```

### 3. Make Changes

Follow the project's coding standards:

- **TypeScript**: For test files and tooling
- **Clarity**: For smart contracts
- **Markdown**: For documentation

### 4. Test Your Changes

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:core    # Core contract tests
npm run test:token   # Token contract tests
npm run test:escrow  # Escrow contract tests

# Run linting and formatting
npm run pre-commit
```

### 5. Commit Your Changes

Use conventional commit messages:

```bash
git commit -m "feat: add new grant category support
- Add category field to grant creation
- Update tests for new functionality
- Update API documentation
Fixes #123"
```

**Commit Message Format:**
```
<type>: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semi-colons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### 6. Push and Create Pull Request

```bash
git push origin feat/feature-name
```

Then create a Pull Request on GitHub with:
- Clear description of changes
- Reference to related issues
- Screenshots if applicable

## Pull Request Requirements

### Checklist
- [ ] All tests pass (`npm test`)
- [ ] Code passes linting (`npm run lint`)
- [ ] Code is properly formatted (`npm run format:check`)
- [ ] TypeScript compilation passes (`npx tsc --noEmit`)
- [ ] Documentation is updated
- [ ] No new linting warnings introduced
- [ ] Follows existing code patterns

### Review Process
1. Automated checks run (CI pipeline)
2. Maintainers review code
3. Address review comments
4. Merge when approved

## Coding Standards

### TypeScript/JavaScript
- Use TypeScript for all new test files
- Follow ESLint configuration rules
- Use Prettier formatting
- Add meaningful comments for complex logic
- Avoid `any` type - use specific types

### Clarity Smart Contracts
- Follow existing contract patterns
- Use descriptive function names
- Add comprehensive error handling
- Include audit comments (English preferred)
- Follow security best practices

### Documentation
- Update README.md for user-facing changes
- Update API.md for contract changes
- Add inline code comments
- Use clear, concise language

## Development Environment

### Prerequisites
- Node.js 18+
- npm 8+
- Clarinet (for contract development)
- Git

### Setup
```bash
# Install dependencies
npm install

# Verify setup
npm test
npx clarinet check
```

### Testing
- Write tests for all new functionality
- Maintain or improve test coverage
- Test edge cases and error conditions
- Use descriptive test names

### Debugging
```bash
# Run tests with debug output
npm run test:watch

# Check contract syntax
npx clarinet check

# Analyze contract costs
npx clarinet costs
```

## Issue Guidelines

### Reporting Bugs
1. Use the bug report template
2. Include steps to reproduce
3. Add expected vs actual behavior
4. Include environment details
5. Add relevant logs or screenshots

### Feature Requests
1. Use the feature request template
2. Describe the problem you're solving
3. Propose a solution
4. List alternatives considered
5. Explain benefits and impact

## Security Considerations

### Smart Contract Security
- Never introduce security vulnerabilities
- Follow audit recommendations
- Test thoroughly before deployment
- Consider edge cases and attack vectors

### Code Security
- Don't commit secrets or private keys
- Use secure coding practices
- Validate all inputs
- Handle errors gracefully

## Getting Help

### Resources
- [Stacks Documentation](https://docs.stacks.co)
- [Clarity Language Reference](https://docs.stacks.co/reference/clarity)
- [Clarinet Documentation](https://docs.hiro.so/clarinet)

### Communication
- GitHub Issues for bug reports and feature requests
- Pull Request discussions for code reviews
- Follow project maintainers' guidance

## Recognition

Contributors will be recognized in:
- Project README (for significant contributions)
- Release notes
- GitHub contributors list

## License

By contributing to DevFunding, you agree that your contributions will be licensed under the project's MIT License.

---

Thank you for contributing to making DevFunding better!