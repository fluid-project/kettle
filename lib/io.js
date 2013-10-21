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
        distributeOptions: [{
            source: "{that}.options.requestsType",
            target: "{that requests}.type"
        }, {
            source: "{that}.options.requestProxyGradeNames",
            target: "{that requestProxy}.options.gradeNames"
        }],
        requestsType: "kettle.requests.io",
        requestProxyGradeNames: ["kettle.requestProxy.io"],
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
        that.httpServer.close();
        delete that.httpServer;
        delete that.server;
        delete that.io;
    };

    /**
     * Register a handler for a socket connection.
     * @param  {Object} requests Request creator component.
     * @param  {Object} io       socket.io instance.
     * @param  {Object} handler  Handler spec defind by the kettle.app.
     * @param  {String} context  Context for the handler.
     */
    kettle.use.io.registerHandler = function (requests, io, handler, context) {
        io.sockets.on("connection", function onConnection(socket) {
            socket.on(handler.route, function onMessage(data, send) {
                requests.createIO(socket);
                var request = socket.fluidRequest;
                request.data = data;
                request.send = send;
                request.handlerContext = fluid.model.composeSegments(
                    "kettle.requests.request.handler", context);
                request.events.handle.fire();
            });
        });
    };

    /**
     * Register handler of all types including express and socket.io handlers.
     * @param  {Object} io       socket.io instance.
     * @param  {Object} that     kettle.server.
     * @param  {Object} handlers Handlers spec defined by the kettle.app.
     */
    kettle.use.io.registerHandlers = function (that, handlers) {
        fluid.each(handlers, function register(handler, context) {
            if (!handler) {
                return;
            }
            if (handler.type === "io") {
                kettle.use.io.registerHandler(that.requests, that.io, handler,
                    context);
            } else {
                kettle.server.registerHandler(that.server, handler, context);
            }
        });
    };

})();
