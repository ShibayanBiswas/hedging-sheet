#!/usr/bin/env bash
# Rewrites the Linux visual baselines inside the Playwright image CI uses, or with "compare" checks the committed ones.
# Run it with npm run test:visual:linux, or npm run test:visual:linux -- compare.
set -euo pipefail
mode="${1:-update}"
mkdir -p /work
cd /src
tar --exclude=./node_modules --exclude=./.next --exclude=./.git --exclude=./test-results --exclude=./playwright-report \
  --exclude=./reports --exclude=./.scratch --exclude='./.env*' --exclude=./backups -cf - . | (cd /work && tar xf -)
cd /work
npm ci --no-audit --no-fund
NEXT_PUBLIC_E2E=1 npm run build
if [ "$mode" = "compare" ]; then
  status=0
  E2E_PROD=1 CI=1 npx playwright test e2e/visual --project=chromium --grep "visual baselines" --retries=0 --reporter=line || status=$?
  mkdir -p /out/compare
  find test-results -name '*-diff.png' -o -name '*-actual.png' | while read -r f; do cp "$f" "/out/compare/$(echo "$f" | tr '/' '_')"; done
  exit "$status"
fi
rm -rf e2e/visual/__screenshots__/chromium/linux
E2E_PROD=1 CI=1 npx playwright test e2e/visual --project=chromium --grep "visual baselines" --update-snapshots --reporter=line
mkdir -p /out
cp e2e/visual/__screenshots__/chromium/linux/*.png /out/
echo "$(ls /out/*.png | wc -l) Linux baselines written"
