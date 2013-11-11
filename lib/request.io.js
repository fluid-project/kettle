/**
 * Kettle Requests.
 *
 * Copyright 2012-2013 OCAD University
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/gpii/kettle/LICENSE.txt
 */

(function () {

    "use strict";

    var fluid = require("infusion"),
        uuid = require("node-uuid"),
        kettle = fluid.registerNamespace("kettle");

    fluid.defaults("kettle.requests.io", {
        gradeNames: ["autoInit", "fluid.eventedComponent"],
        events: {
            onNewIORequest: null
        },
        dynamicComponents: {
            ioRequest: {
                createOnEvent: "onNewIORequest",
                type: "kettle.requests.request.io",
                options: {
                    socket: "{arguments}.0",
                    data: "{arguments}.1",
                    send: "{arguments}.2"
                }
            }
        }
    });

    /**
     * Socket.io request/response sequence object.
     */
    fluid.defaults("kettle.requests.request.io", {
        gradeNames: ["autoInit", "kettle.requests.request"],
        mergePolicy: {
            "socket": "preserve, nomerge"
        },
        members: {
            socket: "{that}.options.socket",
            data: "{that}.options.data",
            send: "{that}.options.send"
        },
        listeners: {
            onError: [
                "{that}.events.onRequestEnd.fire",
                "{that}.destroy"
            ],
            onSuccess: [
                "{that}.events.onRequestEnd.fire",
                "{that}.destroy"
            ]
        },
        invokers: {
            onErrorHandler: {
                funcName: "kettle.requests.request.io.onErrorHandler",
                args: ["{that}.send", "{arguments}.0"]
            },
            onSuccessHandler: {
                funcName: "kettle.requests.request.io.onSuccessHandler",
                args: ["{that}.send", "{arguments}.0"]
            },
            ensureResCompleted: {
                funcName: "kettle.requests.request.io.ensureResCompleted"
            },
            // Adding a request object to socket.io's socket.
            attachFluidRequest: {
                funcName: "fluid.set",
                args: ["{that}.socket", "fluidRequest", "{that}"]
            }
        }
    });

    /**
     * Ensure that the request object is cleared on socket diconnect.
     * @param  {Object} that Fluid request object.
     */
    kettle.requests.request.io.ensureResCompleted = function (that) {
        that.socket.on("disconnect", function () {
            that.events.onRequestEnd.fire();
            that.destroy();
        });
    };

    /**
     * Send an error message to the client if the error event is fired.
     * @param  {Function} send a response.send function.
     * @param  {Object}   response an error message.
     */
    kettle.requests.request.io.onErrorHandler = function (send, error) {
        if (!send) {
            return;
        }
        error = error || {
            isError: true,
            message: "Unknown error"
        };
        send(error);
    };

    /**
     * Send a successful message to the client if the success event is fired.
     * @param  {Function} send a response.send function.
     * @param  {Object} response a success message.
     */
    kettle.requests.request.io.onSuccessHandler = function (send, response) {
        if (!send) {
            return;
        }
        send(response);
    };

})();
