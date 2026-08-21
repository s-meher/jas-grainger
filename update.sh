#!/bin/bash
# barehands, anatomy edition — check upstream for changes worth taking.
# Copyright (C) 2026 Jared Rhodenizer
# Fork additions copyright (C) 2026 the anatomy-edition authors
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# THIS IS A FORK, so updating is not the same operation upstream's updater
# performed. Upstream's script fast-forwarded main onto jaredrhod/barehands
# — on a fork that either refuses (divergent history) or, if forced, buries
# the medical layer. So this script never merges anything. It FETCHES
# upstream, shows you exactly what is new, and tells you how to take it.
# Merging is a decision, not a background chore: gesture fixes usually land
# clean because the medical layer lives in js/medical/ and touches
# stage.html only through marked MEDICAL HOOK lines, but you should see the
# diff first. Nothing here writes to your working tree or your config.

set -u

UPSTREAM_URL="https://github.com/jaredrhod/barehands.git"

main() {
  cd "$(dirname "$0")" || exit 1

  if [ ! -d .git ]; then
    echo "This folder isn't a git repository, so there's nothing to compare."
    echo "Clone the fork with git if you want upstream tracking."
    exit 1
  fi

  # the upstream remote is added if missing, never silently repointed
  if ! git remote get-url upstream >/dev/null 2>&1; then
    echo "adding the 'upstream' remote -> $UPSTREAM_URL"
    git remote add upstream "$UPSTREAM_URL" || exit 1
  fi

  echo "fetching upstream…"
  git fetch -q upstream || { echo "couldn't reach upstream (offline?)"; exit 1; }

  # the merge base is where this fork left upstream's history
  BASE=$(git merge-base HEAD upstream/main 2>/dev/null)
  if [ -z "$BASE" ]; then
    echo "no shared history with upstream — nothing sensible to compare."
    exit 1
  fi

  AHEAD=$(git rev-list --count "$BASE"..HEAD 2>/dev/null || echo 0)
  NEW=$(git rev-list --count "$BASE"..upstream/main 2>/dev/null || echo 0)

  echo
  echo "this fork is $AHEAD commit(s) ahead of where it left upstream."
  if [ "$NEW" = "0" ]; then
    echo "upstream has nothing new. You're current."
    exit 0
  fi

  echo "upstream has $NEW new commit(s):"
  git log --oneline "$BASE"..upstream/main | sed "s/^/  new: /"

  # which of OUR files upstream touched — the honest collision forecast.
  # js/medical/, schemas/, cases/, pathology/, review/ and skills/ are ours
  # alone and can never conflict; stage.html and server.py are the shared
  # surface, and that is what is worth looking at before merging.
  echo
  echo "files upstream changed that this fork also carries edits to:"
  UP_FILES=$(git diff --name-only "$BASE"..upstream/main)
  OUR_FILES=$(git diff --name-only "$BASE"..HEAD)
  OVERLAP=$(comm -12 <(echo "$UP_FILES" | sort) <(echo "$OUR_FILES" | sort))
  if [ -z "$OVERLAP" ]; then
    echo "  (none — upstream touched nothing this fork has modified)"
  else
    echo "$OVERLAP" | sed "s/^/  ⚠ /"
  fi

  cat <<'EOF'

Nothing has been merged. To take these changes:

  git diff HEAD...upstream/main -- stage.html   # read the shared surface first
  git merge upstream/main                       # then merge deliberately

If a MEDICAL HOOK line conflicts, keep BOTH sides: upstream's rewritten line
plus the hook comment beside it. The hooks are single lines by design so
this stays a two-second resolution.

Your barehands.json is untracked and cannot be touched by any of this.
EOF
}

main "$@"
