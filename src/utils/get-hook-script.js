const normalize = require('normalize-path')
const stripIndent = require('strip-indent')
const pkg = require('../../package.json')

function platformSpecific () {
  // On OS X and Linux, try to use nvm if it's installed
  if (process.platform === 'win32') {
    // Add
    // Node standard installation path /c/Program Files/nodejs
    // for GUI apps
    // https://github.com/typicode/husky/issues/49
    return 'export PATH="$PATH:/c/Program Files/nodejs"'
  } else {
    // ~ is unavaible, so $HOME is used
    const home = process.env.HOME

    // Add
    // Brew standard installation path /usr/local/bin
    // Node standard installation path /usr/local
    // for GUI apps
    // https://github.com/typicode/husky/issues/49
    const arr = ['export PATH=$PATH:/usr/local/bin:/usr/local']

    if (process.platform === 'darwin') {
      // Load nvm with BREW_NVM_DIR set to /usr/local/opt/nvm
      arr.push('load_nvm BREW_NVM_DIR /usr/local/opt/nvm')
    }

    // Load nvm with NVM_DIR set to $HOME/.nvm
    arr.push(`load_nvm NVM_DIR ${home}/.nvm`)
    return arr.join('\n')
  }
}

function noVerifyMessage (hookName) {
  return hookName === 'prepare-commit-msg'
    ? `(cannot be bypassed with --no-verify due to Git specs)`
    : '(add --no-verify to bypass)'
}

module.exports = function getHookScript (hookName, relativePath, cmd) {
  const scriptName = hookName.replace(/-/g, '')

  // On Windows normalize path (i.e. convert \ to /)
  const normalizedPath = normalize(relativePath)

  // Hook script
  return stripIndent(`
    #!/bin/sh
    #husky ${pkg.version}

    command_exists () {
      command -v "$1" >/dev/null 2>&1
    }

    load_nvm () {
      export $1=$2
      command_exists nvm || [ -s "$2/nvm.sh" ] && . $2/nvm.sh
      command_exists nvm && [ -f .nvmrc ] && nvm use
    }

    # https://github.com/typicode/husky/issues/76
    has_hook_script () {
      [ -f package.json ] && cat package.json | grep -q "\\"$1\\"[[:space:]]*:"'
    }

    cd ${normalizedPath}

    # Fix for issue #16 #24
    # If script is not defined in package.json then exit
    has_hook_script ${cmd} || exit 0

    ${platformSpecific()}

    # Test if npm is in PATH
    command_exists npm || {,
      echo >&2 "> husky - Can't find npm in PATH. Skipping ${cmd} script in package.json",
      exit 0
    }

    # Expose GIT params
    export GIT_PARAMS="$*"

    # Run script
    echo
    echo "> husky - npm run -s ${cmd}"
    echo "> husky - node \`node -v\`"'
    echo
    npm run -s ${cmd} || {
      echo
      echo "> husky - ${hookName} hook failed ${noVerifyMessage(hookName)}"
      echo "> husky - to debug, use 'npm run ${scriptName}'"
      exit 1
    }
  `)
}
