/*!
Kettle Utilities.

Copyright 2012-2013 OCAD University
Copyright 2012 Antranig Basman

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
    os = require("os"),
    fs = require("fs"),
    path = require("path");

var kettle = fluid.registerNamespace("kettle"),
    $ = fluid.registerNamespace("jQuery");

fluid.extend = $.extend; // passthrough definitions, compatible with upcoming Infusion
fluid.trim = $.trim;

// Debugging definition - node.js's default is only 10!
fluid.Error.stackTraceLimit = 100;
Error.stackTraceLimit = 100;

kettle.requestUncaughtExceptionHandler = function (err) {
    var request = kettle.getCurrentRequest();
    // If there is an active request, attempt to clearly error it out
    if (request) {
        try {
            request.events.onError.fire({
                isError: true,
                message: err.message
            });
        } catch (e) {
            fluid.log("Unexpected error terminating request during uncaught exception handler", e);
        } finally {
        // If that itself fails, in any case ensure the request is unmarked
            kettle.markActiveRequest(null);
        }
    }
};

fluid.onUncaughtException.addListener(kettle.requestUncaughtExceptionHandler, "abortKettleRequest",
    "before:fail");


// In case of a fluid.fail - abort any current request, and then throw an exception - but give the current
// request a chance to return a better-contextualised error message first
kettle.failureHandler = function (args, activity) {
    var request = kettle.getCurrentRequest();
    if (request) {
        fluid.invokeLater(function () {
            if (!request.handlerPromise.disposition) {
                request.handlerPromise.reject({
                    isError: true,
                    message: args[0]
                });
            }
        });
    }
    fluid.builtinFail(args, activity);
};

fluid.failureEvent.addListener(kettle.failureHandler, "fail");

// There seems to be no other way to determine whether signals are supported
// than direct OS detection. Signals are currently completely unsupported on
// Windows - https://github.com/joyent/node/issues/1553
// The purpose of this code is to avoid hung or detached processes if node
// is "killed" with CTRL-C etc.
/* istanbul ignore next */
if (os.type().indexOf("Windows") === -1) {
    process.on("SIGTERM", function handler() {
        process.exit(0);
    });
}

/** Upgrades a promise rejection payload (or Error) by suffixing an additional "while" reason into its "message" field
 * @param {Object|Error} originError - A rejection payload. This should (at least) have the member `isError: true` set, as well as a String `message` holding a rejection reason.
 * @param {String} whileMsg - A message describing the activity which led to this error
 * @return {Object} The rejected payload formed by shallow cloning the supplied argument (if it is not an `Error`) and suffixing its `message` member
 */
kettle.upgradeError = function (originError, whileMsg) {
    var error = originError instanceof Error ? originError : fluid.extend({}, originError);
    error.message = originError.message + whileMsg;
    return error;
};

/** Clones an Error object into a JSON equivalent so that it can be checked in a test fixture using deep equality
 * @param {Object|Error} originError - The error or rejection payload to be cloned
 * @return {Object} The error represented as a plain object
 */
kettle.cloneError = function (originError) {
    var togo = fluid.extend({}, originError);
    togo.message = originError.message;
    return togo;
};

/** After express 4.15.0 of 2017-03-01 error messages are packaged as HTML readable
 * in this stereotypical form.
 * @param received {String} The body of an HTTP response from express which has
 * completed with an error
 * @return {String} The inner error encoded within the HTML body of the response,
 * if it could be decoded, or else the original value of `received`.
 */

kettle.extractHtmlError = function (received) {
    var matches = /<pre>(.*)<\/pre>/gm.exec(received);
    return matches ? matches[1] : received;
};

/** Returns a synchronously resolving promise for the contents of the supplied filename
 * @param {String} fileName - The name of the file to be loaded (with `fs.readFileSync`)
 * @param {String} message - A string describing the activity requiring the file, to appear in any rejection message
 * @return {Promise} A promise for the file's contents decoded as UTF-8
 */
kettle.syncFilePromise = function (fileName, message) {
    var togo = fluid.promise();
    try {
        var string = fs.readFileSync(fileName, "utf8");
        togo.resolve(string);
    } catch (e) {
        togo.reject({
            message: "Error " + message + ": " + e,
            error: e
        });
    }
    togo.accumulateRejectionReason = function (originError) {
        return kettle.upgradeError(originError, " while " + message);
    };
    return togo;
};

/** @param {String[]} fileNames - An array of filenames to be tested
 * @return {String} The first member of the array which exists, or `null` if none do
 */
kettle.firstExistingFile = function (fileNames) {
    return fluid.find_if(fileNames, function (fileName) {
        try {
            return fs.statSync(fileName).isFile();
        } catch (e) {
            return false;
        }
    }, null);
};

fluid.registerNamespace("kettle.JSON");

/**
 * A function parsing a string into an Object form or failure
 *
 * @callback ConfigParser
 * @param {String} The content to be parsed
 * @return {Promise} The parsed form of the content, or a rejection
 */

/**
 * Parses a config file by chosing the appropriate decoder based on the extension of the file
 * Currently json and json5 are supported
 * @param {String} fileName - The name of the file required to be loaded
 * @return {ConfigParser} The parser to use (defaulting to a JSON parser as implemented by `kettle.dataSource.parseJSON`)
 */
kettle.JSON.getSuitableParser = function (fileName) {
    return (path.extname(fileName).toLowerCase() === ".json5") ?
        kettle.dataSource.parseJSON5 : kettle.dataSource.parseJSON;
};

kettle.JSON.readFileSync = function (fileName, message) {
    message = message || "reading file " + fileName;
    var sequence = [{
        listener: function () {
            return kettle.syncFilePromise(fileName, message);
        }
    }, {
        listener: kettle.JSON.getSuitableParser(fileName)
    }];
    var sequencer = fluid.promise.makeTransformer(sequence);
    // We previously bound to the unstable API fluid.promise.makeTransformer which originally started the sequence
    // automatically, and now take the compatibility hit now it doesn't following FLUID-6445
    if (sequencer.resolvedSources.length === 0) {
        fluid.promise.resumeSequence(sequencer);
    }
    return sequencer.promise;
};

// Direct replacement for JSON.parse which instead throws a helpful diagnostic (currently using jsonlint)
kettle.JSON.parse = function (string) {
    if (typeof(string) !== "string") {
        fluid.fail("kettle.JSON.parse called on non-string object ", string);
    }
    var togo;
    kettle.dataSource.parseJSON(string).then(function (parsed) {
        togo = parsed;
    }, function (err) {
        throw err;
    });
    return togo;
};

// Distribute commonly used terms in dataSource resolution in development environments

fluid.defaults("kettle.dataSource.distributeDevTerms", {
    gradeNames: ["fluid.component"],
    distributeOptions: {
        moduleTerms: {
            record: "kettle.dataSource.file.moduleTerms",
            target: "{that kettle.dataSource.file}.options.gradeNames"
        }
    }
});
