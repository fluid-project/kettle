/*!
Kettle Utilities.

Copyright 2012-2013 OCAD University
Copyright 2012 Antranig Basman

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/gpii/kettle/LICENSE.txt
*/

"use strict";

var fluid = require("infusion");
var os = require("os");

var kettle = fluid.registerNamespace("kettle");

// Debugging definition - node.js's default is only 10!
fluid.Error.stackTraceLimit = 100;
Error.stackTraceLimit = 100;

kettle.requestUncaughtExceptionHandler = function (err) {
    console.log("!!!!KUKKKK");
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

fluid.onUncaughtException.addListener(kettle.requestUncaughtExceptionHandler, "fail", null,
    fluid.handlerPriorities.uncaughtException.fail);


// In case of a fluid.fail - abort any current request, and then throw an exception 
kettle.failureHandler = function (args, activity) {
    var messages = ["ASSERTION FAILED: "].concat(args).concat(activity);
    fluid.log.apply(null, [fluid.logLevel.FATAL].concat(messages));
    var request = kettle.getCurrentRequest();
    if (request) {
        request.events.onError.fire({
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
if (os.type().indexOf("Windows") === -1) {
    process.on("SIGTERM", function handler() {
        process.exit(0);
    });
}

fluid.defaults("kettle.urlExpander", {
    gradeNames: ["fluid.component"],
    invokers: {
        expand: {
            funcName: "kettle.urlExpander.expand",
            args: ["{arguments}.0", "{that}.options.vars"]
        }
    }
});

// TODO: Incorrectly, this expander is used to resolve references via URL between 
// parts of the architecture that are deployed on the same host. Naturally, all of
// these linkages should instead resolve via standard function calls.

fluid.defaults("kettle.urlExpander.development", {
    gradeNames: ["kettle.urlExpander"],
    vars: {
        port: "{kettle.server}.options.port",
        root: "{kettle.app}.options.root"
    }
});

// TODO: This condenses a copy-pasted distribution block that appeared in every development
// grade within the GPII. We need to entirely remove the "URLExpander" system since it is
// unprincipled and unintegrated with our existing scheme for the URLResolver within the 
// DataSource - as well as being unnecessary since the system should not be making 
// "HTTP calls to self" as in the previous comment.

fluid.defaults("kettle.urlExpander.distributeDevVariables", {
    gradeNames: ["fluid.component"],
    distributeOptions: {
        record: "kettle.urlExpander.development",
        target: "{that urlExpander}.options.gradeNames"
    }
});

/**
   * Expand a URL based on the supplied vars object.
   * @param  {String} url a url string to be expanded.
   * @param  {JSON} vars a map of string to be expanded.
   * @return {String} an expanded url.
 */
kettle.urlExpander.expand = function (url, vars) {
    var expanded = fluid.stringTemplate(url, vars);
    return expanded;
};

