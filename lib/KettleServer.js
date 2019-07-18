/*
Kettle Server component, corresponding directly with an express/node HTTP server

Copyright 2012-2013 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
    http = require("http"),
    https = require("https"),
    express = require("express"),
    kettle = fluid.registerNamespace("kettle");

fluid.defaults("kettle.server", {
    gradeNames: ["fluid.component"],
    mergePolicy: {
        rootMiddleware: "noexpand"
    },
    rootMiddleware: { // free hash of middleware namespaces to components
        urlencoded: {
            middleware: "{middlewareHolder}.urlencoded",
            priority: "before:json"
        },
        json: {
            middleware: "{middlewareHolder}.json"
        }
    },
    invokers: {
        stop: {
            funcName: "kettle.server.stop",
            args: "{that}"
        },
        trackConnections: {
            funcName: "kettle.server.trackConnections",
            args: ["{that}.sockets", "{that}.httpServer"]
        },
        closeConnections: {
            funcName: "kettle.server.closeConnections",
            args: "{that}.sockets"
        }
    },
    components: {
        middlewareHolder: {
            type: "kettle.standardMiddleware"
        },
        httpRouter: {
            type: "kettle.router.http"
        }
    },
    members: {
        expressApp: "@expand:kettle.server.makeExpressApp()",
        httpServer: "@expand:kettle.server.httpServer({that}.expressApp)",
        dispatcher: "@expand:kettle.server.getDispatcher({that})",
        rootSequence: "@expand:kettle.middleware.getHandlerSequence({that}, rootMiddleware, {that}.options.rootMiddleware)",
        apps: [],  // a list of kettle.app nested in this server
        sockets: [] // a list of currently active sockets, to be aborted in case of server shutdown
    },
    events: {
        onContributeMiddleware: null, // for 3rd parties to contribute root middleware using app.use
        onContributeRouteHandlers: null, // for 3rd parties to contribute handlers using app.get/app.post etc.
        onListen: null,
        beforeStop: null,
        onStopped: null
    },
    listeners: {
        "onCreate.setLogging": {
            funcName: "fluid.setLogging",
            args: "{that}.options.logging"
        },
        "onCreate.contributeMiddleware": {
            func: "{that}.events.onContributeMiddleware.fire",
            args: "{that}",
            priority: "after:setLogging"
        },
        "onCreate.contributeRouteHandlers": {
            func: "{that}.events.onContributeRouteHandlers.fire",
            args: "{that}",
            priority: "after:contributeMiddleware"
        },
        "onCreate.registerRouteHandlers": {
            funcName: "kettle.server.registerRouteHandlers",
            args: "{that}",
            priority: "after:contributeRouteHandlers"
        },
        "onCreate.listen": {
            funcName: "kettle.server.listen",
            args: "{that}",
            priority: "after:registerRouteHandlers"
        },
        onListen: "{that}.trackConnections",
        onDestroy: "{that}.stop",
        beforeStop: "{that}.closeConnections",
        onStopped: "kettle.server.shred({that})"
    },
    port: 8081,
    logging: true
});

/** Push the supplied Kettle app onto the collection of apps managed by this server. This is called by an `onCreate` listener
 * for the individual apps. Note that Kettle is currently not dynamic and that apps may not be destroyed separately
 * from their host server.
 * @param {kettle.server} server - The server with which the app is to be registered
 * @param {kettle.app} app - The app to be registered
 */
kettle.server.registerApp = function (server, app) {
    server.apps.push(app);
};

// Update and factor this table in the unlikely event we support further request types
kettle.server.mismatchRequestMessages = {
    "kettle.request.ws": {
        statusCode: 400,
        message: "Error: Mismatched request protocol - sent a WebSockets request to an endpoint expecting a plain HTTP request"
    },
    "kettle.request.http": {
        statusCode: 426,
        message: "Error: Mismatched request protocol - sent an HTTP request to an endpoint expecting a WebSockets request - upgrade required"
    }
};

/**
 * Options supplied to a request dispatcher by a particular variety of server
 * @typedef dispatcherOptions
 * @member {String} expectedRequestGrade A grade name expected to appear in the hierarchy of the request component selected
 * to handle this request
 */

/** Checks whether the request selected for a route is compatible with the expected request type (currently, whether it
 * matches in terms of being an HTTP or WebSockets request handler
 * @param {String} expectedRequestGrade - The request grade expected by the server's dispatcher
 * @param {String[]} handlerGrades - The list of grades actually present in the selected request's hierarchy
 * @return {Object|Null} Either `null` if the request's grade hierarchy matches, or a mismatch error message structure
 * to be dispatched to the client if there is a mismatch
 */
kettle.server.checkCompatibleRequest = function (expectedRequestGrade, handlerGrades) {
    return fluid.contains(handlerGrades, expectedRequestGrade) ? null : kettle.server.mismatchRequestMessages[expectedRequestGrade];
};

/** Evaluates whether the incoming request matches the routing specification of any Kettle request attached to the server.
 * @param {kettle.server} server - The server whose routing table should be queried
 * @param {http.IncomingMessage} req - Node's native HTTP request object
 * @param {dispatcherOptions} originOptions - The dispatcher's options determining the types of compatible request
 * @return {routeMatch} A `routeMatch` structure which determines the request which will be created
 */
kettle.server.evaluateRoute = function (server, req, originOptions) {
    var router = kettle.server.getRouter(server, req);
    var match = router.match(req);
    if (match) {
        var handler = match.handler;
        if (!handler.type) {
            fluid.fail("Error in Kettle application definition - handler ", fluid.censorKeys(handler, ["app"]), " must have a request grade name registered as member \"type\"");
        }
        fluid.log("Invoking handler " + handler.type + " for route " + handler.route + " with expectedGrade " + originOptions.expectedRequestGrade);
        var defaults = fluid.getMergedDefaults(handler.type, handler.gradeNames);
        if (!fluid.hasGrade(defaults, "kettle.request")) {
            fluid.fail("Error in Kettle application definition - couldn't load handler " + handler.type + " and gradeNames " +
                JSON.stringify(fluid.makeArray(handler.gradeNames)) + " to a component derived from kettle.request - got defaults of " + JSON.stringify(defaults));
        }
        match.output.mismatchError = kettle.server.checkCompatibleRequest(originOptions.expectedRequestGrade, defaults.gradeNames);
        if (match.output.mismatchError) { // In the case of a request type mismatch, create a special "mismatch" request handling component
            handler.type = originOptions.expectedRequestGrade + ".mismatch";
            handler.gradeNames = [];
        }
    }
    return match;
};

/** Determine whether Kettle can finding a matching request handler, and if so, create an instance of the appropriate
 * type
 * @param {kettle.server} server - The server holding (via a `kettle.app`) the request definition
 * @param {http.IncomingMessage} req - Node's native HTTP request object
 * @param {http.ServerResponse} res - Node's native HTTP response object
 * @param {Function} next - Express' `next` routing function
 * @param {Object} originOptions - Options to be mixed in to any created request - generally the gradeNames specifying
 * whether it is an HTTP or WS request
 * @return {Boolean} `true` if a matching request was found and created
 */
kettle.server.checkCreateRequest = function (server, req, res, next, originOptions) {
    var match = kettle.server.evaluateRoute(server, req, originOptions);
    if (match) {
        fluid.extend(req, match.output); // TODO: allow match to output to other locations
        var handler = match.handler;
        if (handler.prefix) {
            /* istanbul ignore if - defensive test that we don't know how to trigger */
            if (req.url.indexOf(handler.prefix) !== 0) {
                fluid.fail("Failure in route matcher - request url " + req.url + " does not start with prefix " + handler.prefix + " even though it has been matched");
            } else {
                // This is apparently the time-honoured behaviour implemented by all express "routers" - the original url is preserved within req.originalUrl
                req.url = req.url.substring(handler.prefix.length);
                req.baseUrl = handler.prefix;
            }
        }
        var options = fluid.extend({gradeNames: handler.gradeNames}, originOptions);
        handler.requestHolder.events.createRequest.fire({
            type: handler.type,
            options: options
        }, req, res, next);
        return true;
    }
    return false;
};

/** Get the router to be used for a particular request and handler in the context of a particular server. In the
 * current implementation each server just has one hardwired router stored directly as a member, and this function
 * returns that one.
 * @param {kettle.server} that - The server for which the router is required
 * @return {kettle.router} The server's router
 */
kettle.server.getRouter = function (that /*, req, handler */) {
    return fluid.getForComponent(that, "httpRouter"); // default policy simply returns the single httpRouter
};

kettle.server.getDispatcher = function (that) {
    return function (req, res, next, options) {
        var match = kettle.server.checkCreateRequest(that, req, res, next, options);
        if (!match) {
            fluid.log("Kettle server getDispatcher found no matching handlers, continuing");
            next();
        }
    };
};

/** Register one request handler record as it appears in an app's configuration into the server's routing table
 * @param {kettle.server} that - The server whose router is to be updated
 * @param {kettle.requestHolder} requestHolder - The requestHolder holding the handler record to be registered, will have its createRequest event fired
 * @param {handlerRecord} handler - The handler record to be registered. In this form, `method` may take the form
 * of a comma-separated list of method specifications which this function will explode.
 * @param {String} key - The key of this handler record within its containing structure - will be used as a default value for
 * the `namespace` element of the handlerRecord if none is listed
 */
kettle.server.registerOneHandler = function (that, requestHolder, handler, key) {
    var router = kettle.server.getRouter(that, null, handler);
    fluid.log("Registering request handler ", handler, " with key " + key);
    var lowOptions = {
        method: "get",
        namespace: key
    };
    var highOptions = {
        requestHolder: requestHolder
    };
    var handlerStack = [lowOptions, handler, highOptions];
    if (handler.method) {
        var methods = fluid.transform(handler.method.split(","), fluid.trim);
        fluid.each(methods, function (method) {
            highOptions.method = method;
            kettle.router.registerOneHandlerImpl(router, handlerStack);
        });
    } else {
        kettle.router.registerOneHandlerImpl(router, handlerStack);
    }
};

/** Register all nested request handlers held in apps nested within this server into the server's routing tables. This
 * executes partway through the `onCreate` event for the server.
 * @param {kettle.server} that - The Kettle server for which all nested request handlers are to be registered
 */
kettle.server.registerRouteHandlers = function (that) {
    fluid.each(that.apps, function (app) {
        fluid.each(app.options.requestHandlers, function (requestHandler, key) {
            if (requestHandler) {
                kettle.server.registerOneHandler(that, app, requestHandler, key);
            } else {
                // A typical style of overriding handlers sets them to `null` in derived grades - ignore these
                // A better system will arrive with FLUID-4982 work allowing "local mergePolicies" to remove options material
                fluid.log("Skipping empty handler with key " + key + " for app " + fluid.dumpThat(app));
            }
        });
    });
    that.expressApp.use(function (req, res, next) {
        that.dispatcher(req, res, next, {expectedRequestGrade: "kettle.request.http"});
    });
};

// Remove some members on stop, to give early diagnostics on erroneous late use
kettle.server.shred = function (that) {
    delete that.httpServer;
    delete that.expressApp;
};

/** Stop the supplied Kettle server. The `beforeStop` event will be fired, then the server will be closed, and when
 * that is concluded, the `onStopped` event will be fired.
 * @param {kettle.server} that - The server to be stopped
 */
kettle.server.stop = function (that) {
    if (!that.httpServer) {
        return;
    }
    var port = that.options.port;
    fluid.log("Stopping Kettle Server " + that.id + " on port ", port);
    that.events.beforeStop.fire();

    that.httpServer.close(function () {
        fluid.log("Kettle Server " + that.id + " on port ", port, " is stopped");
        that.events.onStopped.fire();
    });
};

/** Forcibly call `destroy` on each sockets in the supplied array. This is done for historical reasons in which it
 * was observed (c. 2013) that servers would not shut down in a timely way if sockets were open. Should be revisited.
 * @param {Socket[]} sockets - The list of sockets which should be closed
 */
kettle.server.closeConnections = function (sockets) {
    fluid.each(sockets, function (socket) {
        socket.destroy();
    });
};

/**
 * The standard request listener signature implementing an Express app or other middleware.
 *
 * @callback RequestListener
 * @param {http.IncomingMessage} req - Node's native HTTP request object
 * @param {http.ServerResponse} res - Node's native HTTP response object
 * @param {Function} next - Passes control to the next request listener in the processing chain/network
 * @param {Function} err - Used to signal failure and halt processing of this section of the processing chain
 */

/**
 * Create an HTTP server.
 * @param {RequestListener} [app] - An optional requestListener, to be attached to the `request` event on startup
 * @return {http.Server} A node HTTP Server
 */
kettle.server.httpServer = function (app) {
    fluid.log("Initializing the HTTP server");
    return http.createServer(app);
};

/**
 * Create an HTTPS server.
 * @param {Object} options - A collection of options as described in https://nodejs.org/api/https.html#https_https_createserver_options_requestlistener
 * @param {RequestListener} [app] - An optional requestListener, to be attached to the `request` event on startup
 * @return {http.Server} A node HTTP Server
 */
kettle.server.httpsServer = function (options, app) {
    fluid.log("Initializing the HTTPS server");
    return https.createServer(options, app);
};

/** Construct a fresh express app
 * @return {RequestListener} A freshly initialised express app
 */
kettle.server.makeExpressApp = function () {
    fluid.log("Initializing the Express app");
    return express();
};

/** Begin the process of listening on the configured TCP/IP port for this server. Listening will be triggered,
 * and once it has started, the `onListen` event will be fired.
 * @param {kettle.server} that - The server for which listening should begin
 */
kettle.server.listen = function (that) {
    var port = that.options.port;
    fluid.log("Opening Kettle Server on port ", port);
    that.httpServer.listen(port, function () {
        fluid.log("Kettle Server " + that.id + " is listening on port " + port);
        that.events.onListen.fire();
    });
};

/** Keeps track of all currently open sockets so that the server can be fully shut down.
 * @param {Socket[]} sockets - An array of sockets which will hold those that are currently open.
 * @param {http.Server} httpServer - The node HTTP server for which open sockets should be tracked
 */
kettle.server.trackConnections = function (sockets, httpServer) {
    // Keep track of all connections to be able to fully shut down the server.
    httpServer.on("connection", function (socket) {
        sockets.push(socket);
        socket.on("close", function () {
            sockets.splice(sockets.indexOf(socket), 1);
        });
    });
};

fluid.defaults("kettle.server.config", {
    gradeNames: ["fluid.component"],
    listeners: {
        onCreate: "{that}.configure"
    },
    invokers: {
        configure: "kettle.server.config.configure"
    }
});
