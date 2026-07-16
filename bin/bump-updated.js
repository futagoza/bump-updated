#!/usr/bin/env node

import fs from "node:fs/promises"
import path from "node:path"
import { bump, utils } from "../index.js"

const argv = process.argv.slice( 2 )
let REPOSITORY
let devDependencies = true
let DRY_RUN = false
let FORCE = false
let REBUILD = true
let TARGETS = []

const { debug } = utils.log

function _die( error ) {

    utils.log.error( error )
    process.exit( 1 )

}

async function _resolve( base, filename ) {

    return path.join( await fs.realpath( base ), filename )

}

let skip = false
await utils.serial( argv, async ( arg, n ) => {

    if ( skip ) {

        skip = false
        return

    }

    if ( arg === "--all" ) {

        if ( Array.isArray( TARGETS ) && TARGETS.length ) _die( "Input(s) are not allowed along with the `--all` option/flag!" )
        if ( TARGETS === "all" ) _die( "Multiple use's of the `--all` option/flag detected!" )

        debug( `Valid "${ arg }" provided; setting TARGETS to "all"` )
        TARGETS = "all"
        return

    }

    if ( arg === "--debug" ) {

        debug( true )
        debug( `Debugging enabled due to the "--debug" flag/option being passed.` )
        return

    }

    if ( arg === "--dry" ) {

        if ( DRY_RUN === true ) _die( "Multiple use's of the `--dry` option/flag detected!" )

        debug( `Valid "--dry" provided; setting DRY_RUN to "true"` )
        DRY_RUN = true
        return

    }

    if ( arg === "--force" ) {

        if ( FORCE ) _die( "Multiple use's of the `--force` option/flag detected!" )

        debug( `Valid "--force" provided; setting FORCE to "true"` )
        FORCE = true
        return

    }

    if ( arg === "--no-dev" ) {

        if ( devDependencies === false ) _die( "Multiple use's of the `--no-dev` option/flag detected!" )

        debug( `Valid "--no-dev" provided; setting devDependencies to "false"` )
        devDependencies = false
        return

    }

    if ( arg === "--no-rebuild" ) {

        if ( REBUILD === false ) _die( "Multiple use's of the `--no-rebuild` option/flag detected!" )

        debug( `Valid "--no-rebuild" provided; setting REBUILD to "false"` )
        REBUILD = false
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

        debug( `Valid "-p" provided; REPOSITORY set to "${ dir }"` )
        return

    }

    if ( TARGETS === "all" ) _die( "Input(s) are not allowed along with the `--all` option/flag!" )
    if ( TARGETS.includes( arg ) ) _die( `The input "${ arg }" was supplied multiple times!` )

    debug( `Adding "${ arg }" to list of inputs` )
    TARGETS.push( arg )

} )

if ( Array.isArray( TARGETS ) && TARGETS.length === 0 ) {

    debug( `No inputs were provided; setting TARGETS to "updated"` )
    TARGETS = "updated"

}

if ( ! REPOSITORY ) {

    REPOSITORY = process.cwd()
    debug( `No "-p" was provided; REPOSITORY set to the cwd: "${ REPOSITORY }"` )

}

try {

    debug( "Using the following options (set via passed arguments or defaults):" )
    debug( "repository (-p)          =", REPOSITORY )
    debug( "opts.devDependencies     =", devDependencies, "(disable via --no-dev)" )
    debug( "opts.dry (--dry)         =", DRY_RUN )
    debug( "opts.force (--force)     =", FORCE )
    debug( "opts.rebuild             =", REBUILD, "(disable via --no-rebuild)" )
    debug( "opts.targets (...inputs) =", TARGETS )

    await bump( REPOSITORY, {
        devDependencies,
        dry: DRY_RUN,
        force: FORCE,
        rebuild: REBUILD,
        targers: TARGETS,
    } )

} catch ( error ) {

    _die( error )

}
