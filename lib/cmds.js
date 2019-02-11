/*
   Copyright 2019 Locomote Ltd.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

const { spawn } = require('child_process');
const { promisify } = require('util');

const Path = require('path');
const FS = require('fs');

const _stat = promisify( FS.stat );
const _readdir = promisify( FS.readdir );

/**
 * Execute a named command with the specified arguments.
 * Returns a promise resolving to the command's stdout. The stdout
 * is parsed into an array of output lines.
 */
function exec( cmd, args, cwd, env ) {
    return new Promise( ( resolve, reject ) => {
        const proc = spawn( cmd, args, { cwd, env });
        const stdout = [];
        const stderr = [];
        proc.stdout.on('data', data => stdout.push( data ) );
        proc.stderr.on('data', data => stderr.push( data ) );
        proc.on('error', reject );
        proc.on('close', () => {
            if( stderr.length > 0 ) {
                let _stderr = Buffer.concat( stderr ).toString();
                reject( _stderr );
            }
            else {
                let _stdout = Buffer.concat( stdout ).toString();
                resolve( _stdout.split('\n') );
            }
        });
    });
}

/**
 * Test whether a file or directory exists.
 */
async function exists( path, isDir ) {
    try {
        let stats = await _stat( path );
        // TODO: Change to stats.isFile() || (isDir && stats.isDirectory)
        // Except check that stats.isFile() == !stats.isDirectory() always
        return true && (!isDir || stats.isDirectory());
    }
    catch( e ) {
        return false;
    }
}

/**
 * List the files in a directory.
 */
function ls( path ) {
    return _readdir( path );
}

/**
 * Delete one or more directories.
 */
function rmdirs( paths ) {
    if( !Array.isArray( paths ) ) {
        paths = [ paths ];
    }
    paths.forEach( ( path ) => {
        if( path == '.' || path == '/' ) {
            throw new Error('rm root path panic');
        }
    });
    return exec('rm', [ '-Rf' ].concat( paths ));
}

/**
 * Remove a file.
 */
function rm( path ) {
    if( path == '.' || path == '/' ) {
        throw new Error('rm root path panic');
    }
    return exec('rm', [ '-Rf', path ]);
}

/**
 * Find and remove files matching specified pattern(s).
 */
function findrm() {
    let patterns = Array.from( arguments );
    let args = patterns
        // Filter out dangerous patterns.
        .filter( p => p != '/' && p != '.' )
        // Build an array like: -name p0 -or -name p1 -or -name p2 ...
        .reduce( ( args, pattern ) => {
            if( args.length ) {
                args.push('-or');
            }
            return args.concat('-name', pattern );
        }, [] );
    // Append args to limit the search depth, and to delete each found result.
    args = args.concat([ '-d', '1', '-exec', 'rm', '-Rf', '{}', ';' ]);
    // Execute the command.
    return exec('find', args );
}

/**
 * Make a directory.
 */
function mkdir( path ) {
    return exec('mkdir', [ '-p', path ]);
}

/**
 * Find files.
 */
function find( dir, filename ) {
    return exec('find', [ dir, '-name', filename ]);
}

/**
 * Ensure a file exists and is a directory. Creates the directory if file
 * doesn't exist, or does but isn't a directory.
 */
async function ensureDir( path ) {
    try {
        let stats = await _stat( path );
        if( stats.isDirectory() ) {
            // File exists and is a directory.
            return true;
        }
        // File exists but isn't a directory; remove the existing file
        // and make new directory.
        await rm( path );
        await mkdir( path );
    }
    catch( e ) {
        // File doesn't exist, create directory.
        await mkdir( path );
    }
}

/**
 * Ensure a parent directory exists for a file.
 */
function ensureDirForFile( path ) {
    return ensureDir( Path.dirname( path ) )
}

/**
 * Copy a file or files.
 */
function cp( from, to ) {
    return exec('cp', [ '-R', from, to ]);
}

exports.exec = exec;
exports.exists = exists;
exports.ls = ls;
exports.rmdirs = rmdirs;
exports.rm = rm;
exports.findrm = findrm;
exports.find = find;
exports.mkdir = mkdir;
exports.ensureDir = ensureDir;
exports.ensureDirForFile = ensureDirForFile;
exports.cp = cp;
