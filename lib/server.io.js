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
            }
        },
        ioOptions: {
            set: {
                "log level": 4
            }
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
            registerHandler: {
                funcName: "kettle.server.io.registerHandler",
                args: ["{that}", "{arguments}.0", "{arguments}.1"]
            },
            registerIOHandler: {
                funcName: "kettle.server.io.registerIOHandler",
                args: ["{that}", "{arguments}.0", "{arguments}.1"]
            }
        }
    });

    kettle.server.io.finalInit = function (that) {
        fluid.log("Initializing the socket.io.");
        // TODO: this does not work if we try to declare io as the component
        // member.
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

    /**
     * Register a handler for either http or a socket connection.
     * @param  {Object} that kettle.server.
     * @param  {Object} handler Handler spec defind by the kettle.app.
     * @param  {String} context Context for the handler.
     */
    kettle.server.io.registerHandler = function (that, handler, context) {
        if (handler.type === "io") {
            that.registerIOHandler(handler, context);
        } else {
            kettle.server.registerHandler(that, handler, context);
        }
    };

    /**
     * Register a handler for a socket connection.
     * @param  {Object} that kettle.server.
     * @param  {Object} handler Handler spec defind by the kettle.app.
     * @param  {String} context Context for the handler.
     */
    kettle.server.io.registerIOHandler = function (that, handler, context) {
        var ioHandler = that.io.of(handler.route);
        if (handler.needValidSession) {
            ioHandler.authorization(function onAuth(handshakeData, callback) {
                if (!handshakeData.headers.cookie) {
                    return callback("Session cookie is missing.", false);
                }

                that.cookieParser.parser(handshakeData, {}, fluid.identity);
                var sessionID = handshakeData.signedCookies[
                    that.sessionManager.options.key];
                handshakeData.sessionID = sessionID;

                that.sessionManager.store.load(sessionID,function (err, session) {
                    if (err || !session) {
                        return callback("Session is not found", false);
                    }
                    handshakeData.session = session;
                    return callback(null, true);
                });
            });
        }
        ioHandler.on("connection", function (socket) {
            socket.on("message", function onMessage(data, send) {
                that.requests.events.onNewIORequest.fire(socket, data, send);
                var request = socket.fluidRequest;
                if (handler.needValidSession) {
                    request.session = socket.handshake.session;
                }
                request.handlerContext = fluid.model.composeSegments(
                    "kettle.requests.request.handler", context);
                request.events.handle.fire();
            });
        });
    };

})();
