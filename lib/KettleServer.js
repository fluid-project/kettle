/*
Kettle Server component, corresponding directly with an express/node HTTP server

Copyright 2012-2013 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/gpii/kettle/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
    http = require("http"),
    express = require("express"),
    $ = fluid.registerNamespace("jQuery"),
    kettle = fluid.registerNamespace("kettle");

kettle.httpMethods = require("express/node_modules/methods"); // TODO: use new http.METHODS API once we can drop node 0.10.x support - this is an npm 3.x upgrade risk

kettle.httpMethodsToRouter = function () {
    return fluid.transform(fluid.arrayToHash(kettle.httpMethods), function () {
        return "httpRouter";
    });
};

fluid.defaults("kettle.server", {
    gradeNames: ["fluid.component"],
    mergePolicy: {
        rootMiddleware: "noexpand"
    },
    rootMiddleware: { // free hash of middleware namespaces to components
        urlencoded: {
            component: "{middleware}.urlencoded",
            priority: "before:json"
        },
        json: {
            component: "{middleware}.json"
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
        middleware: {
            type: "kettle.standardMiddleware"
        },
        httpRouter: {
            type: "kettle.router.http"
        }
    },
    members: {
        expressApp: "@expand:kettle.server.makeExpressApp()",
        httpServer: "@expand:kettle.server.httpServer({that}.expressApp)",
        apps: [],
        sockets: []
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
        "onCreate.registerHandler": {
            funcName: "kettle.server.registerHandler",
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
    requestTypeToRouter: "@expand:kettle.httpMethodsToRouter()",
    port: 8081,
    logging: true
});

kettle.server.registerApp = function (server, app) {
    server.apps.push(app);
};

kettle.server.checkCreateRequest = function (server, req, res, next) {
    var router = kettle.server.getRouter(server, req.method.toLowerCase());
    var match = router.match(req);
    if (match) {
        $.extend(req, match.output);
        var handler = match.handler;
        fluid.log("Invoking handler " + handler.gradeName + " for match ", fluid.filterKeys(match, ["app"]));
        handler.app.requests.events.createRequest.fire({
            type: router.options.requestGradeName,
            options: {gradeNames: handler.gradeName}
        }, req, res, next);
    }
    return req.fluidRequest; // we've either created one or we haven't
};

kettle.server.getRouter = function (that, requestType) {
    var map = that.options.requestTypeToRouter;
    var router = that[map[requestType]];
    if (!router) {
        fluid.fail("No router is registered for unknown request type \"" + requestType + "\" - recognised request types are " + fluid.keys(map).join(", "));
    }
    return router;
};

kettle.server.getHandlerSequence = function (that) {
    var resolved = kettle.middleware.resolveSequence(that, "Kettle server rootMiddleware entry", that.options.rootMiddleware);
    var sequence = fluid.getMembers(resolved, "component.handle");
    sequence.push(function (request) {
        request.events.onHandle.fire(request); // our actual request handler triggerer
        return request.requestPromise;
    });
    return sequence;
};


kettle.server.getDispatcher = function (that) {
    var sequence = kettle.server.getHandlerSequence(that);
    return function (req, res, next) {
        var request = kettle.server.checkCreateRequest(that, req, res, next);
        if (request) {
            var requestPromise = fluid.promise.sequence(sequence, request);
            requestPromise.then(next, next); // we specify that a resolve resolves nothing
        } else {
            next();
        }
    };
};

kettle.server.registerOneHandler = function (that, app, handler, gradeName) {
    if (!handler) { // A typical style of overriding handlers sets them to `null` in derived grades - ignore these
        return;
    }
    var router = kettle.server.getRouter(that, handler.type);
    fluid.log("Registering request handler with gradeName ", router.typeName, " for handler ", handler);
    var handlerCopy = fluid.copy(handler);
    handlerCopy.app = app;
    handlerCopy.gradeName = gradeName;
    router.register(handlerCopy);
};

kettle.server.registerHandler = function (that) {
    fluid.each(that.apps, function (app) {
        fluid.each(app.options.requestHandlers, function (requestHandler, gradeName) {
            kettle.server.registerOneHandler(that, app, requestHandler, gradeName);
        });
    });
    var dispatcher = kettle.server.getDispatcher(that);
    that.expressApp.use(dispatcher);
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
