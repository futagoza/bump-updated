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

/** @typedef {Awaited<import("@futagoza/child-process").ChildProcessResult>} xResult */
/** @typedef {(result: xResult)=>unknown} xCallback */

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
 * @param {"updated"|"all"|string[]} TARGETS Target packages to bump. Defaults to `updated`
 * @param {boolean} DRY_RUN Only bump and sync; no NPM or git command will be run
 * @param {boolean} devDependencies Update the `devDependencies` field as well. Default's to `true`
 */

export default async function bump( REPOSITORY, TARGETS = "updated", DRY_RUN = false, devDependencies = true ) {

    // ------------------------------------------------------------------------
    // 1. Local Variables
    // ------------------------------------------------------------------------

    // A boolean constant to indicate if all packages should be bumped
    const BUMP_ALL = TARGETS === "all"
    const BUMP_UPDATED = TARGETS === "updated"

    // Will store the git tag value; defined before calling `DefineUpdatedPackages`
    let GIT_TAG = ""

    // Find all workspace packages
    const WORKSPACES = await getWorkspacePackages( REPOSITORY )
    log.info( "WORKSPACES: ", WORKSPACES )

    // Will store a list of packages to update
    const PACKAGES = []

    // Options for `picomatch.isMatch`
    const GLOB_OPTIONS = {

        basename: true,
        contains: true,

    }

    // ------------------------------------------------------------------------
    // 2. Local Helpers
    // ------------------------------------------------------------------------

    /**
     * Private helper that executes commands via `@futagoza/child-process`
     * 
     * @param {string} command 
     * @param {xCallback} [callback] 
     * @param {string} cwd 
     * @returns 
     */
    function x( command, callback, cwd = REPOSITORY ) {

        const fn = callback ? cp.exec : cp.run
        const p = fn( command, { cwd } )

        return callback ? p.then( callback ) : p

    }

    /**
     * Will serially execute the same command on each workspace directory in the array
     * 
     * @param {string[]} array 
     * @param {string} command 
     * @param {xCallback} [callback] 
     * @returns 
     */
    function ExecuteForEach( array, command, callback ) {

        return serial( array, dir => x( command, callback, dir ) )

    }

    /**
     * Will serially execute the same command on each updated package to update
     * 
     * @param {string} command 
     * @param {xCallback} [callback] 
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

            for ( const ws of WORKSPACES ) {

                if ( picomatch.isMatch( ws, TARGETS, GLOB_OPTIONS ) ) PACKAGES.push( ws )

            }
            return;

        }

        // guard rail, just in case there was an error setting the git tag
        if ( ! GIT_TAG ) throw "DEFINE THE GIT TAG BEFORE CALLING `bump()#DefineUpdatedPackages`!"

        await x( `git diff ${ GIT_TAG } --name-only`, result => {

            result
                ?.stdout
                .toString()
                .trim()
                .split( "\n" )
                .forEach( $file => {

                    $file = join( REPOSITORY, $file )
                    const $dir = WORKSPACES.find( p => $file.includes( p.endsWith( "/" ) ? p : p + "/" ) )

                    if ( $dir && ! PACKAGES.includes( $dir ) ) {

                        PACKAGES.push( $dir )

                        if ( callback ) callback( $dir )

                    }

                } )

        } )

    }

    /**
     * Convenient logger used when bumping updated packages
     * 
     * @param {xResult} output 
     */
    async function LogWorkspaceUpdate( output ) {

        if ( ! output.stdout ) throw output.stderr ?? "No result was returned from NPM updating the version!"

        const $name = ( await readJSON( join( output.options.cwd, "./package.json" ) ) ).name
        const $version = output.stdout.toString().trim()

        log.info( "Bumped", color.cyan( $name ), "to", color.green( $version ) )

    }

    // ------------------------------------------------------------------------
    // 3. Main
    // ------------------------------------------------------------------------

    // All tracked files are required to be committed if the `DRY_RUN` argument is not used
    if ( ! DRY_RUN )
        await x( "git status --untracked-files=no --porcelain", $result => {

            if ( $result.stdout.trim() === "" ) return;

            log.error( "Git working directory not clean!\n\n", $result.stdout )
            throw "Git working directory not clean!"

        } )

    // If the `all` target is provided, bump and publish all workspaces
    if ( BUMP_ALL ) {

        WORKSPACES.forEach( $dir => PACKAGES.push( $dir ) )

    } else {

        // Check if any workspaces were updated since the latest tag was committed
        await x( "git describe --abbrev=0 --always", async $result => {

            GIT_TAG = $result.stdout.trim()
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

        await SyncWorkspacePackages( REPOSITORY, devDependencies )
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
    if ( DRY_RUN ) {

        log.info( "Nothing was committed or published as this was a dry run." )
        return;

    }

    // Just to be sure, run the test script (must be defined in the repository's root `package.json`)
    await x( `npm run test` )

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
