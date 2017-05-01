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
    // If there is no active request
    if (!request) {
        return;
    }
    // If there is an active request, ensure that it fails with this diagnostic
    request.events.onError.fire({
        isError: true,
        message: err.message
    });
};

fluid.onUncaughtException.addListener(kettle.requestUncaughtExceptionHandler, "fail",
    fluid.handlerPriorities.uncaughtException.fail);


// In case of a fluid.fail - abort any current request, and then throw an exception
kettle.failureHandler = function (args, activity) {
    var request = kettle.getCurrentRequest();
    if (request && !request.handlerPromise.disposition) {
        request.handlerPromise.reject({
            isError: true,
            message: args[0]
        });
    }
    fluid.builtinFail(args, activity);
};

// This is a default handler for fluid.fail. The handler will
// fetch a request object from the environment and fire its
// onError event.
fluid.pushSoftFailure(kettle.failureHandler);

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
 * @param originError {Object|Error} A rejection payload. This should (at least) have the member `isError: true` set, as well as a String `message` holding a rejection reason.
 * @param whileMsg {String} A message describing the activity which led to this error
 * @return {Object} The rejected payload formed by shallow cloning the supplied argument (if it is not an `Error`) and suffixing its `message` member
 */
kettle.upgradeError = function (originError, whileMsg) {
    var error = originError instanceof Error ? originError : fluid.extend({}, originError);
    error.message = originError.message + whileMsg;
    return error;
};

/** Clones an Error object into a JSON equivalent so that it can be checked in a test fixture using deep equality
 * @param originError {Object|Error} The error or rejection payload to be cloned
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
    console.log(matches);
    return matches ? matches[1] : received;
};

/** Returns a synchronously resolving promise for the contents of the supplied filename
 * @param fileName {String} the name of the file to be loaded (with `fs.readFileSync`)
 * @param message {String} A string describing the activity requiring the file, to appear in any rejection message
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

/** @param fileNames {Array of String} An array of filenames to be tested
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
 * Parses a config file by chosing the appropriate decoder based on the extension of the file
 * Currently json and json5 are supported
 * @param fileName {String} The name of the file required to be loaded
 * @return {Function:String -> Promise} The parser to use (defaulting to a JSON parser as implemented by `kettle.dataSource.parseJSON`)
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
    return fluid.promise.makeTransformer(sequence).promise;
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
