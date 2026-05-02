# Contributing to Question Paper Generator

Thank you for your interest in contributing to the Question Paper Generator! This document provides guidelines and instructions for contributing.

## 🌟 Ways to Contribute

- 🐛 **Report bugs** - Help us identify and fix issues
- ✨ **Suggest features** - Share ideas for improvements
- 📝 **Improve documentation** - Fix typos, clarify instructions, add examples
- 💻 **Submit code** - Fix bugs, add features, improve performance
- 🧪 **Test** - Try the app with different PDFs and report issues
- 🎨 **Design** - Suggest UI/UX improvements

## 🚀 Getting Started

### Prerequisites

- Node.js 16+ and pnpm (or npm)
- Git
- Code editor (VS Code recommended)
- Basic knowledge of React and TypeScript

### Development Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/question-paper-generator.git
   cd question-paper-generator
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/question-paper-generator.git
   ```

4. **Install dependencies**
   ```bash
   pnpm install
   ```

5. **Start development server**
   ```bash
   pnpm run dev
   ```

6. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 📋 Contribution Guidelines

### Code Style

- **TypeScript**: Use TypeScript for all new code
- **Formatting**: Follow existing code style (use Prettier if available)
- **Naming**: Use descriptive variable and function names
- **Comments**: Add comments for complex logic, not obvious code

### File Organization

```
src/
├── app/
│   ├── components/      # Reusable React components
│   ├── pages/          # Page-level components
│   ├── services/       # Business logic and API calls
│   └── ...
```

- Keep components focused and single-responsibility
- Extract complex logic into service files
- Place UI components in `components/ui/`
- Place page components in `pages/`

### Commit Messages

Use clear, descriptive commit messages:

```bash
# Good ✅
git commit -m "Add support for multiple answer MCQs"
git commit -m "Fix PDF extraction for scanned documents"
git commit -m "Update LM Studio connection error messages"

# Bad ❌
git commit -m "fix bug"
git commit -m "changes"
git commit -m "wip"
```

Format:
- Use present tense ("Add feature" not "Added feature")
- First line should be under 72 characters
- Add detailed description if needed (after blank line)

### Testing

Before submitting:

1. **Test your changes** with different scenarios
2. **Try different PDFs** (small, large, various formats)
3. **Test with LM Studio** enabled and disabled
4. **Check browser console** for errors
5. **Test on different browsers** if UI changes
6. **Verify existing features** still work

### Pull Request Process

1. **Update documentation** if needed
   - Update README.md for new features
   - Add comments to complex code
   - Update LM_STUDIO_SETUP.md for LM Studio changes

2. **Test thoroughly**
   - Verify your changes work
   - Check for console errors
   - Test edge cases

3. **Commit your changes**
   ```bash
   git add .
   git commit -m "Description of changes"
   ```

4. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Open a Pull Request**
   - Go to the original repository on GitHub
   - Click "New Pull Request"
   - Select your fork and branch
   - Fill out the PR template
   - Submit!

### Pull Request Template

When opening a PR, please include:

```markdown
## Description
Brief description of what this PR does

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How did you test this?
- [ ] Tested with small PDFs
- [ ] Tested with large PDFs
- [ ] Tested with LM Studio
- [ ] Tested without LM Studio
- [ ] Checked browser console

## Screenshots
If applicable, add screenshots

## Checklist
- [ ] Code follows project style
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No console errors
- [ ] Tested in multiple browsers
```

## 🐛 Reporting Bugs

### Before Reporting

1. **Search existing issues** - Someone may have reported it already
2. **Try latest version** - Bug might be fixed in newer version
3. **Check browser console** - Look for error messages
4. **Test in different browser** - Might be browser-specific

### Bug Report Template

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. Upload PDF '...'
4. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- Browser: [e.g. Chrome 120]
- OS: [e.g. macOS 14.0]
- App version: [e.g. 1.0.0]
- LM Studio: [enabled/disabled]

**Console Errors**
Any errors from browser console (F12).

**Additional context**
Any other relevant information.
```

## 💡 Suggesting Features

### Feature Request Template

```markdown
**Is your feature related to a problem?**
Describe the problem you're trying to solve.

**Describe the solution**
What would you like to happen?

**Describe alternatives**
Other solutions you've considered.

**Use cases**
How would this feature be used?

**Additional context**
Any other relevant information, mockups, or examples.
```

## 🎯 Priority Areas

We're especially interested in contributions for:

1. **Question Quality**
   - Better prompt engineering for LM Studio
   - Improved content analysis algorithms
   - New question type templates

2. **PDF Processing**
   - Support for scanned PDFs (OCR)
   - Better handling of images and diagrams
   - Improved table extraction

3. **UI/UX**
   - Better mobile responsiveness
   - Accessibility improvements
   - Dark mode support

4. **Features**
   - Export to Word/PDF
   - Answer key generation
   - Question difficulty estimation
   - Multi-language support

5. **Documentation**
   - Video tutorials
   - More examples
   - Better troubleshooting guides

## 📝 Code of Conduct

### Our Standards

- **Be respectful** - Treat everyone with respect
- **Be constructive** - Provide helpful feedback
- **Be patient** - Everyone was new once
- **Be collaborative** - Work together towards better solutions

### Unacceptable Behavior

- Harassment or discrimination
- Trolling or insulting comments
- Personal attacks
- Publishing others' private information
- Other unprofessional conduct

## 🤝 Community

- **Questions?** Open a GitHub Discussion
- **Ideas?** Share in GitHub Discussions or Issues
- **Help?** Check existing issues or ask in Discussions

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

Contributors will be:
- Added to README acknowledgments
- Mentioned in release notes (for significant contributions)
- Invited to become maintainers (for ongoing contributions)

---

Thank you for contributing to making education better! 🎓
