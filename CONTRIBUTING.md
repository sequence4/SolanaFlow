# CONTRIBUTING

## Table of Contents

1. [Code of Conduct](#code-of-conduct)  
2. [Development Workflow](#development-workflow)  
   1. [Getting Started](#getting-started)  
   2. [Branch Naming](#branch-naming)  
   3. [Commit Messages](#commit-messages)  
   4. [Pull Requests](#pull-requests)  
3. [Coding Style and Standards](#coding-style-and-standards)  
4. [Reporting Issues and Bugs](#reporting-issues-and-bugs)  
5. [Suggesting Features](#suggesting-features)  
6. [License](#license)

---

## 1. Code of Conduct

Please note that all contributors are expected to uphold our standards of conduct. Treat everyone with respect and courtesy.

- Be professional and constructive in your discussions.  
- Avoid personal attacks and unproductive commentary.  
- If you find conduct that violates these standards, please report it via an appropriate channel (e.g., direct contact with a maintainer or project owner).

---

## 2. Development Workflow

### 2.1 Getting Started

1. **Clone the Repository**  
   Make sure you have the correct access and URL to this private repository, then clone it locally:
   ```bash
   git clone https://github.com/hhdgknsn/solana-flowcode.git
   ```

2. **Install Dependencies**  
   At the monorepo root, install all required packages:
   ```bash
   pnpm install
   ```
   For more details on directory structure and environment variables, refer to the [README.md](./README.md) file.

### 2.2 Branch Naming

The project maintains two protected branches:
- **main** (production)
- **develop** (development)

All feature work should be done on dedicated feature branches. We follow a simplified feature-branch workflow, with descriptive branch names:

- **feat/** for new features  
  Example: `feat/support-multiple-languages`

- **fix/** for bug fixes  
  Example: `fix/login-redirect-issue`

- **chore/** for routine tasks and maintenance  
  Example: `chore/update-dependencies`

- **docs/** for documentation updates  
  Example: `docs/add-contributing-guidelines`

- **refactor/** for refactoring code without changing functionality  
  Example: `refactor/improve-auth-controller-structure`

- **test/** for testing additions/improvements  
  Example: `test/add-server-integration-tests`

- **hotfix/** for critical fixes that need immediate release  
  Example: `hotfix/security-patch`

> **Note**: Use lowercase letters and hyphens between words for clarity. Keep branch names concise but descriptive.

### 2.3 Commit Messages

We use a convention inspired by [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). This provides readability and easy parsing of commits. Each commit message should include:

```
type(scope): Subject line (imperative, lower-case)
```

Where:
- **type** is one of:
  - **feat**: A new feature
  - **fix**: A bug fix
  - **chore**: Changes to build processes or auxiliary tools
  - **docs**: Documentation only changes
  - **refactor**: A code change that neither fixes a bug nor adds a feature
  - **test**: Adding or correcting tests
  - **style**: Changes that do not affect meaning of the code (white-space, formatting, missing semi-colons, etc.)
  - **perf**: A code change that improves performance

- **scope** is optional, but if used, should be the feature or section of the codebase being affected (e.g., `client`, `server`, `api`, `auth`).

- **Subject line** should be written in the imperative mood (e.g., "fix login redirect issue," not "fixed").

**Examples**:
- `feat(client): add language selector to settings page`
- `fix(server): resolve null pointer exception in user model`
- `docs: update README with environment variable details`

### 2.4 Pull Requests

1. **Sync with develop**  
   Before opening a Pull Request (PR), ensure your local `develop` branch is up-to-date:
   ```bash
   git checkout develop
   git pull origin develop
   ```
   Then create or switch to your feature branch and do your work.

2. **Push Your Branch**  
   After committing your changes, push them:
   ```bash
   git push -u origin <branch-name>
   ```

3. **Create a PR**  
   - Open a Pull Request in GitHub, targeting the `develop` branch (or `main` when appropriate).  
   - Provide a **clear title** and **detailed description** of the changes in your PR. Reference any related issues if they exist (e.g., `Closes #45`).

4. **Code Reviews**  
   - One or more maintainers will review your changes.  
   - You may be asked to make revisions. Please update your PR accordingly and push more commits to your feature branch.  
   - Maintain open communication with reviewers to resolve outstanding questions or suggestions quickly.

5. **Merge**  
   - Since main and develop are protected, a maintainer will finalize the merge once your changes pass review.
   - Typically, at least one reviewer approval is required before the merge can proceed.

---

## 3. Coding Style and Standards

- **TypeScript**: The repository uses TypeScript for both client (Next.js) and server (Express). Follow the existing patterns and conventions.  
- **Linting and Formatting**:  
  - Before opening a PR, please run the linter using:
    ```bash
    pnpm lint --filter client
    pnpm lint --filter server
    ```
  - Fix any warnings or errors reported.  
- **Testing**:  
  - If you add or modify functionality, include or update tests where relevant:
    ```bash
    pnpm test --filter client
    pnpm test --filter server
    ```

---

## 4. Reporting Issues and Bugs

If you encounter a bug or unexpected behavior, please open an issue on GitHub with:

- **Detailed Description**: Steps to reproduce, expected vs. actual behavior.  
- **Version/Environment Info**: Node.js, PNPM, OS, or any relevant version details.  
- **Relevant Logs/Trace**: Provide console output, stack traces, or screenshots if possible.

The more information you provide, the easier it is to diagnose and resolve the issue.

---

## 5. Suggesting Features

We welcome feature requests! To suggest a new feature:

1. **Check Existing Issues**: Make sure your idea hasn’t already been proposed.  
2. **Open a New Issue**: Describe the feature, potential benefits, and any examples or references.

Maintainers will review and tag the request. If deemed appropriate, it may be added to a milestone for future development.

---

## 6. License

This repository does not currently have a finalized license. If you have any questions regarding usage rights or future licensing details, please reach out to the repository owner.

---

Thank you again for your interest in improving this project. We look forward to your contributions!