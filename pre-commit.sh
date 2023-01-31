#!/bin/sh
# husky

# Hook created by Husky
#   Version: 3.1.0
#   At: 7/20/2021, 6:02:04 PM
#   See: https://github.com/typicode/husky#readme

# From
#   Directory: /Users/blakewest/code/goldfinch/goldfinch-protocol/node_modules/husky
#   Homepage: https://github.com/typicode/husky#readme

scriptPath="node_modules/husky/run.js"
hookName=`basename "$0"`
gitParams="$*"

debug() {
  if [ "${HUSKY_DEBUG}" = "true" ] || [ "${HUSKY_DEBUG}" = "1" ]; then
    echo "husky:debug $1"
  fi
}

debug "husky v3.1.0 (created at 7/20/2021, 6:02:04 PM)"
debug "$hookName hook started"
debug "Current working directory is '`pwd`'"

if [ "${HUSKY_SKIP_HOOKS}" = "true" ] || [ "${HUSKY_SKIP_HOOKS}" = "1" ]; then
  debug "HUSKY_SKIP_HOOKS is set to ${HUSKY_SKIP_HOOKS}, skipping hook"
  exit 0
fi

if [ "${HUSKY_USE_YARN}" = "true" ] || [ "${HUSKY_USE_YARN}" = "1" ]; then
  debug "Calling husky through Yarn"
  yarn husky-run $hookName "$gitParams"
else

  if ! command -v node >/dev/null 2>&1; then
    echo "Info: can't find node in PATH, trying to find a node binary on your system"
  fi

  if [ -f "$scriptPath" ]; then
    # if [ -t 1 ]; then
    #   exec < /dev/tty
    # fi
    if [ -f ~/.huskyrc ]; then
      debug "Sourcing '~/.huskyrc'"
      . ~/.huskyrc
    fi
    node_modules/run-node/run-node "$scriptPath" $hookName "$gitParams"
  else
    echo "Can't find Husky, skipping $hookName hook"
    echo "You can reinstall it using 'yarn install husky --save-dev' or delete this hook"
  fi
fi
