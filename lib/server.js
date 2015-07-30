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

fluid.defaults("kettle.server", {
    gradeNames: ["fluid.component", "kettle.use.bodyParser"],
    components: {
        requests: {
            type: "kettle.requests"
        },
        requestProxy: {
            type: "kettle.requestProxy"
        },
        createRequest: {
            type: "kettle.server.config.createRequest"
        }
    },
    invokers: {
        listen: {
            funcName: "kettle.server.listen",
            args: "{that}"
        },
        setLogging: {
            funcName: "fluid.setLogging",
            args: "{that}.options.logging"
        },
        amalgamateHandlers: {
            funcName: "kettle.server.amalgamateHandlers",
            args: ["{that}.options.handlers", "{arguments}.0"]
        },
        registerHandlers: {
            funcName: "kettle.server.registerHandlers",
            args: "{that}"
        },
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
    members: {
        expressApp: {
            expander: {
                func: "kettle.server.makeExpressApp"
            }
        },
        httpServer: {
            expander: {
                func: "kettle.server.httpServer",
                args: "{that}.expressApp"
            }
        },
        amalgamatedHandlers: {},
        sockets: []
    },
    events: {
        onRegisterExpressHandler: null, // implementation-only event
        onContributeMiddleware: null, // for 3rd parties to contribute root middleware using app.use
        onContributeRouteHandlers: null, // for 3rd parties to contribute handlers using app.get/app.post etc.
        onListen: null,
        beforeStop: null,
        onStopped: null
    },
    listeners: {
        onRegisterExpressHandler: {
            listener: "kettle.server.registerExpressHandler",
            args: ["{that}", "{arguments}.0", "{arguments}.1"] // handler, context
        },
        onCreate: [
            "{that}.setLogging",
            "{that}.registerHandlers",
            "{that}.listen"
        ],
        onListen: "{that}.trackConnections",
        onDestroy: "{that}.stop",
        beforeStop: "{that}.closeConnections",
        onStopped: "kettle.server.shred({that})"
    },
    registerHandlerEventMap: {
        get: "onRegisterExpressHandler",
        post: "onRegisterExpressHandler",
        put: "onRegisterExpressHandler",
        "delete": "onRegisterExpressHandler"
    },
    port: 8081,
    logging: true
});

kettle.server.amalgamateHandlers = function (amalgamatedHandlers, source) {
    $.extend(true, amalgamatedHandlers, source);
};

kettle.server.registerExpressHandler = function (that, handler, context) {
    if (!handler) {
        fluid.fail("Attempt to register empty handler object in kettle.server.registerExpressHandler");
    }
    var expressHandler = that.expressApp[handler.type];
    if (!expressHandler) {
        fluid.fail("No express handler is registered for unknown request type \"" + handler.type + "\"");
    }
    expressHandler.call(that.expressApp, handler.route, function (req) {
        that.requests.events.onHandleRequest.fire(req.fluidRequest, context);
    });
};

kettle.server.registerHandlers = function (that) {
    // Note that all inbuilt middleware is currently contributed in an uncontrollable way on construction by onCreate of the "kettle.middlware" grade.
    // In order to resolve KETTLE-27, we must ensure that at least no route handlers are registered by external apps before all global middleware is done, and vice versa. 
    that.events.onContributeMiddleware.fire(that);
    fluid.each(that.amalgamatedHandlers, function (handler, context) {
        if (!handler) { // A typical style of overriding handlers sets them to `null` in derived grades - ignore these
            return;
        }
        var handlerEvent = that.events[that.options.registerHandlerEventMap[handler.type]];
        if (!handlerEvent) {
            fluid.fail("No handler is registered for unknown request type \"" + handler.type + "\"");
        }
        handlerEvent.fire(handler, context);
    });
    that.events.onContributeRouteHandlers.fire(that);
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

fluid.defaults("kettle.server.config.createRequest", {
    gradeNames: ["kettle.server.config"],
    invokers: {
        configure: {
            funcName: "kettle.server.config.configureCreateRequest",
            args: ["{kettle.server}.expressApp", "{requests}"]
        }
    }
});

kettle.server.config.configureCreateRequest = function (expressApp, requests) {
    expressApp.use(function (req, res, next) {
        if (!requests.eventedRequestGrade) {
            requests.eventedRequestGrade = "kettle.requests.request.evented";
            fluid.defaults(requests.eventedRequestGrade, {
                gradeNames: ["fluid.component"],
                events: requests.middlewareEvents,
                listeners: requests.middlewareListeners
            });
        }
        requests.events.onNewRequest.fire(req, res, next);
    });
};
