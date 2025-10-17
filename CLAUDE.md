# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 application using the App Router architecture with React 19, TypeScript, and Tailwind CSS v4. The project is configured with shadcn/ui components (New York style) and uses Turbopack for development and builds.

## Development Commands

### Development Server
```bash
npm run dev
```
Starts the Next.js development server with Turbopack at http://localhost:3000

### Build
```bash
npm run build
```
Creates an optimized production build using Turbopack

### Start Production Server
```bash
npm start
```
Runs the production server (requires a build first)

### Linting
```bash
npm run lint
```
Runs ESLint with Next.js configurations (core-web-vitals + TypeScript)

## Architecture

### File Structure
- `app/` - Next.js App Router directory containing pages and layouts
  - `layout.tsx` - Root layout with Geist fonts (sans and mono)
  - `page.tsx` - Home page component
  - `globals.css` - Global Tailwind CSS styles
- `lib/` - Utility functions
  - `utils.ts` - Contains the `cn()` utility for merging Tailwind classes
- `components/` - React components (shadcn/ui components will be added here)
  - `ui/` - shadcn/ui components

### Path Aliases
The project uses `@/*` as an alias for the root directory:
- `@/components` - Components directory
- `@/lib` - Library/utilities directory
- `@/lib/utils` - Utils file
- `@/components/ui` - UI components
- `@/hooks` - Custom hooks

### Styling
- **Tailwind CSS v4** with Tailwind Animate plugin
- **CSS Variables** enabled for theming
- **Base color**: Neutral
- Custom fonts: Geist Sans and Geist Mono (loaded via next/font/google)
- Use the `cn()` utility from `@/lib/utils` for conditional class merging

### shadcn/ui Configuration
- **Style**: New York
- **RSC**: Enabled (React Server Components)
- **Icon Library**: Lucide React
- Components are added to `components/ui/`
- To add components: `npx shadcn@latest add [component-name]`

### TypeScript Configuration
- Target: ES2017
- Strict mode enabled
- Module resolution: bundler
- JSX: preserve (handled by Next.js)

## Key Dependencies

- **next**: 15.5.6 (with Turbopack support)
- **react**: 19.1.0
- **tailwindcss**: v4
- **class-variance-authority**: For variant-based component APIs
- **lucide-react**: Icon library for shadcn/ui components
- **tailwind-merge**: Used in `cn()` utility for class merging
- **clsx**: Used in `cn()` utility for conditional classes
