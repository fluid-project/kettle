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
        dispatcher: "@expand:kettle.server.getDispatcher({that}, {that}.rootSequence)",
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
        "onCreate.registerDispatchHandler": {
            funcName: "kettle.server.registerDispatchHandler",
            args: "{that}",
            priority: "after:contributeRouteHandlers"
        },
        "onCreate.listen": {
            funcName: "kettle.server.listen",
            args: "{that}",
            priority: "after:registerHandler"
        },
        onListen: "{that}.trackConnections",
        onDestroy: "{that}.stop",
        beforeStop: "{that}.closeConnections",
        onStopped: "kettle.server.shred({that})"
    },
    port: 8081,
    logging: true
});

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

kettle.server.checkCompatibleRequest = function (expectedRequestGrade, handlerGrades) {
    return fluid.contains(handlerGrades, expectedRequestGrade) ? null : kettle.server.mismatchRequestMessages[expectedRequestGrade];
};

kettle.server.evaluateRoute = function (server, req, originOptions) {
    var router = kettle.server.getRouter(server, req);
    var match = router.match(req);
    if (match) {
        var handler = match.handler;
        if (!handler.type) {
            fluid.fail("Error in Kettle application definition - handler ", fluid.censorKeys(handler, ["app"]), " must have a request grade name registered as member \"type\"");
        }
        fluid.log("Invoking handler " + handler.type + " for route " + handler.route + " with expectedGrade " + originOptions.expectedRequestGrade);
        var defaults = fluid.defaults(handler.type, handler.gradeNames);
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
        handler.app.requests.events.createRequest.fire({
            type: handler.type,
            options: options
        }, req, res, next);
    }
    return req.fluidRequest; // we've either created one or we haven't
};

kettle.server.getRouter = function (that /*, req, handler */) {
    return that.httpRouter; // default policy simply returns the single httpRouter
};

kettle.server.sequenceRequest = function (fullSequence, request) {
    var sequence = fluid.promise.sequence(fullSequence, request);
    var togo = fluid.promise();
    sequence.then(function () { // only the handler's promise return counts for success resolution
        fluid.promise.follow(request.handlerPromise, togo);
    }, togo.reject);
    return togo;
};

kettle.server.getDispatcher = function (that, rootSequence) {
    return function (req, res, next, options) {
        var request = kettle.server.checkCreateRequest(that, req, res, next, options);
        if (request) {
            fluid.log("Kettle server allocated request object with type ", request.typeName);
            var requestSequence = kettle.middleware.getHandlerSequence(request, "requestMiddleware");
            var fullSequence = rootSequence.concat(requestSequence).concat([kettle.request.handleRequestTask]);
            var handleRequestPromise = kettle.server.sequenceRequest(fullSequence, request);
            request.handleFullRequest(request, handleRequestPromise, next);
            handleRequestPromise.then(kettle.request.clear, kettle.request.clear);
        } else {
            fluid.log("Kettle server getDispatcher found no matching handlers, continuing");
            next();
        }
    };
};

kettle.server.registerOneHandler = function (that, app, handler) {
    var router = kettle.server.getRouter(that, null, handler);
    fluid.log("Registering request handler ", handler);
    var extend = {
        app: app
    };
    if (handler.method) {
        var methods = fluid.transform(handler.method.split(","), fluid.trim);
        fluid.each(methods, function (method) {
            extend.method = method;
            kettle.router.registerOneHandlerImpl(router, handler, extend);
        });
    } else {
        kettle.router.registerOneHandlerImpl(router, handler, extend);
    }
};

kettle.server.registerDispatchHandler = function (that) {
    fluid.each(that.apps, function (app) {
        fluid.each(app.options.requestHandlers, function (requestHandler, key) {
            if (requestHandler) {
                kettle.server.registerOneHandler(that, app, requestHandler);
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

kettle.server.closeConnections = function (sockets) {
    // The server will not actually be closed unless all connections are
    // closed. Force close all connections.
    fluid.each(sockets, function (socket) {
        socket.destroy();
    });
};

/**
 * Create an HTTP server.
 * @param  {Object} server A Request Listener, if any.
 * @return {Object} A node HTTP Server
 */
kettle.server.httpServer = function (server) {
    fluid.log("Initializing the HTTP server");
    return http.createServer(server);
};

kettle.server.httpsServer = function (options) {
    fluid.log("Initializing the HTTPS server");
    return https.createServer(options);
};

kettle.server.makeExpressApp = function () {
    fluid.log("Initializing the Express app");
    return express();
};

kettle.server.listen = function (that) {
    var port = that.options.port;
    fluid.log("Opening Kettle Server on port ", port);
    that.httpServer.listen(port, function () {
        fluid.log("Kettle Server " + that.id + " is listening on port " + port);
        that.events.onListen.fire();
    });
};

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
