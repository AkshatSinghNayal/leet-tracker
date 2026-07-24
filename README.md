# LeetCode Question Tracker

Track, filter, and conquer LeetCode questions — 100% client-side, deployable to Vercel with zero config.

Upload your LeetCode CSV(s), organize them into **named sheets** (e.g. `DP`, `Arrays`, `Graphs`), then filter by title / difficulty / frequency / acceptance, sort any column, mark questions as solved, and watch your progress by difficulty. All data lives in your browser's `localStorage` — no account, no backend, no tracking.

Built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS v4**, **shadcn/ui**, **papaparse**, and the **Geist** font. Visual style: GitHub × Linear × Vercel dark monochrome.

---

## Features

### Multi-sheet support (new!)
- Upload multiple CSVs as separate **sheets**, each with its own alias (e.g. `DP`, `Arrays`, `Graphs`)
- Switch between sheets via a tab strip below the header
- Each sheet tracks its own question list **and its own solved state** — progress is independent per topic
- **Rename** any sheet inline (click the pencil icon on hover)
- **Delete** sheets with a two-click confirm (trash icon → checkmark to confirm)
- **Replace** an existing sheet's questions from a new CSV — solved state is preserved for any IDs that still exist in the new CSV
- Active sheet is persisted across reloads
- The `+` button in the tab strip opens the upload dialog to create a new sheet
- **Legacy migration**: if you have data from the previous single-CSV version, it's auto-converted into a sheet named `Imported` on first load

### CSV upload (via dialog)
- Click "Upload CSV" in the header (or the `+` button on the tab strip) to open the upload dialog
- Drag-and-drop or click-to-browse file picker
- Validates the header row against the expected schema
- Parses `%`-suffixed numeric fields into sortable floats
- Two-step flow: pick file → configure (alias + create-new vs replace-existing)
- Persists parsed data to `localStorage` so it survives refresh
- "Clear all" action in the header wipes every sheet

### Question table
- Columns: Solved checkbox, ID, Title (link to LeetCode, opens in new tab), Difficulty badge, Acceptance %, Frequency % (with mini progress bar)
- Sortable by Title, Difficulty, Acceptance %, Frequency % — click any header to toggle asc/desc
- Paginated — 25 / 50 / 100 rows per page (default 50)
- Subtle hover highlight, no zebra striping, 1px row borders — Linear-style density

### Filters (sidebar)
- **Title search** — case-insensitive substring match, debounced via React state
- **Difficulty** — multi-select pill chips (Easy / Medium / Hard), OR within this filter
- **Frequency %** — dual-handle range slider **plus** quick-select preset chips (100% / 75% / 50% / 25%) for the dataset's discrete frequency tiers
- **Acceptance %** — dual-handle range slider (nice-to-have)
- **Solved toggle** — All / Solved / Unsolved
- All filter groups combine with **AND** across groups, **OR** within groups
- Each active filter renders as a removable chip in an "Active filters" row above the table, with a single "Clear all" action
- Sidebar is sticky on desktop, collapses to a slide-over drawer on mobile

### Progress tracking
- Per-row "Solved" checkbox — persisted to `localStorage` keyed by question ID **within the sheet** (survives CSV re-uploads as long as IDs match)
- Stats bar showing total / solved / solved % overall and per difficulty (Easy / Medium / Hard) — scoped to the active sheet
- Filter the table by Solved / Unsolved / All

### UI/UX
- **Dark / light theme toggle** — defaults to dark, choice persisted to `localStorage`
- GitHub × Linear × Vercel monochrome aesthetic: flat surfaces, 1px borders, no shadows/gradients, tight spacing
- Geist font (with IBM Plex Sans + system-ui fallback)
- Custom CSS variables for all semantic colors — same accent / green / yellow / red in both themes, only background / card / text / muted / border invert
- Empty state with clear CTA and expected CSV format
- Loading state while parsing large CSVs
- "Showing X of Y questions" count above the table

---

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 + shadcn/ui primitives (Radix UI under the hood) |
| Font | Geist (via `geist` package) |
| CSV parsing | `papaparse` (client-side only) |
| State | React state + `localStorage` — no Redux, no Zustand, no backend |
| Theme | `next-themes` |
| Notifications | `sonner` |
| Icons | `lucide-react` |

> The code is also forward-compatible with Next.js 15 / 16 — if you upgrade, only the `next` and `react` versions in `package.json` need bumping.

---

## Getting started (local development)

### Prerequisites
- Node.js 18.18+ or 20+
- npm / pnpm / yarn / bun — any works

### Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for production

```bash
npm run build
npm run start
```

### Lint

```bash
npm run lint
```

---

## CSV format

The CSV must have the following columns **in this exact order** with these exact headers:

```csv
ID,URL,Title,Difficulty,Acceptance %,Frequency %
1,https://leetcode.com/problems/two-sum,Two Sum,Easy,57.5%,100.0%
2,https://leetcode.com/problems/add-two-numbers,Add Two Numbers,Medium,48.5%,75.0%
```

| Column | Type | Notes |
| --- | --- | --- |
| `ID` | number | Used as the key for "Solved" state persistence |
| `URL` | string | Link to the LeetCode problem (opens in new tab) |
| `Title` | string | Displayed in the table; used for title search |
| `Difficulty` | `Easy` \| `Medium` \| `Hard` | Case-sensitive |
| `Acceptance %` | string with trailing `%` | e.g. `57.5%` — parsed to float for sorting / range filter |
| `Frequency %` | string with trailing `%` | e.g. `100.0%` — parsed to float; rounds to nearest integer for preset chip matching |

A sample CSV (`public/sample-leetcode.csv`) with ~665 real LeetCode questions is included.

### Validation
- Header mismatch → clear error toast
- Rows missing required fields or with invalid difficulty / non-numeric percentages are silently skipped; a toast reports how many rows were skipped
- Empty CSV → "No valid rows" error

---

## Data persistence

| Key | Contents |
| --- | --- |
| `question-tracker-sheets` | `Sheet[]` — array of `{ id, name, questions, solvedIds, createdAt, updatedAt }` |
| `question-tracker-active-sheet` | `string` — id of the currently selected sheet |
| `question-tracker-theme` | `"dark"` or `"light"` |

All keys are namespaced. "Clear all" wipes every sheet + active-sheet pointer. Theme preference is independent of data and survives clears.

### Legacy migration
If `question-tracker-data` (the old single-CSV format) is present on first load, it's auto-migrated into a single sheet named `Imported` and the old keys are removed. No data loss when upgrading.

---

## Deploy to Vercel

### Option 1 — One-click via GitHub import (recommended)

1. Push this project to a GitHub repository.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. Vercel auto-detects Next.js — accept all defaults.
4. Click **Deploy**.

That's it. No env vars, no backend, no database to provision.

### Option 2 — Vercel CLI

```bash
npm install -g vercel
vercel          # preview deployment
vercel --prod   # production deployment
```

### Option 3 — Build & run as a Node server

```bash
npm run build
npm run start
```

The app is a standard Next.js App Router project — there is nothing exotic about the deployment. Any static-friendly host (Netlify, Cloudflare Pages, Render, Railway, fly.io) will also work.

---

## Project structure

```
.
├── public/
│   └── sample-leetcode.csv          # Example CSV with ~665 questions
├── src/
│   ├── app/
│   │   ├── globals.css              # Theme tokens (dark/light) + base styles
│   │   ├── layout.tsx               # Root layout: Geist font, ThemeProvider, Toaster
│   │   └── page.tsx                 # Main page: orchestrates sheets + active sheet + filters
│   ├── components/
│   │   ├── ui/                      # shadcn/ui primitives (button, checkbox, slider, dialog, sheet, …)
│   │   ├── active-filters.tsx       # Removable filter chips + "Clear all"
│   │   ├── difficulty-badge.tsx     # Colored Easy / Medium / Hard pill
│   │   ├── empty-state.tsx          # CTA before any CSV is loaded
│   │   ├── filters-sidebar.tsx      # Sidebar with all filters (desktop) + drawer (mobile)
│   │   ├── header.tsx               # Top bar: logo, Upload CSV, Clear all, theme toggle
│   │   ├── question-table.tsx       # Sortable, paginated table with solved checkbox
│   │   ├── sheet-tabs.tsx           # Tab strip: switch / rename / delete sheets
│   │   ├── stats-bar.tsx            # Overall + per-difficulty solved progress (active sheet)
│   │   ├── theme-provider.tsx       # next-themes wrapper
│   │   ├── theme-toggle.tsx         # Dark / light toggle button
│   │   └── upload-dialog.tsx        # Two-step upload: pick file → configure (alias + create/replace)
│   └── lib/
│       ├── csv.ts                   # PapaParse wrapper + validation
│       ├── storage.ts               # SSR-safe localStorage helpers (multi-sheet + legacy migration)
│       ├── types.ts                 # Question, Sheet, Filters, SortState types
│       └── utils.ts                 # cn() class merge helper
├── .gitignore
├── components.json                  # shadcn/ui config
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── README.md
├── tailwind.config.ts
└── tsconfig.json
```

---

## Customization

### Theme tokens
All colors are defined as CSS variables in `src/app/globals.css`. Edit `:root` / `.dark` / `.light` blocks to retune the palette. Semantic color names: `--background`, `--foreground`, `--card`, `--muted`, `--border`, `--accent`, `--easy`, `--medium`, `--hard`.

### Frequency preset chips
Edit `FREQ_PRESETS` in `src/lib/types.ts`:

```ts
export const FREQ_PRESETS = [100, 75, 50, 25] as const;
```

### Default page size
Edit `PAGE_SIZE_OPTIONS` in `src/components/question-table.tsx`:

```ts
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
```

### Default sort
Edit the initial `sort` state in `src/app/page.tsx`:

```ts
const [sort, setSort] = useState<SortState>({ key: "frequency", dir: "desc" });
```

---

## How it works

1. On first load, `useEffect` hydrates `sheets` (and the active sheet id) from `localStorage`. If legacy single-CSV keys exist, they're migrated into a single `Imported` sheet.
2. If no sheets exist, the empty state is shown with a CSV upload call-to-action.
3. Clicking "Upload CSV" (or the `+` button on the tab strip) opens the **UploadDialog** — a two-step flow: pick a file → configure (alias + create-new vs replace-existing).
4. When the user confirms, `parseCsv()` (in `src/lib/csv.ts`) has already validated headers and parsed `%` fields into floats; the dialog returns a `Question[]`. The page either appends a new `Sheet` to `sheets` or replaces an existing one (preserving solved IDs that still exist).
5. The active sheet's `questions` + `solvedIds` feed the `StatsBar` and `QuestionTable`. Filter / sort / pagination state lives in React state in `page.tsx`. The table computes the filtered + sorted slice with `useMemo`, then paginates.
6. Solved checkboxes toggle membership in the active sheet's `solvedIds` array, which is persisted to `localStorage` as part of the sheet object.
7. Theme is controlled by `next-themes` via a `class` attribute on `<html>` — Tailwind's `dark:` variant and CSS variables handle the rest.

---

## License

MIT — use it, fork it, ship it.
