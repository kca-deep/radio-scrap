# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Development Rules

### 1. NO HARDCODING
- **NEVER** hardcode values (API keys, URLs, configurations, magic numbers, string literals used multiple times)
- Always use environment variables (`.env.local`, `.env`) for configuration
- Use constants/config files for repeated values
- Use TypeScript types/interfaces for data structures

### 2. MCP Tool Usage (MANDATORY)
Available MCP servers and their required usage. **ALWAYS prefer MCP tools over manual work.**

#### shadcn MCP (mcp__shadcn__*)
**REQUIRED for ALL UI changes involving shadcn/ui components**
- `search_items_in_registries` - Search for components before using
- `view_items_in_registries` - View component details and code
- `get_item_examples_from_registries` - Get usage examples
- `get_add_command_for_items` - Get CLI command to add components
- **NEVER manually copy/paste shadcn component code**
- **ALWAYS use shadcn MCP tools to discover and add components**

#### context7 MCP (mcp__context7__*)
**Use for library documentation**
- `resolve-library-id` - Find library ID before fetching docs
- `get-library-docs` - Fetch up-to-date documentation
- Use when working with Next.js, React, Tailwind, or other libraries

#### playwright MCP (mcp__playwright__*)
**Use for browser automation and testing**
- Available for E2E testing needs

#### IDE MCP (mcp__ide__*)
- `getDiagnostics` - Check TypeScript/ESLint errors
- `executeCode` - Run code in Jupyter notebooks (if needed)

#### sequential-thinking MCP (mcp__sequential-thinking__*)
**REQUIRED for complex problem-solving and planning**
- `sequentialthinking` - Use for breaking down complex problems
- **ALWAYS use when:**
  - Planning multi-step implementations
  - Debugging complex issues
  - Analyzing architecture decisions
  - Solving problems with uncertain scope
  - Making trade-off decisions
  - Refactoring large codebases
- Allows iterative thinking, revisions, and branching logic
- Generates verified hypotheses before implementation

### 3. Configuration Management
All configuration must be:
- Defined in `.env.local` (frontend) or `.env` (backend)
- Typed with TypeScript interfaces
- Validated at runtime
- Documented in this file under "Environment Variables"

### 4. Documentation File Policy
**DO NOT create unnecessary documentation files unless explicitly requested by the user.**
- **NEVER** proactively create markdown files (*.md), README files, or documentation
- **NEVER** create TODO lists, implementation plans, or architectural documents unless asked
- Code should be self-documenting with clear comments and type definitions
- Only create documentation files when:
  - User explicitly requests it (e.g., "create a README", "write documentation")
  - It's a critical project file (package.json, tsconfig.json, etc.)
  - Required by tooling (e.g., .env.example)
- Focus on writing clean, working code instead of documentation

### 5. NO EMOJIS POLICY
**ABSOLUTELY FORBIDDEN: Using emojis in any code or output.**
- **NEVER** use emojis in:
  - Python code (print statements, log messages, docstrings, comments)
  - TypeScript/JavaScript code (console.log, strings, comments)
  - Git commit messages
  - File names or directory names
  - API responses or error messages
  - Any user-facing text
- **REASON**: Emojis cause encoding errors on Windows systems (cp949 codec errors)
- Use plain text descriptions instead (e.g., "Starting" instead of "🚀 Starting")
- This is a critical rule - emoji-related encoding errors will crash the application

### 6. Windows PowerShell & Encoding Rules
**CRITICAL: This project runs on Windows with PowerShell. All scripts and code must handle Korean/UTF-8 properly.**

#### Shell Scripts (.ps1, .bat, .cmd)
- **ALWAYS** create PowerShell scripts (`.ps1`) instead of bash scripts (`.sh`)
- PowerShell syntax: `New-Item`, `Remove-Item`, `Copy-Item` (NOT `mkdir`, `rm`, `cp`)
- Set UTF-8 encoding at script start:
  ```powershell
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
  ```
- For batch files (`.bat`), add: `chcp 65001` at the top

#### Python File Encoding
- **ALWAYS** specify encoding when opening files with Korean text:
  ```python
  # CORRECT
  with open(file_path, 'r', encoding='utf-8') as f:
      content = f.read()

  with open(file_path, 'w', encoding='utf-8') as f:
      f.write(content)

  # WRONG - Will fail on Windows with Korean text
  with open(file_path, 'r') as f:  # ❌ Uses system default (cp949)
      content = f.read()
  ```

#### Python Print/Logging
- **NEVER** use emojis or special Unicode characters in print/log statements
- Use plain ASCII or properly escaped Korean:
  ```python
  # CORRECT
  print("Starting application...")
  logger.info("Processing article: 과기정통부 보도자료")

  # WRONG
  print("🚀 Starting...")  # ❌ Will crash on Windows
  ```

#### Environment-Specific Paths
- Use `Path` from `pathlib` for cross-platform compatibility:
  ```python
  from pathlib import Path

  # CORRECT
  file_path = Path("storage") / "attachments" / filename

  # WRONG
  file_path = "storage/attachments/" + filename  # ❌ Unix-style only
  ```

#### Git Bash Usage
- When using Bash tool for git commands, it's acceptable (git bash handles encoding)
- For file operations, prefer Python code or PowerShell
- Test all shell commands on Windows PowerShell before committing

## Project Overview

This is a Radio Policy Magazine automation system built with a Next.js 15 frontend and a planned FastAPI backend. The application automates web scraping of policy articles, translation (English → Korean), and HTML magazine generation/distribution.

**Architecture**: Full-stack monorepo
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- **Backend** (planned): FastAPI, Python 3.11+, SQLite
- **APIs**: Firecrawl (scraping), OpenAI GPT-4o (translation)

## Development Commands

### Frontend (Next.js)
```bash
npm run dev          # Development server with Turbopack (http://localhost:3000)
npm run build        # Production build with Turbopack
npm start            # Start production server
npm run lint         # ESLint with Next.js config
```

### Backend (FastAPI) - Planned
```bash
cd backend
uvicorn app.main:app --reload  # Development server (http://localhost:8000)
python -m pytest               # Run tests
```

## File Structure

```
/app                     # Next.js App Router pages
  /scrape                # URL upload & scraping UI
  /articles              # Article management (table view with filters)
  /translate/[jobId]     # Translation progress tracker
  /publish               # Magazine publishing & email sending
  /magazine/[id]         # Magazine viewer with attachments
  layout.tsx             # Root layout with Geist fonts
  globals.css            # Tailwind v4 theme (New York style, neutral base)

/components
  /ui                    # shadcn/ui components (add with: npx shadcn@latest add [name])

/lib
  utils.ts               # cn() utility for Tailwind class merging
  api-client.ts          # (planned) Backend API client
  types.ts               # (planned) Shared TypeScript types

/backend                 # (planned) FastAPI application
  /app
    main.py
    /api/routes          # REST endpoints (scrape, articles, translate, publish)
    /services            # Business logic (scraper, translator, html_generator)
    /models              # Pydantic models (Article, ScrapeJob, Publication)
    /templates           # Jinja2 templates for magazine HTML
    database.db          # SQLite database
    /storage/attachments # Downloaded article attachments
```

## Path Aliases

Use `@/*` for imports:
- `@/components` → `components/`
- `@/lib` → `lib/`
- `@/hooks` → `hooks/`
- `@/components/ui` → `components/ui/`

## Workflow & Architecture

### 3-Stage Pipeline
1. **Scraping** (`/scrape`)
   - Upload Excel with URL list (title, date, link, source)
   - Firecrawl API scrapes each URL → markdown + metadata
   - Auto-downloads attachments (PDFs, documents)
   - Saves to SQLite (status: `scraped`)

2. **Translation** (`/translate/[jobId]`)
   - Select articles → GPT-4o translates title + content (EN → KO)
   - Uses legacy `SYSTEM_PROMPT` from previous system
   - Updates SQLite (status: `translated`)

3. **Publishing** (`/publish`)
   - Select translated articles
   - Generate HTML magazine (Jinja2 template)
   - Send via email (SMTP/SendGrid) or download

### Database Schema (SQLite)

**articles**
- `id` (TEXT, PK), `url` (UNIQUE), `title`, `title_ko`
- `content` (markdown), `content_ko`
- `source`, `country_code` (KR/US/UK/JP), `published_date`
- `status` (scraped/translated), `scraped_at`, `translated_at`

**attachments**
- `id` (INT, PK), `article_id` (FK → articles)
- `filename`, `file_path`, `file_url`, `downloaded_at`

**scrape_jobs**
- `job_id` (PK), `status` (pending/processing/completed/failed)
- `total_urls`, `processed_urls`, timestamps

**publications**
- `id` (PK), `title`, `article_ids` (JSON array)
- `html_path`, `created_at`, `sent_at`

### API Endpoints (Backend - Planned)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scrape/upload` | Upload Excel → return job_id |
| POST | `/api/scrape/start` | Start Firecrawl scraping (background) |
| GET | `/api/scrape/status/{job_id}` | SSE progress stream |
| GET | `/api/articles` | List with filters (country, status, date) |
| GET | `/api/articles/{id}` | Single article + attachments |
| PATCH | `/api/articles/{id}` | Edit article |
| GET | `/api/attachments/{id}/download` | Download file |
| POST | `/api/translate/start` | Batch translate (background) |
| GET | `/api/translate/status/{job_id}` | SSE progress |
| POST | `/api/publish/html` | Generate magazine HTML |
| POST | `/api/publish/email` | Send email |
| GET | `/api/publish/{id}` | View published HTML |

## Key Services (Backend - Planned)

### `firecrawl_service.py`
- `scrape_url(url)` → markdown + metadata
- `download_attachments(url, selectors)` → save to `/storage/attachments`

### `translator.py`
- `translate_article(article)` → uses GPT-4o with legacy SYSTEM_PROMPT
- Preserves original translation logic from previous system

### `db_service.py`
- CRUD for articles, attachments, scrape_jobs, publications
- `get_articles()` always includes related attachments

### `html_generator.py`
- Uses Jinja2 templates (reuses legacy design)
- Embeds attachment links in magazine HTML

### `country_mapper.py`
- Maps source names to country codes
- Legacy logic: FCC/NTIA → US, Ofcom → UK, 総務省 → JP, 과기정통부 → KR

## Styling & Components

### Tailwind CSS v4
- **Theme**: CSS variables in `globals.css` (`:root` and `.dark`)
- **Base color**: Neutral
- **Fonts**: Geist Sans + Geist Mono (loaded in `layout.tsx`)
- Use `cn()` from `@/lib/utils` for conditional class merging

### shadcn/ui Configuration
- **Style**: New York
- **RSC**: Enabled
- **Icon library**: Lucide React
- **IMPORTANT**: Use shadcn MCP tools (`mcp__shadcn__search_items_in_registries`, `mcp__shadcn__get_add_command_for_items`) to add components
- Example workflow:
  1. Search for component: `mcp__shadcn__search_items_in_registries`
  2. View details: `mcp__shadcn__view_items_in_registries`
  3. Get add command: `mcp__shadcn__get_add_command_for_items`
  4. Run the returned CLI command

## Environment Variables

### Frontend (`.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend (`.env`) - Planned
```
FIRECRAWL_API_KEY=fc-...
OPENAI_API_KEY=sk-...
DATABASE_URL=sqlite:///./database.db
ATTACHMENT_DIR=./storage/attachments
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
```

## Implementation Status

**Current**: Frontend scaffolding with Next.js 15 + shadcn/ui setup

**Next steps** (see `prompts/implementation-plan.md`):
1. Backend FastAPI structure + SQLite schema
2. Firecrawl integration + attachment downloader
3. GPT translation service (port legacy logic)
4. Frontend UI components (URLUploader, ArticleTable, etc.)
5. SSE progress tracking
6. HTML generation + email service

## Additional Notes

- **Turbopack**: Used for both dev and production builds
- **Legacy compatibility**: Preserves translation logic and HTML templates from previous system
- **SSE**: Progress tracking for long-running scraping/translation jobs
- **Attachments**: Always fetched with articles for display in magazine viewer

## Development Workflow Examples

### Adding a New UI Component
```
1. Search for component:
   mcp__shadcn__search_items_in_registries(registries: ['@shadcn'], query: 'button')

2. View component details:
   mcp__shadcn__view_items_in_registries(items: ['@shadcn/button'])

3. Get installation command:
   mcp__shadcn__get_add_command_for_items(items: ['@shadcn/button'])

4. Run the CLI command returned
```

### Creating a New API Client Function
```typescript
// ❌ BAD - Hardcoded URL
export async function getArticles() {
  const res = await fetch('http://localhost:8000/api/articles');
  return res.json();
}

// ✅ GOOD - Uses environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function getArticles() {
  const res = await fetch(`${API_URL}/api/articles`);
  if (!res.ok) throw new Error('Failed to fetch articles');
  return res.json();
}
```

### Using Context7 for Library Documentation
```
1. Resolve library ID:
   mcp__context7__resolve-library-id(libraryName: 'next.js')

2. Get documentation:
   mcp__context7__get-library-docs(
     context7CompatibleLibraryID: '/vercel/next.js',
     topic: 'app router'
   )
```

### Using Sequential Thinking for Complex Problems
```
Use mcp__sequential-thinking__sequentialthinking when:

Example 1: Planning a new feature
- Break down implementation into steps
- Consider dependencies and order
- Identify potential issues early
- Revise approach as understanding deepens

Example 2: Debugging a complex issue
- Analyze symptoms systematically
- Generate hypotheses
- Test each hypothesis
- Revise based on findings

Example 3: Architecture decisions
- Evaluate multiple approaches
- Consider trade-offs (performance vs maintainability)
- Document reasoning for future reference
- Verify solution meets requirements
```

### Problem-Solving Workflow
```
1. Encounter complex problem
   ↓
2. Use sequential-thinking MCP to:
   - Break down the problem
   - Explore solution space
   - Generate hypothesis
   - Verify hypothesis
   ↓
3. Implement solution with confidence
   ↓
4. Use IDE MCP to check for errors
   ↓
5. Test and validate
```
