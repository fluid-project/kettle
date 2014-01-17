/*
Kettle Server.

Copyright 2012-2013 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/gpii/kettle/LICENSE.txt
*/

/*global require, __dirname */

(function () {

    "use strict";

    var fluid = require("infusion"),
        path = require("path"),
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
            },
            callbackWrapper: {
                type: "kettle.requestContextCallbackWrapper"
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
                args: ["{that}.sockets", "{that}.server"]
            },
            closeConnections: {
                funcName: "kettle.server.closeConnections",
                args: "{that}.sockets"
            },
            checkHandlerValue: {
                funcName: "kettle.server.checkHandlerValue",
                args: "{arguments}.0"
            },
            registerHandler: {
                funcName: "kettle.server.registerHandler",
                args: ["{that}", "{arguments}.0", "{arguments}.1"]
            }
        },
        members: {
            server: {
                expander: {
                    func: "kettle.server.express"
                }
            },
            sockets: []
        },
        root: path.join(__dirname, "../../.."),
        events: {
            onRegisterHandler: "preventable",
            onListen: null,
            beforeStop: null,
            onStopped: null
        },
        listeners: {
            onRegisterHandler: [{
                listener: "{that}.checkHandlerValue",
                priority: "first"
            }, {
                listener: "{that}.registerHandler",
                priority: "last"
            }],
            onCreate: [
                "{that}.setLogging",
                "{that}.registerHandlers",
                "{that}.listen"
            ],
            onListen: "{that}.trackConnections",
            onDestroy: "{that}.stop",
            beforeStop: "{that}.closeConnections"
        },
        registerHandlerEventMap: {
            get: "{that}.events.onRegisterHandler",
            post: "{that}.events.onRegisterHandler",
            "delete": "{that}.events.onRegisterHandler"
        },
        handlers: {},
        port: 8080,
        logging: true
    });

    kettle.server.amalgamateHandlers = function (target, source) {
        $.extend(true, target, source);
    };

    kettle.server.registerHandler = function (that, handler, context) {
        that.server[handler.type](handler.route, function (req) {
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
            that.options.registerHandlerEventMap[handler.type].fire(handler,
                context);
        });
    };

    kettle.server.stop = function (that) {
        var port = that.options.port;
        fluid.log("Stopping Kettle Server on port:", port);
        if (!that.instance) {
            return;
        }
        that.events.beforeStop.fire();
        that.instance.close(function () {
            delete that.instance;
            delete that.server;
            that.events.onStopped.fire();
            fluid.log("Kettle Server on port:", port, "is stopped.");
        });
    };

    kettle.server.closeConnections = function (sockets) {
        // The server will not actually be closed unless all connections are
        // closed. Force close all connections.
        fluid.each(sockets, function (socket) {
            socket.destroy();
        });
    };

    kettle.server.express = function () {
        fluid.log("Initializing the Express server.");
        return express();
    };

    kettle.server.listen = function (that) {
        var port = that.options.port;
        that.instance = that.server.listen(port, function () {
            fluid.log("Kettle Server is running on port: ", port);
            that.events.onListen.fire();
        });
    };

    kettle.server.trackConnections = function (sockets, server) {
        // Keep track of all connections to be able to fully shut down the
        // server.
        server.on("connection", function (socket) {
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
                args: ["{kettle.server}.server", "{requests}"]
            }
        }
    });

    kettle.server.config.configureCreateRequest = function (server, requests) {
        server.use(function (req, res, next) {
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

})();
