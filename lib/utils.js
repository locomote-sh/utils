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

const Crypto = require('crypto');

const DefaultFingerprintLength = 10;

/**
 * Fingerprint a value by calculating its SHA256 hash and returning a fixed
 * length suffix of the result. If the 'data' argument isn't a string, then
 * it is first converted to a JSON string.
 */
exports.fingerprint = ( data, len = DefaultFingerprintLength ) => {
    let str;
    if( typeof data == 'string' ) {
        str = data;
    }
    else {
        str = JSON.stringify( data );
    }
    return Crypto.createHmac('sha256', str )
        .digest('hex')
        .substring( 0, len );
}

