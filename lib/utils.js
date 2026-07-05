import { readFile, writeFile } from "node:fs/promises"
import { EOL } from "node:os"
import { join } from "upath"
import { format } from "node:util"
import { getPackages } from "@manypkg/get-packages"
import dateformat from "dateformat"
import parse from "json-parse-even-better-errors"
import colors from "yoctocolors"

let DEBUG = false
export const FILENAME_SYMBOL = Symbol.for( "filename" )
export const INDENT_SYMBOL = Symbol.for( "indent" )
export const NEWLINE_SYMBOL = Symbol.for( "newline" )
const CRLF = "\r\n"
const LF = "\n"

function __print( color, message, args ) {

    message = format( message, ...args ) + EOL

    process.stdout.write(
        `[${ colors[ color ]( dateformat( new Date(), "HH:MM:ss" ) ) }] ${ message }`,
        "utf8",
    )

}

/**
 * Re-exports
 */

export {
    colors as color,
    join,
}

/**
 * Log functions with time appended
 */

export const log = {

    /**
     * Prettily log debug information to the console.
     * 
     * Passing no arguments (preferably before calling `bump` or `sync`) enable's debug messages;
     * You can also pass a boolean (`true` or `false`, no numbers) no manually enable/disable debugging.
     * 
     * @param {string|boolean} message 
     * @param {(string | number)[]} [args] 
     */

    debug( message, ...args ) {

        if ( arguments.length === 0 ) {

            DEBUG = true

        } else if ( typeof message === "boolean" ) {

            DEBUG = message

        } else if ( DEBUG ) {

            __print( "whiteBright", message, args )

        }

    },

    /**
     * Prettily log information to the console.
     * 
     * @param {string} message 
     * @param {(string | number)[]} [args] 
     */

    info: ( message, ...args ) => __print( "gray", message, args ),

    /**
     * Prettily log a warning to the console.
     * 
     * @param {string} message 
     * @param {(string | number)[]} [args] 
     */

    warning: ( message, ...args ) => __print( "yellow", message, args ),

    /**
     * Prettily log an error to the console.
     * 
     * @param {string} message 
     * @param {(string | number)[]} [args] 
     */

    error: ( message, ...args ) => __print( "red", message, args ),

}

/**
 * "fs/promises"#readFile and "json-parse-even-better-errors"
 * 
 * Also saves the resolved filename as a symbol in the resolved JSON data
 * 
 * @template [T={ [key: PropertyKey]: unknown }]
 * @param {string} filename JSON file to read. Must be a fully resolved path
 * @return {T}
 */

export async function readJSON( filename ) {

    const source = await readFile( filename, "utf8" )
    const data = parse( source )

    data[ FILENAME_SYMBOL ] = filename

    return data

}

/**
 * JSON.stringify w/ indent and newline read from previously run `readJSON`, then "fs/promises"#writeFile
 * 
 * The filename is automatically taken from the json data; previously saved by `readJSON` as a symbol
 * 
 * @param {unknown} data JSON data to save
 */

export async function writeJSON( data ) {

    let json = JSON.stringify( data, null, data[ INDENT_SYMBOL ] ?? 2 )

    json = data[ NEWLINE_SYMBOL ] === CRLF
        ? json.replace( /\n/g, CRLF ) + CRLF
        : json + LF

    return await writeFile( data[ FILENAME_SYMBOL ], json, { encoding: "utf8" } )

}

/**
 * Gets a list of package directories in the workspace
 * 
 * @param {string} path Workspace root directory
 */

export async function getWorkspacePackages( path ) {

    const data = await getPackages( path )

    return data.packages.map( p => p.dir )

}

/**
 * Iterate's over an array in parallel, and only resolves when all are complete
 * 
 * @template T
 * @param {T[]} array Array to iterate over. Must all be resolved!
 * @param {(value: T, index: number) => Promise} fn Async function that will be called on each iteration
 */

export async function parallel( array, fn ) {

    const p = array.map( async ( value, index ) => await fn( value, index ) )
    await Promise.all( p )

}

/**
 * Iterate's over an array serially
 * 
 * @template T
 * @param {T[]} array Array to iterate over. Must all be resolved!
 * @param {(value: T, index: number) => Promise} fn Async function that will be `await`'d on each iteration
 */

export async function serial( array, fn ) {

    for ( let i = 0; i < array.length; ++i ) await fn( array[ i ], i )

}
