import * as clack from "@clack/prompts"
import cp from "@futagoza/child-process"
import picomatch from "picomatch"
import SyncWorkspacePackages from "./sync.js"
import {
    color,
    getWorkspacePackages,
    join,
    log,
    readJSON,
    serial,
} from "./utils.js"

const DEFAULT_OPTIONS = {

    /**
     * Update the `devDependencies` field as well. Default's to `true`
    * 
    * @type {boolean | undefined}
     */

    devDependencies: true,

    /**
     * Only bump and sync; no NPM or git command will be run
    * 
    * @type {boolean | undefined}
     */

    dry: false,

    /**
     * On `true` ignores uncommitted (tracked) files in your repository
     */

    force: false,

    /**
     * Target packages to bump. Defaults to `updated`
     * 
     * @type {"updated" | "all" | string[] | undefined}
     */

    targets: "updated",

}

/**
 * Default options passed as the 3rd argument to `bump()`
 */

export const defaultOptions = Object.freeze( DEFAULT_OPTIONS )

/**
 * Will do the following in sequence:
 * 
 * - bump the version of any workspace packages (by default those that were updated since the last git tag)
 * - sync workspace packages between each other
 * - npm publish any updated workspace packages
 * - git tag the new release
 * - git push release to GitHub
 * 
 * @param {string} REPOSITORY The root of your project (expected to be a git directory)
 * @param {typeof DEFAULT_OPTIONS} opts Additional options to control the behavior of `bump()`
 */

export default async function bump( REPOSITORY, opts = {} ) {

    // ------------------------------------------------------------------------
    // 1. Normalize options
    // ------------------------------------------------------------------------

    opts = { ...DEFAULT_OPTIONS, ...opts }
    opts.devDependencies = !! opts.devDependencies
    opts.dry = !! opts.dry
    opts.force = !! opts.force
    opts.targets ??= "updated"

    // ------------------------------------------------------------------------
    // 2. Local Variables
    // ------------------------------------------------------------------------

    // A boolean constant to indicate if all packages should be bumped
    const BUMP_ALL = opts.targets === "all"
    const BUMP_UPDATED = opts.targets === "updated"

    // Will store the git tag value; defined before calling `DefineUpdatedPackages`
    let GIT_TAG = ""

    // Find all workspace packages
    const WORKSPACES = await getWorkspacePackages( REPOSITORY )
    log.debug( "bump: Workspace packages loaded = ", WORKSPACES )

    // Will store a list of packages to update
    const PACKAGES = []

    // Options for `picomatch.isMatch`
    const GLOB_OPTIONS = {

        basename: true,
        contains: true,

    }

    // ------------------------------------------------------------------------
    // 3. Local Helpers
    // ------------------------------------------------------------------------

    /**
     * Private helper that executes commands via `@futagoza/child-process`
     * 
     * @param {string} command 
     * @param {cp.XCallback} [callback] 
     * @param {string} cwd 
     * @returns 
     */
    function x( command, callback, cwd = REPOSITORY ) {

        return cp.x( command, callback, cwd )

    }

    /**
     * Will serially execute the same command on each workspace directory in the array
     * 
     * @param {string[]} array 
     * @param {string} command 
     * @param {cp.XCallback} [callback] 
     * @returns 
     */
    function ExecuteForEach( array, command, callback ) {

        return serial( array, dir => x( command, callback, dir ) )

    }

    /**
     * Will serially execute the same command on each updated package to update
     * 
     * @param {string} command 
     * @param {cp.XCallback} [callback] 
     * @returns 
     */
    function ExecuteForUpdated( command, callback ) {

        return ExecuteForEach( PACKAGES, command, callback )

    }

    /**
     * Will update the `PACKAGES` constant by looking for targets or updated packages
     * 
     * @param {(dir: string)=>unknown} callback 
     */
    async function DefineBumbablePackages( callback ) {

        // If `BUMP_UPDATED` is false, we are only bumping requested targets
        if ( ! BUMP_UPDATED ) {

            log.debug( `bump: will only bump packages that match the targets (${ opts.targets })` )

            for ( const ws of WORKSPACES ) {

                if ( picomatch.isMatch( ws, opts.targets, GLOB_OPTIONS ) ) {

                    log.debug( `bump: Adding "${ ws }" to list of packages to update` )
                    PACKAGES.push( ws )

                }

            }
            return;

        }

        // guard rail, just in case there was an error setting the git tag
        if ( ! GIT_TAG ) {

            log.debug( `bump: NO GIT TAG WAS DEFINED; EXITING...` )
            throw "DEFINE THE GIT TAG BEFORE CALLING `bump()#DefineUpdatedPackages`!"

        }

        await x( `git diff ${ GIT_TAG } --name-only`, result => {

            const updated = result?.stdout.toString().trim().split( "\n" )

            log.debug( `bump: ${ color.green( updated.length ) } files have been updated since the last git tag` )

            updated.forEach( $file => {

                $file = join( REPOSITORY, $file )
                const $dir = WORKSPACES.find( p => $file.includes( p.endsWith( "/" ) ? p : p + "/" ) )

                if ( $dir && ! PACKAGES.includes( $dir ) ) {

                    log.debug( `bump: Adding to list of packages to update: `, $dir )
                    PACKAGES.push( $dir )

                    if ( callback ) callback( $dir )

                }

            } )

        } )

    }

    /**
     * Convenient logger used when bumping updated packages
     * 
     * @param {cp.ChildProcessOutput} output 
     */
    async function LogWorkspaceUpdate( output ) {

        if ( ! output.stdout ) throw output.stderr ?? "No result was returned from NPM updating the version!"

        const $name = ( await readJSON( join( output.options.cwd, "./package.json" ) ) ).name
        const $version = output.stdout.toString().trim()

        log.info( "Bumped", color.cyan( $name ), "to", color.green( $version ) )

    }

    // ------------------------------------------------------------------------
    // 4. Main
    // ------------------------------------------------------------------------

    // All tracked files are required to be committed if the `opts.dry` is falsy or `opts.force` is truthy
    if ( ! opts.dry || opts.force ) {

        log.debug( `bump: no dry run argument provided; making sure all files tracked by git are committed` )
        await x( "git status --untracked-files=no --porcelain", $result => {

            const output = $result.stdout.toString().trim().toLowerCase()
            if ( output === "" ) return
            if ( output.includes( "changelog" ) && output.split( "\n" ).length === 1 ) {

                log.debug( `bump: changelog detected while checking for uncommitted files; ignoring it for now...` )
                return

            }

            log.error( "Git working directory not clean!\n\n", $result.stdout )
            throw "Git working directory not clean!"

        } )

    }

    // If the `all` target is provided, bump and publish all workspaces
    if ( BUMP_ALL ) {

        log.debug( `bump: will bump all workspace packages` )
        WORKSPACES.forEach( $dir => PACKAGES.push( $dir ) )

    } else {

        // Check if any workspaces were updated since the latest tag was committed
        await x( "git describe --abbrev=0 --always", async $result => {

            GIT_TAG = $result.stdout.trim()
            log.debug( `bump: Last release marked by a git tag was `, GIT_TAG )
            await DefineBumbablePackages()

        } )
        if ( PACKAGES.length === 0 ) {

            log.info( "No workspaces were updated." )
            return;

        }

    }

    // Ask for new version first (duh)
    const NEW_VERSION = await clack.text( {
        message: "Version number",
    } )

    if ( clack.isCancel( NEW_VERSION ) ) {

        clack.cancel()
        log.warning( "Version bump cancelled by user, exiting..." )
        return;

    }

    log.debug( `bump: will attempt to bump the versions of updated workspace packages to`, color.green( NEW_VERSION ) )
    const NPM_VERSION_COMMAND = [
        "npm",
        "--no-git-tag-version",   // Stop NPM from doing a `git tag`, we manually do this
        "--allow-same-version",   // Allow the same version to be defined as in the `package.json`; easier during development
        "--no-workspaces-update", // Stops NPM from trying to update workspace packages itself
        "version",
        NEW_VERSION,
    ].join( " " )

    // Update the version field in every workspace package
    await ExecuteForUpdated( NPM_VERSION_COMMAND, LogWorkspaceUpdate )

    // Sync the version of any dependency that is also a workspace package
    await ( async function DeepsyncDependencies() {

        await SyncWorkspacePackages( REPOSITORY, opts.devDependencies )
        if ( ! BUMP_ALL ) {

            const $updatedpackages = []
            await DefineBumbablePackages( $updated => $updatedpackages.push( $updated ) )

            if ( $updatedpackages.length ) {

                await ExecuteForEach( $updatedpackages, NPM_VERSION_COMMAND, LogWorkspaceUpdate )
                await DeepsyncDependencies()

            }

        }

    } )()

    // If this is a dry run, stop here (no 'npm publish' or 'git commit')
    if ( opts.dry ) {

        log.info( "Nothing was committed or published as this was a dry run." )
        return;

    }

    // Just to be sure, run the test script (must be defined in the repository's root `package.json`)
    await x( `npm run test --if-present` )

    log.debug( `bump: Will now attempt to "git commit", "git tag", "npm publish" and finally "git push"...` )

    // Add newly updated `package.json` files to the current commit
    await x( `git add -u` )

    // Commit the changes, while also tagging the commit
    await x( `git commit -m ${ NEW_VERSION }` )
    await x( `git tag v${ NEW_VERSION } -m ${ NEW_VERSION }` )

    // Publish every workspace package to NPM
    await ExecuteForUpdated( `npm publish --access public` )

    // Push the changes to the repository
    await x( `git push --follow-tags` )

}
