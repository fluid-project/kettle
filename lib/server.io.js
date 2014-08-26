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
            }],
            onStopped: "kettle.server.io.shred({that})"
        },
        registerHandlerEventMap: {
            io: "{that}.events.onRegisterIOHandler"
        },
        invokers: {
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
        // NOTE: See http://issues.fluidproject.org/browse/FLUID-5226
        that.io = require("socket.io").listen(that.httpServer);
        fluid.each(that.options.ioOptions.set, function (val, key) {
            that.io.set(key, val);
        });
    };

    kettle.server.io.shred = function (that) {
        delete that.io;
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
                that.requests.events.onHandleRequest.fire(socket.fluidRequest, context);
            });
        });
    };

})();
