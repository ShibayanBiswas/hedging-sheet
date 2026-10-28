# 09 · Deploy on Vercel, Step by Step

This guide is for someone who has never deployed a website. Follow the numbered steps in order. You do not need to write any code.

The Hedging Sheet is a **Next.js** app. Vercel hosts it and rebuilds it every time `main` is pushed to GitHub.

- Production: [hedging-sheet.vercel.app](https://hedging-sheet.vercel.app)
- Vercel project: `shibayan-biswas-projects/hedging-sheet`, the same team as the other desk apps
- Repository: [ShibayanBiswas/hedging-sheet](https://github.com/ShibayanBiswas/hedging-sheet), private

## What you need before you start

1. A GitHub account that can see the repository above.
2. The project folder on your laptop: `C:\Users\shiba\OneDrive\Desktop\Hedging Sheet`.
3. The file **`.env.local`** in that folder. It holds the database connection. Never email it and never paste it into a chat.
4. The Vercel account used for the other desk apps, signed in with **Continue with GitHub**.

## Environment variables: exact names and values

Vercel does not read `.env.local`. Each name and value must be added to the Vercel project for **Production**, **Preview** and **Development**.

| Name | Value | Secret |
|---|---|---|
| `MONGODB_URI` | Everything after `MONGODB_URI=` in `.env.local`, as one line | Yes, treat it as a password |
| `MONGODB_DB` | `hedging_sheet` | No |

That is the full list the app reads. `DEFAULT_VOL_MONTH` is not used: the app always shows the current month and carries the latest uploaded surface forward.

**`MONGODB_URI`** points at the `cluster0.lvoycia.mongodb.net` Atlas cluster, the same cluster as the Unwinding Calculator, with the database part of the address set to `hedging_sheet`. It looks like this, with your own user and password:

```text
mongodb+srv://YOUR_USER:YOUR_PASSWORD@cluster0.lvoycia.mongodb.net/hedging_sheet?retryWrites=true&w=majority
```

- Copy it as one unbroken line, with no quotes and no spaces.
- If the password has `@`, `:`, `/` or `#`, it is already encoded in `.env.local`; paste it as it is.

If the database cannot be reached, the app still works from the built-in seeds, and uploads say they apply to the session only.

## Option A: the command line, as used for this deploy

Open PowerShell in the project folder and run these one at a time.

1. Link the folder to a Vercel project named `hedging-sheet` in the desk team:

   ```powershell
   vercel link --project hedging-sheet --yes
   ```

2. Add the two variables for every environment. The value is read from `.env.local` and piped in, so it never appears on screen:

   ```powershell
   foreach ($envName in "production","preview","development") {
     (Select-String -Path .env.local -Pattern '^MONGODB_URI=').Line.Substring(12) | vercel env add MONGODB_URI $envName
     "hedging_sheet" | vercel env add MONGODB_DB $envName
   }
   ```

3. Connect the GitHub repository so pushes deploy by themselves:

   ```powershell
   vercel git connect
   ```

4. Deploy to production:

   ```powershell
   vercel --prod
   ```

## Option B: the Vercel website

1. Go to [vercel.com/new](https://vercel.com/new) and import `ShibayanBiswas/hedging-sheet`.
2. Keep the framework as **Next.js** and the root directory as `./`.
3. Open **Environment Variables** and add `MONGODB_URI` and `MONGODB_DB` from the table above, ticking Production, Preview and Development.
4. Click **Deploy** and wait for the green tick.

## After the first deploy

1. Seed the database once from your laptop, if it is not already seeded:

   ```powershell
   npm run seed:mongo
   npm run test:mongo
   ```

   `test:mongo` prints only the database name, collection counts and sizes.

2. Open these addresses on the production site:
   - `/api/dataset` should show `"surfaceSource":"database"`.
   - `/api/market/levels` should show today's Nifty and Sensex closes with `"source":"yahoo"`.
3. Open the app, wait for the spot to load, press **Run Simulation**, and check that the Summary Sheet Headline table shows an Actual Inbuilt and the market strip reads Up To Date.
4. Click **Download Excel** and check the five sheets: Summary Sheet, Pricer, Product Description, Day 1 Vega Hedge, Mark to Market and Margin.
5. Run the browser tests against production:

   ```powershell
   $env:BASE_URL = "https://hedging-sheet.vercel.app"; npx playwright test; Remove-Item Env:BASE_URL
   ```

   The upload test skips itself against production so the live surface is not replaced.

## If something goes wrong

- **The build fails.** Run `npm run build` on your laptop; the same error shows there.
- **`/api/dataset` shows `"seed"`.** The variables are missing or misspelt, or the Atlas network access list does not allow Vercel. In Atlas, open Network Access and allow `0.0.0.0/0`, as the other desk apps do.
- **Spot stays blank.** Yahoo did not answer. Click Refresh From Yahoo on the Inputs page, or type the spot; Run Simulation is blocked until the spot is above zero.
