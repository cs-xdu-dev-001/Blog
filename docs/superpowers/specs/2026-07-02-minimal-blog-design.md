# Minimal Blog Design

Date: 2026-07-02

## Goal

Build a high-quality personal technical blog with a strict minimalist visual style. The first version should feel like a carefully typeset publication rather than a Hugo theme or generic template.

The site will be hand-built with Astro and TailwindCSS. Existing Notion notes will be整理 into 3-5 initial articles.

## Non-Goals

- Do not use Hugo or a prebuilt blog theme.
- Do not connect to Notion as a live CMS in the first version.
- Do not add a backend, admin panel, comments, accounts, or subscriptions.
- Do not introduce a general-purpose UI component library.
- Do not add complex animation. Keep only refined micro-interactions.

## Audience

The primary reader is someone browsing concise technical practice notes, deployment records, and personal learning writeups. The site should prioritize reading, scanning, and credibility.

## Content Scope

Initial posts will be adapted from local Notion notes:

- Hugo部署
- 网站上线
- 网站更新
- CI/CD博客
- 爬个人博客

The notes should not be copied raw. Each article should be rewritten into a consistent blog format:

- Title
- Date
- Category
- Short description
- Structured body
- Code blocks where useful
- Clear closing notes when the original content is operational or partial

## Pages

### Home

The home page introduces the author and presents the blog as a minimalist technical writing space.

Required sections:

- Small metadata line
- Large editorial headline
- Short description
- Featured article list
- Recent writing list
- Minimal footer

### Writing

The writing page lists all posts in an index-like layout.

Each row includes:

- Index number
- Date
- Category
- Title
- Short description

Rows use dividers and grid alignment, not card shadows.

### Article Detail

The article page prioritizes long-form reading.

Required elements:

- Title
- Date and category
- Optional description
- Body content
- Code block styling
- Back link to writing index

Reading width should stay near 720-800px on desktop.

### About

The about page is short and restrained.

Content:

- Who the site is for
- Current interests
- Optional links for GitHub, email, or RSS; hide any link that has no real value yet

## Visual Direction

The visual system follows the provided Minimalism UI reference:

- White background
- Black primary text
- Neutral gray hierarchy
- No decorative gradients, shadows, blobs, or ornamental illustrations
- Layout driven by typography, whitespace, and grid
- Accent color used rarely, only for links or focus states

## Layout System

Use a 12-column grid on desktop:

- `grid-template-columns: repeat(12, 1fr)`
- Desktop gap: 32px
- Tablet/mobile gap: 24px or less as needed
- Content should occupy about 40-50% of the horizontal space on desktop
- Whitespace should occupy about 50-60%

Spacing uses an 8px base scale:

- 8px
- 16px
- 24px
- 32px
- 48px
- 64px
- 96px

Main page padding:

- Desktop: 64px horizontal or vertical where appropriate
- Mobile: 24-32px

## Typography

Font stack:

```css
Inter, "Helvetica Neue", "SF Pro Display", Arial, sans-serif
```

Type scale:

- Hero title: 48-72px, weight 300 or 700, letter-spacing -0.02em
- Section title: 24-36px, weight 400
- Body: 16-18px, line-height 1.8, letter-spacing 0.02em
- Meta text: 12-14px, light weight, gray

Typography is the primary visual device. Avoid oversized cards or decorative surfaces.

## Color System

Primary:

- Black: `#000000`
- White: `#ffffff`

Text hierarchy:

- `#1a1a1a`
- `#2d2d2d`
- `#404040`
- `#666666`
- `#808080`
- `#999999`

Lines and surfaces:

- `#cccccc`
- `#e5e5e5`
- `#f5f5f5`

Accent:

- Link blue: `#0066ff`, used sparingly
- Red: `#ff0000`, only for destructive or warning states if such states exist later

## Interaction

Interactions must stay subtle:

- Link hover changes color or opacity.
- Article row hover changes border color or text color.
- Buttons may invert black and white.
- Transitions use `transition: all 0.3s ease`.
- Avoid scale, bounce, parallax, large translation, or scroll-jacking.

Focus states must remain visible for keyboard users.

## Technical Architecture

Use:

- Astro
- TailwindCSS
- TypeScript
- Markdown or MDX content files
- Astro Content Collections for post metadata

Suggested structure:

```text
src/
  components/
    Header.astro
    ArticleIndex.astro
    MinimalFooter.astro
  layouts/
    BaseLayout.astro
    ArticleLayout.astro
  pages/
    index.astro
    writing.astro
    about.astro
    posts/[slug].astro
  content/
    posts/
      hugo-deploy.md
      website-launch.md
      website-update.md
      ci-cd-blog.md
      crawl-personal-blog.md
  styles/
    global.css
```

## Component Boundaries

`BaseLayout.astro`

- HTML shell
- Shared metadata
- Global header and footer
- Main container structure

`ArticleLayout.astro`

- Article title area
- Metadata display
- Markdown content styling
- Back navigation

`Header.astro`

- Minimal text navigation
- Links: Home, Writing, About

`ArticleIndex.astro`

- Reusable article list layout
- Supports featured and full index variants

`MinimalFooter.astro`

- Copyright
- Small links

## Validation

Before implementation is considered complete:

- Start the local dev server.
- Check home, writing, about, and at least one article page.
- Run the production build.
- Inspect desktop and mobile layouts with browser screenshots.
- Verify text does not overflow, overlap, or collapse on mobile.
- Confirm the page still reads as minimalist: no shadows, no decorative gradients, no component-library defaults.

## Open Decisions

None. The first version will prioritize a polished static blog with local Markdown content.
