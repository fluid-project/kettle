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
    var path = require("path");
    var os = require("os");
    var connect = require("express/node_modules/connect");

    var kettle = fluid.registerNamespace("kettle");

    fluid.registerNamespace("kettle.utils");
    fluid.registerNamespace("kettle.use");
    fluid.registerNamespace("kettle.gradeLinkageRecord");

    // Debugging definition - node.js's default is only 10!
    fluid.Error.stackTraceLimit = 100;

    // Handle an uncaught exception in case we get here when the fluid.fail does
    // not escape the function execution.
    process.on("uncaughtException", function onError(err) {
        fluid.log(fluid.logLevel.FATAL, "FATAL ERROR: Uncaught exception: " + err.message);
        var request = fluid.expand("{request}", {
                fetcher: fluid.makeEnvironmentFetcher()
            });
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
            request = fluid.expand("{request}", {
                fetcher: fluid.makeEnvironmentFetcher()
            });
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
        listeners: {
            onCreate: {
                listener: "fluid.log",
                args: ["INFO", "urlExpander constructed with vars:", "{that}.options.vars"]
            }
        },
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
        fluid.log("INFO", "urlExpander expanding url:", url);
        var expanded = fluid.stringTemplate(url, vars);
        fluid.log("INFO", "urlExpander expanded:", expanded);
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
        return handlerOrRequest.useSession &&
            handlerOrRequest.useSession !== "none";
    };

})();
