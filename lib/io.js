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
        io = fluid.registerNamespace("kettle.io"),
        kettle = fluid.registerNamespace("kettle");

    /**
     * A grade that can be applied to the kettle.server component that extends
     * its capabilities to support socket.io.
     */
    fluid.defaults("kettle.use.io", {
        gradeNames: ["autoInit", "fluid.littleComponent"],
        distributeOptions: [{
            source: "{that}.options.requestsGradeNames",
            target: "{that requests}.options.gradeNames"
        }],
        requestsGradeNames: ["kettle.requests.io"],
        members: {
            io: {
                expander: {
                    func: "kettle.use.io.listen",
                    args: "{that}.server"
                }
            }
        },
        invokers: {
            registerHandlers: {
                funcName: "kettle.use.io.registerHandlers",
                args: ["{that}", "{that}.options.handlers"]
            }
        }
    });

    /**
     * Register a handler for a socket connection.
     * @param  {Object} requests Request creator component.
     * @param  {Object} io       socket.io instance.
     * @param  {Object} handler  Handler spec defind by the kettle.app.
     * @param  {String} context  Context for the handler.
     */
    kettle.use.io.registerHandler = function (requests, io, handler, context) {
        handler.namespace = handler.namespace || "/";
        io.of(handler.namespace)
          .on("connection", function onConnection(socket) {
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
    kettle.use.io.registerHandlers = function (io, that, handlers) {
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

    /**
     * Enable socket.io support within the express server.
     * @param  {Object} server Express app.
     * @return {Object}        socket.io instance.
     */
    kettle.use.io.listen = function (server) {
        return require("socket.io").listen(server);
    };

})();
