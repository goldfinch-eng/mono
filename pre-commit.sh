echo "I'm running the pre-commit hook!"
# pre-commit.sh
STASH_NAME="pre-commit-$(date +%s)"
git stash save -q --keep-index $STASH_NAME

# Test prospective commit
FILES_PATTERN='\test.(js)(\..+)?$'
FORBIDDEN='.only'
git diff --cached --name-only | \
    grep -E $FILES_PATTERN | \
    GREP_COLOR='4;5;37;41' xargs grep --color --with-filename -n $FORBIDDEN \
    && echo 'COMMIT REJECTED Found "$FORBIDDEN" references. Please remove them before commiting' \
    && exit 1

STASHES=$(git stash list)
if [[ $STASHES == "$STASH_NAME" ]]; then
  git stash pop -q
fi