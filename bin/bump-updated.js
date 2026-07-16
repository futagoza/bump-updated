#!/usr/bin/env node

import fs from "node:fs/promises"
import path from "node:path"
import bump, { defaultOptions } from "../lib/bump.js"
import { log, serial } from "../lib/utils.js"

const argv = process.argv.slice( 2 )
let REPOSITORY
const FLAGS_SET = []
const opts = {
    ...defaultOptions,
    /** @type {typeof defaultOptions.targets} */
    targets: [],
}

function _die( error ) {

    log.error( error )
    process.exit( 1 )

}

async function _resolve( base, filename ) {

    return path.join( await fs.realpath( base ), filename )

}

let skip = false
await serial( argv, async ( arg, n ) => {

    if ( skip ) {

        skip = false
        return

    }

    if ( arg.startsWith( "--" ) && FLAGS_SET.includes( arg ) ) _die( `Multiple use's of the ${ arg } option/flag detected!` )

    if ( arg === "--all" ) {

        if ( opts.targets.length ) _die( "Input(s) are not allowed along with the `--all` option/flag!" )

        log.debug( `Valid "${ arg }" provided; setting "opts.targets" to "all"` )
        opts.targets = "all"
        return

    }

    if ( arg === "--debug" ) {

        log.debug( true )
        log.debug( `Debugging enabled due to the "--debug" flag/option being passed.` )
        return

    }

    if ( arg === "--dry" ) {

        log.debug( `Valid "--dry" provided; setting "opts.dry" to "true"` )
        opts.dry = true
        return

    }

    if ( arg === "--force" ) {

        log.debug( `Valid "--force" provided; setting "opts.force" to "true"` )
        opts.force = true
        return

    }

    if ( arg === "--no-dev" ) {

        log.debug( `Valid "--no-dev" provided; setting "opts.devDependencies" to "false"` )
        opts.devDependencies = false
        return

    }

    if ( arg === "--no-rebuild" ) {

        log.debug( `Valid "--no-rebuild" provided; setting "opts.rebuild" to "false"` )
        opts.rebuild = false
        return

    }

    if ( arg === "--no-test" ) {

        log.debug( `Valid "--no-test" provided; setting "opts.test" to "false"` )
        opts.test = false
        return

    }

    if ( arg === "-p" ) {

        if ( REPOSITORY ) _die( `The "-p" option/flag was already passed with the value ${ REPOSITORY }` )

        const input = argv[ n + 1 ]
        if ( ! input ) _die( "An input argument must be passed with the `-p` option/flag!" )

        const dir = await _resolve( process.cwd(), input )
        if ( ! dir ) _die( "A valid directory must be passed with the `-p` option/flag!" )

        // ☝️ A simple `if` check for this is already done above, at the start of this code block
        // eslint-disable-next-line require-atomic-updates
        REPOSITORY = dir

        // ☝️ A simple `if` check for this is already done above, at the start of the loop function block
        // eslint-disable-next-line require-atomic-updates
        skip = true

        log.debug( `Valid "-p" provided; REPOSITORY set to "${ dir }"` )
        return

    }

    if ( opts.targets === "all" ) _die( "Input(s) are not allowed along with the `--all` option/flag!" )
    if ( opts.targets.includes( arg ) ) _die( `The input "${ arg }" was supplied multiple times!` )

    log.debug( `Adding "${ arg }" to list of inputs` )
    opts.targets.push( arg )

} )

// Ensure `opts.targets` is set properly
if ( Array.isArray( opts.targets ) && opts.targets.length === 0 ) {

    log.debug( `No inputs were provided; setting "opts.targets" to "updated"` )
    opts.targets = "updated"

}

// Ensure the repository argument is set
if ( ! REPOSITORY ) {

    REPOSITORY = process.cwd()
    log.debug( `No "-p" was provided; REPOSITORY set to the cwd: "${ REPOSITORY }"` )

}

try {

    log.debug( "Using the following options (set via passed arguments or defaults):" )
    log.debug( "REPOSITORY (-p ...)      =", REPOSITORY )
    log.debug( "opts.devDependencies     =", opts.devDependencies, "(disable via --no-dev)" )
    log.debug( "opts.dry (--dry)         =", opts.dry )
    log.debug( "opts.force (--force)     =", opts.force )
    log.debug( "opts.rebuild             =", opts.rebuild, "(disable via --no-rebuild)" )
    log.debug( "opts.test                =", opts.test, "(disable via --no-test)" )
    log.debug( "opts.targets (...inputs) =", opts.targets )

    await bump( REPOSITORY, opts )

} catch ( error ) {

    _die( error )

}
