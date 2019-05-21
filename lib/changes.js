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

const Path = require('path');

const { exec } = require('./cmds');

/**
 * Functions for tracking changes to files.
 * The code here supports two different file source types:
 * 1. git: If the source path is the root of a git repository then
 *    the repository's index is used to track and report changes
 *    since a reference commit.
 * 2. file: Once opened on a source path, the code will track and
 *    report file additions and deletions each time it is called.
 *
 * The query functions return a standard 'changes' object which is
 * formatted as follows:
 * * Each object key is the path of a file relative to the file source
 *   root path.
 * * The file path is mapped to the file status, indicated by a boolean;
 *   active files have a value 'true', whilst deleted files have a value
 *   'false'.
 */

/**
 * Convert an octet escape sequence in \xxx format to a string containing
 * its character equivalent.
 */
function octetToStr( octet ) {
    return String.fromCharCode( parseInt( octet.slice( 1 ), 8 ) );
}

/**
 * Correct a git filename presented with extended characters.
 * See https://git-scm.com/docs/git-status, third para of the "Short Format"
 * section for reference; filenames containing extended characters will
 * be presented quoted within double quotation marks (0x22) with extended
 * characters encoded as octet escape sequences.
 * This function removes the quotation marks and replaces the octet
 * sequences with the actual character.
 */
function correctExtendedChars( s ) {
    if( s.charCodeAt( 0 ) == 0x22 && s.charCodeAt( s.length - 1 ) == 0x22 ) {
        return s
            .slice( 1, -1 )
            .replace(/\\\d\d\d/g, octetToStr );
    }
    return s;
}

/**
 * Open a changes source on a git repository.
 * @param path      The path to the repository root.
 * @param branch    The branch of the repo to be queried.
 * @return A function for querying for file changes.
 */
function openGitSource( path, branch ) {

    /**
     * List changes since a reference commit.
     * @param since A commit hash.
     */
    async function getChangesSince( since ) {

        const args = ['diff', '--name-status', since, branch ];
        const entries = await exec('git', args, path );

        // Entries will be in a format like the following:
        //      M       file.js
        //      R079    file-1.js      file-2.js
        // The first example shows a modified file; the second example shows
        // a renamed file, with the old filename followed by the new filename.
        // The number after the 'R' is a score showing file similarity (see
        // https://stackoverflow.com/a/35142442/8085849). In the second case,
        // the function returns an array with two items; one a file deletion
        // on the old filename; the second an active file item on the new name.
        // Git file status flags:
        // ' ' = unmodified
        //  M = modified
        //  A = added
        //  D = deleted
        //  R = renamed
        //  C = copied
        //  U = updated but unmerged
        const changes = {};
        entries
            .filter( entry => entry.length > 0 )
            .forEach( entry => {
                let [ code, from, to ] = entry.split('\t');
                // Correct filenames containing extended characters.
                from = correctExtendedChars( from );
                if( code[0] === 'R' ) {
                    changes[from] = false;
                    changes[to] = true;
                }
                else {
                    const active = code !== 'D';
                    changes[from] = active;
                }
            });
        return changes;
    }

    /**
     * List all currently active files within the current branch of the repo.
     */
    async function listActive() {

        const args = ['ls-tree', '-r', '--name-only', '--full-tree', branch ];
        const files = await exec('git', args, path );

        const changes = {};
        files
            // Remove empty lines.
            .filter( file => file.length > 0 )
            // Correct filenames containing extended characters.
            .map( correctExtendedChars )
            // Map file path to its status.
            .forEach( file => changes[file] = true );
        return changes;
    }

    /**
     * Return all changes in the current branch of the repo.
     * @param since An optional commit hash.
     */
    return function getChanges( since ) {
        return since
            ? getChangesSince( since )
            : listActive();
    }

}

/**
 * Open a changes source on a file system location.
 * @param path  A directory path.
 */
function openFileSource( path ) {

    /// A map of changes; updated each time getChanges() is called.
    const changes = {};

    /**
     * Return a list of all files currently under the changes
     * path.
     */
    async function listActive() {

        const files = await exec('find', [ path, '-type', 'f' ]);

        const active = {};
        files
            // Remove empty lines.
            .filter( file => file.length > 0 )
            // Make file paths relative to the root path.
            .map( file => Path.relative( path, file ) )
            // Map file path to its status.
            .forEach( file => active[file] = true );
        return active;
    }

    /**
     * Return all changes in the current location. Serial calls
     * to this function will track file additions and deletions
     * and report them approriately.
     */
    return async function getChanges() {
        // Prepare previous changes for rewrite.
        for( const path in changes ) {
            const status = changes[path];
            // Remove previous entries describing deletions.
            if( status === false ) {
                delete changes[path];
            }
            // Mark all other entries as potential deletions.
            else changes[path] = false;
        }
        // Read the currently active set.
        const active = await listActive();
        // Copy currently active set over previous state - any
        // previously active files not in current active set will
        // be flagged as deleted.
        Object.assign( changes, active );
        // Return updated changes.
        return changes;
    }

}

module.exports = { openGitSource, openFileSource };

