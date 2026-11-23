#!/bin/bash
# GATE for the visual pass. Run from the worktree root with `vite preview --port 4190` serving dist.
# Prints one line per suite: PASS/FAIL. Full logs in $LOG.
LOG=${LOG:-/c/tmp/gate}; mkdir -p $LOG
export COREWARD_URL=http://localhost:4190
ok=1
npx tsc --noEmit -p . > $LOG/tsc.log 2>&1 && echo "PASS tsc" || { echo "FAIL tsc"; ok=0; }
npm run build > $LOG/build.log 2>&1 && echo "PASS build" || { echo "FAIL build"; ok=0; }
for r in vault shift ember weather debt return kindled; do
  node scripts/vaultplay.mjs --room=$r --port=4190 scripts/routes/$r.js > $LOG/route-$r.log 2>&1
  grep -q '"completed": *true' $LOG/route-$r.log && echo "PASS route $r" || { echo "FAIL route $r"; ok=0; }
done
node scripts/vaults.mjs $LOG/vaults > $LOG/vaults.log 2>&1
n=$(grep -c ' FAIL$' $LOG/vaults.log); k=$(grep -c ' OK$' $LOG/vaults.log)
[ "$n" = 0 ] && [ "$k" -gt 0 ] && echo "PASS vaults.mjs ($k OK)" || { echo "FAIL vaults.mjs ($n FAIL, $k OK)"; ok=0; }
node scripts/vaultfit.mjs > $LOG/vaultfit.log 2>&1
grep -q '^OK — every room' $LOG/vaultfit.log && echo "PASS vaultfit" || { echo "FAIL vaultfit"; ok=0; }
node scripts/bugsweep.mjs $LOG/bug > $LOG/bugsweep.log 2>&1
n=$(grep -c '^FAIL' $LOG/bugsweep.log); grep -q PAGEERROR $LOG/bugsweep.log && n=$((n+1))
[ "$n" = 0 ] && echo "PASS bugsweep" || { echo "FAIL bugsweep ($n)"; ok=0; }
sed 's#http://localhost:4173#http://localhost:4190#' scripts/gemcheck.mjs > scripts/_gemcheck4190.mjs
mkdir -p $LOG/gem; node scripts/_gemcheck4190.mjs $LOG/gem > $LOG/gemcheck.log 2>&1; rc=$?
rm -f scripts/_gemcheck4190.mjs
[ $rc = 0 ] && ! grep -qi 'pageerror\|FAIL' $LOG/gemcheck.log && echo "PASS gemcheck" || { echo "FAIL gemcheck"; ok=0; }
[ $ok = 1 ] && echo "GATE PASS" || echo "GATE FAIL"
