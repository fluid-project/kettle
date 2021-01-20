/*
Kettle Resolvers

Copyright 2017 Raising the Floor - International

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/main/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
    fs = require("fs"),
    kettle = fluid.registerNamespace("kettle");

fluid.registerNamespace("kettle.resolvers");

/** Returns an environment variable with the given name.
 * @param {String} name - The name of the environment variable to return
 * @return {String|undefined} The value of the required environment variable,
 * or `undefined` if there is no value.
 */

kettle.resolvers.env = function (name) {
    return process.env[name];
};

/** Returns the contents of the given file as a string, interpreting the
 * file contents as UTF-8. If the file does not exist, an exception will be thrown.
 * @param {String} fileName - The name of the file to be resolved, which may begin
 * with an Infusion module reference of the form `%module-name` as described in
 * <a href="http://docs.fluidproject.org/infusion/development/NodeAPI.html#fluid-module-resolvepath-path-">fluid.module.resolvePath</a>.
 * @return {String} The contents of the file as a string.
 */

kettle.resolvers.file = function (fileName) {
    if (fileName.charAt(0) === "%") {
        fileName = fluid.module.resolvePath(fileName);
    }
    return fs.readFileSync(fileName, "utf8");
};

/** Returns the process argument at the specified index, or the entire argument
 * list if no index is supplied.
 * @param {Integer} index - [optional] The index of the required process argument.
 * @return {String|undefined|Array<String>} The required process argument if it
 * exists, undefined if it does not, or the full array of process arguments if
 * no value was supplied for `index`.
 */

kettle.resolvers.args = function (index) {
    return index === undefined ? process.argv : process.argv[index];
};

// We plan for these to be mockable via a FLUID-6157 approach
