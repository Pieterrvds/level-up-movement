#!/bin/bash
# Build the site and put it on the branch gh-pages (= live on https://pieterrvds.github.io/level-up-movement/).
# Run from the root of the repository, with a clean, committed main.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
rev=$(git rev-parse --short HEAD)
tmp=$(mktemp -d)
trap 'git worktree remove --force "$tmp" 2>/dev/null || true' EXIT
if git fetch --depth 1 origin gh-pages 2>/dev/null; then
  git worktree add --force -B gh-pages "$tmp" FETCH_HEAD >/dev/null
else
  git worktree add --force --detach "$tmp" >/dev/null
  git -C "$tmp" checkout --orphan gh-pages >/dev/null 2>&1
fi
git -C "$tmp" rm -rfq --ignore-unmatch . >/dev/null
cp -R dist/. "$tmp"/
touch "$tmp/.nojekyll" # plain files: GitHub must not run its own site builder over them
git -C "$tmp" add -A
if git -C "$tmp" diff --cached --quiet; then echo "Nothing changed: gh-pages is up to date."; exit 0; fi
git -C "$tmp" commit -qm "Publish $rev"
git -C "$tmp" push -q origin gh-pages
echo "Published $rev to gh-pages."
