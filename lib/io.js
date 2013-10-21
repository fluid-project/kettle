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
    fluid.defaults("kettle.use.io", {
        gradeNames: ["autoInit", "fluid.littleComponent"],
        distributeOptions: {
            source: "{that}.options.requestsGradeNames",
            target: "{that requests}.options.gradeNames"
        },
        requestsGradeNames: ["kettle.requests.io"],
        members: {
            httpServer: {
                expander: {
                    func: "kettle.use.io.httpServer",
                    args: "{that}.server"
                }
            },
            io: {
                expander: {
                    func: "kettle.use.io.io",
                    args: ["{that}.httpServer", "{that}.options.ioOptions"]
                }
            }
        },
        ioOptions: {
            enable: [
                "browser client gzip"
            ],
            set: {
                "log level": 1
            }
        },
        invokers: {
            registerHandlers: {
                funcName: "kettle.use.io.registerHandlers",
                args: ["{that}", "{that}.options.handlers"]
            },
            listen: {
                funcName: "kettle.use.io.listen",
                args: "{that}"
            },
            stop: {
                funcName: "kettle.use.io.stop",
                args: "{that}"
            }
        }
    });

    /**
     * Create an HTTP server.
     * @param  {Object} server Express server.
     * @return {Object}        HTTP Server
     */
    kettle.use.io.httpServer = function (server) {
        return require("http").createServer(server);
    };

    /**
     * Enable socket.io support within the express server.
     * @param  {Object} server HTTP Server.
     * @param  {Object} ioOptions Options block.
     * @return {Object}        socket.io instance.
     */
    kettle.use.io.io = function (server, ioOptions) {
        var io = require("socket.io").listen(server);
        fluid.each(ioOptions.enable, function (enableOption) {
            io.enable(enableOption);
        });
        fluid.each(ioOptions.set, function (val, key) {
            io.set(key, val);
        });
        return io;
    };

    /**
     * Start listening on the port.
     * @param  {Object} that kettle.server.
     */
    kettle.use.io.listen = function (that) {
        var port = that.options.port;
        fluid.log("Kettle Server is running on port:", port);
        that.httpServer.listen(port);
    };

    /**
     * Stop listening on the port.
     * @param  {Object} that kettle.server.
     */
    kettle.use.io.stop = function (that) {
        var port = that.options.port;
        fluid.log("Stopping Kettle Server on port: ", port);
        that.httpServer.close(function () {
            delete that.httpServer;
            delete that.server;
            delete that.io;
            fluid.log("Kettle Server on port: ", port, " is stopped.");
        });
    };

    /**
     * Register a handler for a socket connection.
     * @param  {Object} requests Request creator component.
     * @param  {Object} socket   A socket object.
     * @param  {Object} handler  Handler spec defind by the kettle.app.
     * @param  {String} context  Context for the handler.
     */
    kettle.use.io.registerHandler = function (requests, socket, handler, context) {
        socket.on(handler.route, function onMessage(data, send) {
            requests.createIO(socket);
            var request = socket.fluidRequest;
            request.data = data;
            request.send = send;
            request.handlerContext = fluid.model.composeSegments(
                "kettle.requests.request.handler", context);
            request.events.handle.fire();
        });
    };

    /**
     * Register handler of all types including express and socket.io handlers.
     * @param  {Object} that     kettle.server.
     * @param  {Object} handlers Handlers spec defined by the kettle.app.
     */
    kettle.use.io.registerHandlers = function (that, handlers) {
        var ioHandlers = {};
        fluid.each(handlers, function register(handler, context) {
            if (!handler) {
                return;
            }
            if (handler.type === "io") {
                ioHandlers[context] = handler;
            } else {
                kettle.server.registerHandler(that.server, handler, context);
            }
        });

        that.io.sockets.on("connection", function onConnection(socket) {
            fluid.each(ioHandlers, function register(handler, context) {
                kettle.use.io.registerHandler(that.requests, socket, handler,
                    context);
            });
        });
    };

})();
