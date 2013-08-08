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

    var kettle = fluid.registerNamespace("kettle");

    // Debugging definition - node.js's default is only 10!
    fluid.Error.stackTraceLimit = 100;

    // Handle an uncaught exception in case we get here when the fluid.fail does
    // not escape the function execution.
    process.on("uncaughtException", function onError(err) {
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

    // This is a default handler for fluid.fail. The handler will
    // fetch a request object from the environment and fire its
    // onError event.
    fluid.pushSoftFailure(function errHandler(args, activity) {
        var messages = args.concat(activity),
            request = fluid.expand("{request}", {
                fetcher: fluid.makeEnvironmentFetcher()
            });
        if (!request) {
            messages = ["ASSERTION FAILED: "].concat(messages);
            console.log.apply(null, messages);
            throw new Error(args[0]);
        }
        request.events.onError.fire({
            isError: true,
            message: messages.join("")
        });
    });

    // There seems to be no other way to determine whether signals are supported
    // than direct OS detection. Signals are currently completely unsupported on
    // Windows - https://github.com/joyent/node/issues/1553
    // The purpose of this code is to avoid hung or detached processes if node
    // is "killed" with CTRL-C etc.
    if (os.type().indexOf("Windows") === -1) {
        console.log(typeof(process.on));

        process.on("SIGTERM", function handler() {
            process.exit(0);
        });
    }

    fluid.defaults("kettle.urlExpander", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],
        listeners: {
            onCreate: {
                listener: "fluid.log",
                args: ["urlExpander constructed with vars:", "{that}.options.vars"]
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
        fluid.log("urlExpander expanding url:", url);
        var expanded = fluid.stringTemplate(url, vars);
        fluid.log("urlExpander expanded:", expanded);
        return expanded;
    };

})();
