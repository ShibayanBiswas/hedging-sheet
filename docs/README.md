# Hedging Sheet Docs

| Doc | What it covers |
|---|---|
| [01 Architecture](01-architecture.md) | Stack, layers, state and the Run Simulation flow, the database design, the caching policy, design system, copy rules |
| [02 Calculation Logic](02-calculation-logic.md) | Every sheet formula mapped to the engine function, with cell references |
| [03 Pricer Logic](03-pricer-logic.md) | The Pricer tab: layout, legs, volatility overrides, Bid or Offer |
| [04 Input Files](04-input-files.md) | The vol surface upload layout and the surface parameters |
| [05 MongoDB and Seed](05-mongodb-and-seed.md) | What is stored, the seed fallback and the database scripts |
| [06 Routes and UI](06-routes-and-ui.md) | Shell, tabs, Inputs sections, popups, output tabs and API routes |
| [07 Testing and Debug](07-testing-debug.md) | Test commands, what each suite pins down, the Debug Drawer |
| [08 Changelog](08-changelog.md) | Every round's changes, newest first |
| [09 Deploy on Vercel](09-vercel-deploy.md) | Environment variables, deploy steps, clearing every cache, and checks |
| [10 Edge Cases](10-edge-cases.md) | Every validation code, its popup and its fix |
| [Database Audit Report](db-audit-report.md) | The inventory before and after the cleanup, the dry run and what was applied |
