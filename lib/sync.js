import semver from "semver"
import {
    color,
    FILENAME_SYMBOL,
    getWorkspacePackages,
    join,
    log,
    parallel,
    readJSON,
    serial,
    writeJSON,
} from "./utils.js"

/**
 * Will sync the version of any dependency that is also a workspace package.
 * 
 * __NOTE:__ Only works for the `dependencies` and `devDependencies` fields.
 * 
 * @param {string} from Path to a directory that contans the root `package.json`
 * @param {boolean} devDependencies Update the `devDependencies` field as well. Default's to `true`
 */

export default async function sync( from, devDependencies = true ) {

    /** @type {{ [name: string]: import("@manypkg/tools").PackageJSON }} */
    const packages = {}

    /** @type {( workspace: string, dependencies: { [key: string]: string } ) => void} */
    function update( workspace, dependencies ) {

        for ( const dependency of Object.keys( dependencies ) ) {

            if ( ! packages[ dependency ] ) continue;

            let range = dependencies[ dependency ]
            if ( ! range ) continue

            const pkg = packages[ dependency ]
            if ( ! pkg.version ) continue

            if ( semver.gtr( pkg.version, range ) ) {

                range = pkg.version

                log.info(
                    "Updating dependency %s to %s for %s",
                    color.cyan( dependency ),
                    color.green( range ),
                    color.yellow( workspace ),
                )

            }

            dependencies[ dependency ] = range

        }

    }

    await parallel( await getWorkspacePackages( from ), async dir => {

        log.debug( "sync: attempting to get package.json from", dir )
        const data = await readJSON( join( dir, "package.json" ) )

        log.debug( "sync: loaded", data[ FILENAME_SYMBOL ] )
        packages[ data.name ] = data

    } )

    await serial( Object.entries( packages ), async ( [ name, data ] ) => {

        if ( typeof data.dependencies === "object" ) {

            log.debug( "sync: syncing dependencies for", name )
            update( name, data.dependencies )

        }

        if ( devDependencies && typeof data.devDependencies === "object" ) {

            log.debug( "sync: syncing devDependencies for", name )
            update( name, data.devDependencies )

        }

        await writeJSON( data )

    } )

}
