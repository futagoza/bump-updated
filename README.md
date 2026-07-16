[![release](https://img.shields.io/npm/v/bump-updated.svg)](https://www.npmjs.com/package/bump-updated)
[![History](https://img.shields.io/badge/bump--updated-changelog-yellow)](https://github.com/futagoza/bump-updated/blob/master/CHANGELOG.md)
[![license](https://img.shields.io/badge/license-mit-blue.svg)](https://opensource.org/licenses/MIT)

> This library is developed with Node 20+ (ES2022+ modules) in mind and may not work properly with prior versions of Node.

Simple prompt-based version bumping for NPM workspace packages inside a git repository.

_**You must have committed package.json files previously and be logged into the NPM CLI otherwise errors are thrown by each!**_

## CLI Usage

```bash
# 1. Set's the current working directory as the path; is expected to be a repository directory
# 2. Find all workspace packages (Yarn, npm, Lerna, pnpm, Bun or Rush)
# 3. Prompt for a version
# 4. Bump packages since last git tag (or HEAD)
# 5. Sync workspace deps
# 6. Run any rebuild scripts for the bumped packages
# 7. Run the test script in the root of the repository (if present)
# 8. `npm publish`, `git tag`, `git commit` changes and `git push`
bump-updated

# Will version bump all workspace packages (cannot have inputs)
bump-updated --all

# Enables debug messages
bump-updated --debug

# Will only perform version bumping and sync workspace deps (also enables --force)
bump-updated --dry

# Will not check for uncommitted files
bump-updated --force

# Will not bump devDependencies for workspace packages (not recommended)
bump-updated --no-dev

# Skip running the `rebuild` script if present in the updating packages
bump-updated --no-rebuild

# Skip running the `test` script if present in the root of the repository
bump-updated --no-test

# Change the current working directory (useful for multi purpose repositories)
bump-updated -p [path]

# You can choose the version modifier this way (e.g. major, minor, patch, etc)
# NOTE: This disables the prompt asking for a new version.
bump-updated -v [newversion]

# Manually choose workspace packages to version bump
bump-updated "@project/core" "@project/*-plugin"
```

## API Usage

```js
import { bump, sync, utils } from "bump-updated"

/*

Will do the following in order:

    - find all workspace packages (Yarn, npm, Lerna, pnpm, Bun or Rush)
    - prompt for a version
    - version bump target (default updated) workspace packages
    - sync workspace packages
    - rebuild any bumped workspace packages
    - run test script in the root of the repository (if present)
    - npm publish all bumped workspace packages (private packages will be skipped)
    - git tag repository (with new version)
    - git push repository

Arguments:

    1. `path` = required; is expected to point to a repository directory
    2. `opts` = Additional options to control the behavior of `bump()`;
                Defaults for these options are shown as values below

*/
bump( path, {
    devDependencies: true, // Sync devDependencies field in packages also
    dry: false,            // Only bumps versions and syncs dependencies (also enables force option)
    force: false,          // Ignores uncommitted (tracked) files in your repository
    newversion: void 0,    // Choose the version modifier this way (e.g. major, minor, patch, etc)
    rebuild: true,         // Run any rebuild script in `package.json` files for the bumped packages
    targets: "updated",    // Can either be "updated" (default), "all" or an array of
                           // specific packages (or simple glob patterns to match)
    test: true,            // Run the test script in the root of the repository (if present)
} )

/*

Sync workspace packages that have `dependencies` (and optionally `devDependencies`) on each other.

Arguments:

    - `path` = required; is expected to point to a repository directory
    - `devDependencies` = `true` by default; sync devDependencies field also

*/
sync( path, devDependencies )

// Enable debug logging (or pass true/false as an argument to enable/disable manually)
utils.log.debug()

// Gets a list of package directories in the workspace
utils.getWorkspacePackages( path )
```
