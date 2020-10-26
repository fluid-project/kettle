/*
Kettle Static Request Handler support

Copyright 2019 Raising the Floor - International

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
    kettle = fluid.registerNamespace("kettle");

/** A Kettle static request handler is a more compact and efficient means of encoding a handler and set of
 * middleware targetted at a particular path. It allows for exactly the same encoding as is possible within
 * the "requestHandlers" option accepted by kettle.app, only it is packaged as a single Infusion component
 * per app, holding configuration for middleware, routing and request type as component options.
 * This is much more efficient for static or "mostly static" endpoints, since the user does not need to
 * configure a particular request component grade for the endpoint (although they may do so if they wish).
 */
// TODO: Extremely confusing overloading of the term "static"
fluid.defaults("kettle.staticRequestHandler", {
    gradeNames: ["kettle.requestHolder"],
    method: "get",
    handlerType: "kettle.request.http.static",

    /** Accepts further options of the form (with the same meaning as in kettle.app's requestHandler table)
    prefix,
    route: <path>,
    handlerGradeNames: <handlerGradeNames>,
    handlerOptions: <handlerOptions>
    requestMiddleware: [<requestMiddleware>]
    */
    listeners: {
        "onCreate.register": {
            listener: "kettle.staticRequestHandler.registerHandler",
            args: ["{kettle.server}", "{that}"]
        }
    },
    invokers: {
        // request-static site where the request handling method of `kettle.request` may be overridden
        handleRequest: "fluid.notImplemented"
    }
});

/** A static variant of `kettle.request.http` that escalates its request handling to the parent `kettle.staticRequestHandler`
 */

fluid.defaults("kettle.request.http.static", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: {
            func: "{kettle.staticRequestHandler}.handleRequest"
        }
    }
});

kettle.staticRequestHandler.copyProps = ["method", "route", "prefix", "namespace", "priority"];

/** Register a particular static request handler into the routing table of the target server
 * @param {kettle.server} server - The parent server
 * @param {kettle.staticRequestHandler} staticHandler - The handler to be registered
 */
kettle.staticRequestHandler.registerHandler = function (server, staticHandler) {
    var requestHandlerRecord = {
        type: staticHandler.options.handlerType,
        options: staticHandler.options.handlerOptions
    };
    kettle.staticRequestHandler.copyProps.forEach(function (prop) {
        if (staticHandler.options[prop] !== undefined) {
            requestHandlerRecord[prop] = staticHandler.options[prop];
        }
    });
    var handlerPath = fluid.pathForComponent(staticHandler);
    // Component member name functions as a default namespace key
    kettle.server.registerOneHandler(server, staticHandler, requestHandlerRecord, handlerPath[handlerPath.length - 1]);
};


/** A Kettle static request handler that registers a single instance of the express static middleware
 * attached to its route, hosted from a module-path resolved location available to the current module
 */
// TODO: Note that static request handlers do not compose in the way that the standard static middleware does - there is no
// way to defer from one handler to another, each one must fully handle its routing area.
fluid.defaults("kettle.staticRequestHandlers.static", {
    gradeNames: "kettle.staticRequestHandler",
    method: "get",
    route: "/*",
    components: {
        staticMiddleware: {
            type: "kettle.middleware.static",
            options: {
                root: "{kettle.staticRequestHandler}.options.root"
            }
        }
    },
    requestMiddleware: {
        "static": {
            middleware: "{kettle.staticRequestHandler}.staticMiddleware"
        }
    },
    invokers: {
        handleRequest: {
            funcName: "kettle.request.notFoundHandler"
        }
    }
});
