/*!
Kettle Utilities.

Copyright 2012-2013 OCAD University
Copyright 2012 Antranig Basman

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/gpii/kettle/LICENSE.txt
*/

(function () {

    "use strict";

    var fluid = require("infusion");
    var os = require("os");

    var kettle = fluid.registerNamespace("kettle");

    fluid.registerNamespace("kettle.utils");

    // Debugging definition - node.js's default is only 10!
    fluid.Error.stackTraceLimit = 100;
    Error.stackTraceLimit = 100;
        
    // Utilities for tracking the current request via a "threadlocal" - these use
    // undocumented facilities of Infusion and need to be rethought
    kettle.getCurrentRequest = function () {
        var request = fluid.expand("{request}", {
            fetcher: fluid.makeEnvironmentFetcher()
        });
        return request;
    };
    
    // Returns a function wrapping the supplied callback with the supplied request - the
    // callback will be executed in an environment where the request has been restored
    kettle.withRequest = function (request, callback) {
        return function wrapCallback () {
            var args = arguments;
            // Avoid double-wrapping the same stack, since this will corrupt the current implementation in FluidIoC
            // To be compatible to both when.js < 2.0.0 and when >= 2.0.0 we must be prepared for superfluous wrapping sometimes
            // TODO: This may now be simplified now that when.js has been removed
            var innerRequest = kettle.getCurrentRequest();
            if (innerRequest && innerRequest !== request) {
                fluid.fail("Error - this thread is already marked to a different request. Make sure to invoke this request asynchronously.");
            }
            if (innerRequest) {
                return callback.apply(null, args);
            } else {
                return fluid.withEnvironment({
                    request: request
                }, function applyCallback() {
                    return callback.apply(null, args);
                });
            }
        };
    };
    
    // Every genuinely asynchronous callback propagated by a Kettle app must be wrapped by this
    // function - in order to propagate the "marker" which identifies the current request object.
    kettle.wrapCallback = function (callback) {
        var request = kettle.getCurrentRequest();
        return kettle.withRequest(request, callback);
    };
    
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
    
    fluid.onUncaughtException.addListener(kettle.requestUncaughtExceptionHandler, "fail", null,
        fluid.handlerPriorities.uncaughtException.fail);
    
    
    // In case of a fluid.fail - abort any current request, and then throw an exception 
    kettle.utils.failureHandler = function (args, activity) {
        var messages = ["ASSERTION FAILED: "].concat(args).concat(activity);
        fluid.log.apply(null, [fluid.logLevel.FATAL].concat(messages));
        var request = kettle.getCurrentRequest();
        request.events.onError.fire({
            isError: true,
            message: args[0]
        });
        fluid.builtinFail(false, args, activity);
    };

    // This is a default handler for fluid.fail. The handler will
    // fetch a request object from the environment and fire its
    // onError event.
    fluid.pushSoftFailure(kettle.utils.failureHandler);

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
        gradeNames: ["fluid.eventedComponent", "autoInit"],
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
        gradeNames: ["kettle.urlExpander", "autoInit"],
        vars: {
            port: "{kettle.server}.options.port",
            root: "{kettle.app}.options.root"
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

})();
