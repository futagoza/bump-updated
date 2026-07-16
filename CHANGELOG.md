<a name="3.0.0"></a>
## [v3.0.0](https://github.com/futagoza/bump-updated/compare/v2.1.0...v3.0.0) (2026-07-16)

* Added badges to the top of the `README.md` file
* Updated the Node v20+ message to be more clear
* Changed additional arguments in `bump` to options: `bump(path, targets, dry, devDependencies)` to `bum(path, opts)`
* Clarify monorep -> repository in `README.md`
* `--force` is now unrelated to `--all`; This flag now ensures no git check is done for uncomitted files
* Bump `eslint` devDependency to `v10.7.0`
* Bump `@futagoza/eslint-config` devDependency to `v17.1.0`
* Private packages are now skipped when running `npm publish` to ensure NPM doesn't cry about it
* Run any `rebuild` script if present (disable via `--no-rebuild` or `opts.rebuild = false`)
* Add the `--no-test` flag (and `! opts.test` option) to disable running `npm run test --if-present`
* Ask for a git tag name if multiple versions were bumped due to passing `major`, `minor`, etc
* Support bumping via a version modifier (e.g. major, minor, patch, etc); `-v` or `ops.newversion`

<a name="2.1.0"></a>
## [v2.1.0](https://github.com/futagoza/bump-updated/compare/v2.0.0...v2.1.0) (2026-07-07)

* Update to `@futagoza/child-process` v2
* Now ignoring changelog (case-insensitive check) if found while checking for uncomitted files

<a name="2.0.3"></a>
## [v2.0.3](https://github.com/futagoza/bump-updated/compare/v2.0.2...v2.0.3) (2026-07-06)

* Bump `upath` dependency to `v3.0.8`
* Bump `eslint` devDependency to `v10.6.0`
* Added `@futagoza/eslint-config` as a proper devDependency (published with bump-updated v2.0.2 👍)

<a name="2.0.2"></a>
## [v2.0.2](https://github.com/futagoza/bump-updated/compare/v2.0.1...v2.0.2) (2026-07-06)

* Fix workspace directory normalization
* Added debug messages for `bump()`

<a name="2.0.1"></a>
## [v2.0.1](https://github.com/futagoza/bump-updated/compare/v2.0.0...v2.0.1) (2026-07-06)

* Added a files property to the package.json to whitelist published files
* Updated `README.md`
* Added this `CHANGELOG.md`

<a name="2.0.0"></a>
## [v2.0.0](https://github.com/futagoza/bump-updated/tree/v2.0.0) (2026-07-05)

* Updated script to a ES2022+ (Node 20+) bin
* Added a API entry point (Node 20+ modules)
* Inlined the syncing package
* Updated and/or changed the dependencies
* Added some options (see `README.md`)

<a name="1.0.0"></a>
## [v1.0.0](https://github.com/futagoza/eslint-config-futagozaryuu/tree/v8.0.0) (2019-07-13)

* Created and added as a script to [eslint-config-futagozaryuu](https://github.com/futagoza/eslint-config-futagozaryuu) to version bump my `@futagoza/eslint-*` packages
