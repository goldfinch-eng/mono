#!/bin/sh
STASH_NAME="pre-commit-$(date +%s)"
git stash save -q --keep-index $STASH_NAME

# Test prospective commit
git diff --cached --name-only | \
    grep -E .js | \
    GREP_COLOR='4;5;37;41' xargs grep --color --with-filename -n .only

if [$? -eq 1]; then
  echo 'COMMIT REJECTED Found "$FORBIDDEN" references. Please remove them before commiting'
  STASHES=$(git stash list)
  if [[ $STASHES == "$STASH_NAME" ]]; then
    git stash pop -q
  fi
  exit 1
fi

STASHES=$(git stash list)
if [[ $STASHES == "$STASH_NAME" ]]; then
  git stash pop -q
fi