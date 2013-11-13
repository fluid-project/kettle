/**
 * Kettle io.
 *
 * Copyright 2013 OCAD University
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/gpii/kettle/LICENSE.txt
 */

/*global require*/

(function () {

    "use strict";

    var fluid = require("infusion"),
        kettle = fluid.registerNamespace("kettle");

    /**
     * A grade that can be applied to the kettle.server component that extends
     * its capabilities to support socket.io.
     */
    fluid.defaults("kettle.server.io", {
        gradeNames: ["autoInit", "fluid.littleComponent"],
        distributeOptions: {
            source: "{that}.options.requestsGradeNames",
            target: "{that requests}.options.gradeNames"
        },
        requestsGradeNames: ["kettle.requests.io"],
        members: {
            httpServer: {
                expander: {
                    func: "kettle.server.io.httpServer",
                    args: "{that}.server"
                }
            },
            ioHandlers: {}
        },
        ioOptions: {
            set: {
                "log level": 4
            }
        },
        events: {
            onRegisterIOHandler: "preventable"
        },
        listeners: {
            onRegisterIOHandler: [{
                listener: "{that}.checkHandlerValue",
                priority: "first"
            }, {
                listener: "{that}.makeIOHandler",
                priority: "1"
            }, {
                listener: "{that}.registerIOHandler",
                priority: "last"
            }]
        },
        registerHandlerEventMap: {
            io: "{that}.events.onRegisterIOHandler"
        },
        invokers: {
            listen: {
                funcName: "kettle.server.io.listen",
                args: "{that}"
            },
            stop: {
                funcName: "kettle.server.io.stop",
                args: "{that}"
            },
            trackConnections: {
                funcName: "kettle.server.trackConnections",
                args: ["{that}.sockets", "{that}.httpServer"]
            },
            registerIOHandler: {
                funcName: "kettle.server.io.registerHandler",
                args: ["{that}", "{arguments}.0", "{arguments}.1"]
            },
            makeIOHandler: {
                funcName: "kettle.server.io.makeIOHandler",
                args: ["{that}", "{arguments}.0", "{arguments}.1"]
            }
        }
    });

    kettle.server.io.finalInit = function (that) {
        fluid.log("Initializing the socket.io.");
        // TODO: this does not work if we try to declare io as the component
        // member.
        // NOTE: As per @amb26: "this is actually an already characterised issue
        // with the implementation of fluid.isPlainObject"
        that.io = require("socket.io").listen(that.httpServer);
        fluid.each(that.options.ioOptions.set, function (val, key) {
            that.io.set(key, val);
        });
    };

    /**
     * Create an HTTP server.
     * @param  {Object} server Express server.
     * @return {Object}        HTTP Server
     */
    kettle.server.io.httpServer = function (server) {
        fluid.log("Initializing the HTTP server.");
        // In order to use express and socket.io together on the same port we
        // need to initialize the express app and then use to to create an
        // instance of the http server that socket.io will get attached to as
        // well (as per socket.io documentation).
        return require("http").createServer(server);
    };

    /**
     * Start listening on the port.
     * @param  {Object} that kettle.server.
     */
    kettle.server.io.listen = function (that) {
        var port = that.options.port;
        that.httpServer.listen(port, function () {
            fluid.log("Kettle Server is running on port:", port);
            that.events.onListen.fire();
        });
    };

    /**
     * Stop listening on the port.
     * @param  {Object} that kettle.server.
     */
    kettle.server.io.stop = function (that) {
        var port = that.options.port;
        fluid.log("Stopping Kettle Server on port:", port);
        if (!that.httpServer) {
            return;
        }
        that.events.beforeStop.fire();
        that.httpServer.close(function () {
            delete that.httpServer;
            delete that.server;
            delete that.io;
            that.events.onStopped.fire();
            fluid.log("Kettle Server on port:", port, "is stopped.");
        });
    };

    kettle.server.io.makeIOHandler = function (that, handler, context) {
        that.ioHandlers[context] = that.io.of(handler.route);
    };

    /**
     * Register a handler for a socket connection.
     * @param  {Object} that kettle.server.
     * @param  {Object} handler Handler spec defind by the kettle.app.
     * @param  {String} context Context for the handler.
     */
    kettle.server.io.registerHandler = function (that, handler, context) {
        var ioHandler = that.ioHandlers[context];
        ioHandler.on("connection", function (socket) {
            socket.on("message", function onMessage(data, send) {
                that.requests.events.onNewIORequest.fire(socket, data, send, handler);
                that.requests.events.onHandleRequest.fire(socket.fluidRequest,
                    context);
            });
        });
    };

})();
