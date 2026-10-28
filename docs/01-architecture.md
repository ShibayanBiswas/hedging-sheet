# 01 · Architecture

The Hedging Sheet app replaces the desk's hedging spreadsheet for the five year accelerator. It replicates the accelerator payoff with an option book, prices every leg on the vol surface, solves the Inbuilt, sizes the Day 1 vega hedge, stress-tests margin, and exports the five working sheets to Excel.

## Stack

Next.js 16 App Router with Turbopack, React 19, TypeScript in strict mode, Tailwind 3, framer-motion, lucide-react, zod, recharts, ExcelJS for the download and SheetJS for reading uploads, and MongoDB for the surface. Node 24. Vitest for the engine and Playwright for the browser.

## Layers

| Layer | Folder | Role |
|---|---|---|
| Engine | `lib/engine` | Pure TypeScript. No React, no browser, no network. One function per sheet block. See [02 Calculation Logic](02-calculation-logic.md). |
| Tables | `lib/tables.ts` | Every table defined once and rendered both on screen and in the Excel file, so the two always match. |
| Data | `lib/data`, `lib/db` | Built in seeds, MongoDB load and save, with a seed fallback when the database is away. |
| Market | `lib/market-data.ts` | Yahoo closes for Nifty and Sensex, completed sessions only. |
| State | `lib/context` | `DeskProvider` holds the inputs, the market data and the last run. `DeskDialogProvider` holds the popup queue and toasts. |
| UI | `app`, `components` | One route per tab. Shared shell, tables, fields and dialogs. |
| Workbook | `lib/workbook` | Excel export and the surface upload parser. |

## State and the Run Simulation flow

- Inputs live in React context only. Nothing is saved between sessions; a refresh reloads live defaults.
- Editing an input never reprices. The desk presses **Run Simulation**, which validates, refreshes the active dataset, prices the book, solves the Inbuilt, builds the stress grid, and stores the result as the last run.
- Each run stores a key made of the inputs and a market version. When the inputs or the market change after a run, the output tabs show an Inputs Changed banner until the next run.
- Output tabs show a centred popup asking for a run until the first run. Market Data and Logic Atlas never need a run.
- Download Excel uses the last run.

## Design system

The shell, tabs, dialogs, tables and the Logic Atlas follow the Primary SP Dashboard. The upload shortcut, dialogs after upload, run button and loading states follow the Unwinding Calculator. Maroon and gold masthead, glass cards, Times New Roman for body copy and Segoe UI for controls and tables, dark and light themes, and `deskEase` motion that respects reduced motion.

## Copy rules

Full words, no brackets, almost no "/", Title Case labels, dates as DD-MMM-YYYY, crore with Indian grouping and two decimals, and "-" with a tooltip for any value that cannot be computed. No copy hard-codes Sensex; every label follows the underlying.
