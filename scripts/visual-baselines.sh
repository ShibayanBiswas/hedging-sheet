#!/usr/bin/env bash
# Rewrites the Linux visual baselines inside the Playwright image CI uses. Run it with npm run test:visual:linux.
set -euo pipefail
mkdir -p /work
cd /src
tar --exclude=./node_modules --exclude=./.next --exclude=./.git --exclude=./test-results --exclude=./playwright-report \
  --exclude=./.scratch --exclude='./.env*' --exclude=./backups -cf - . | (cd /work && tar xf -)
cd /work
rm -rf e2e/visual/__screenshots__/chromium/linux
npm ci --no-audit --no-fund
NEXT_PUBLIC_E2E=1 npm run build
E2E_PROD=1 CI=1 npx playwright test e2e/visual --project=chromium --grep "visual baselines" --update-snapshots --reporter=line
mkdir -p /out
cp e2e/visual/__screenshots__/chromium/linux/*.png /out/
echo "$(ls /out | wc -l) Linux baselines written"
