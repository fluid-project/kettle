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
    var connect = require("express/node_modules/connect");

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

    // Handle an uncaught exception in case we get here when the fluid.fail does
    // not escape the function execution.
    process.on("uncaughtException", function onError(err) {
        var message = "FATAL ERROR: Uncaught exception: " + err.message;
        fluid.log(fluid.logLevel.FATAL, message);
        console.log(err.stack);
        var request = kettle.getCurrentRequest();
        // If request was already handled do nothing.
        if (!request) {
            return;
        }
        // Fire request's onError event in case it was not yet hendled.
        request.events.onError.fire({
            isError: true,
            message: err.message
        });
    });
    
    kettle.utils.failureHandler = function (args, activity) {
        var messages = args.concat(activity),
            request = kettle.getCurrentRequest();
        messages = [fluid.logLevel.FAIL, "ASSERTION FAILED: "].concat(messages);
        fluid.log.apply(null, messages);
        if (!request) {
            throw new Error(args[0]);
        }
        request.events.onError.fire({
            isError: true,
            message: messages.join("")
        });
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

    /**
     * Cookie parser.
     */
    kettle.utils.cookieParser = connect.cookieParser;

    /**
     * A memory store constructor used for sessions.
     */
    kettle.utils.MemoryStore = connect.middleware.session.MemoryStore;

    /**
     * Determine whether the request needs a session.
     * @param  {JSON/Object} handlerOrRequest either a fluidRequest or a
     * handler spec.
     * @return {Boolean} need session indicator.
     */
    kettle.utils.useSession = function (handlerOrRequest) {
        return handlerOrRequest.useSession && handlerOrRequest.useSession !== "none";
    };

})();
