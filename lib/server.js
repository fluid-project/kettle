/*
Kettle Server.

Copyright 2012-2013 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/gpii/kettle/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
    path = require("path"),
    http = require("http"),
    express = require("express"),
    $ = fluid.registerNamespace("jQuery"),
    kettle = fluid.registerNamespace("kettle");

fluid.defaults("kettle.server", {
    gradeNames: [
        "fluid.eventedComponent",
        "autoInit",
        "kettle.use.bodyParser"
    ],
    components: {
        requests: {
            type: "kettle.requests",
            priority: "0"
        },
        requestProxy: {
            type: "kettle.requestProxy",
            priority: "1"
        },
        createRequest: {
            type: "kettle.server.config.createRequest",
            priority: "2"
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
        },
        checkHandlerValue: {
            funcName: "kettle.server.checkHandlerValue",
            args: "{arguments}.0"
        },
        registerExpressHandler: {
            funcName: "kettle.server.registerExpressHandler",
            args: ["{that}", "{arguments}.0", "{arguments}.1"]
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
        sockets: []
    },
    root: path.join(__dirname, "../../.."),
    events: {
        onRegisterExpressHandler: "preventable",
        onListen: null,
        beforeStop: null,
        onStopped: null
    },
    listeners: {
        onRegisterExpressHandler: [{
            listener: "{that}.checkHandlerValue",
            priority: "first"
        }, {
            listener: "{that}.registerExpressHandler",
            priority: "last"
        }],
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
        get: "{that}.events.onRegisterExpressHandler",
        post: "{that}.events.onRegisterExpressHandler",
        "delete": "{that}.events.onRegisterExpressHandler"
    },
    handlers: {},
    port: 8081,
    logging: true
});

kettle.server.amalgamateHandlers = function (target, source) {
    $.extend(true, target, source);
};

kettle.server.registerExpressHandler = function (that, handler, context) {
    that.expressApp[handler.type](handler.route, function (req) {
        that.requests.events.onHandleRequest.fire(req.fluidRequest, context);
    });
};

/**
   * Check if the handler is a value.
   * @param  {JSON} handler Handler spec
   * @return {bool|undefined} return false to stop handler registration.
 */
kettle.server.checkHandlerValue = function (handler) {
    if (!handler) {
        return false;
    }
};

kettle.server.registerHandlers = function (that) {
    fluid.each(that.options.handlers, function (handler, context) {
        if (!handler) {
            return;
        }
        that.options.registerHandlerEventMap[handler.type].fire(handler, context);
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
    fluid.log("Initializing the HTTP server.");
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
    gradeNames: ["fluid.eventedComponent", "autoInit"],
    listeners: {
        onCreate: "{that}.configure"
    },
    invokers: {
        configure: "kettle.server.config.configure"
    }
});

fluid.defaults("kettle.server.config.createRequest", {
    gradeNames: ["autoInit", "kettle.server.config"],
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
            fluid.defaults(requests.eventedRequestGrade,  {
                gradeNames: ["autoInit", "fluid.eventedComponent"],
                events: requests.middlewareEvents,
                listeners: requests.middlewareListeners
            });
        }
        requests.events.onNewRequest.fire(req, res, next);
    });
};
