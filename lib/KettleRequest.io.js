/**
 * Kettle Requests for use with socket.io
 *
 * Copyright 2012-2013 OCAD University
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/gpii/kettle/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    kettle = fluid.registerNamespace("kettle");

fluid.defaults("kettle.requests.io", {
    gradeNames: ["fluid.component"],
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
                send: "{arguments}.2",
                gradeNames: "{arguments}.3"
            }
        }
    }
});

/**
 * Socket.io request/response sequence object.
 */
fluid.defaults("kettle.request.io", {
    gradeNames: ["kettle.request"],
    mergePolicy: {
        "socket": "nomerge"
    },
    members: {
        socket: "{that}.options.socket",
        data: "{that}.options.data",
        send: "{that}.options.send"
    },
    listeners: {
        "onCreate.ensureResponseDisposes": {
            funcName: "kettle.request.io.ensureResponseDisposes",
            priority: "before:handleRequest"
        },
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
            funcName: "kettle.request.io.onErrorHandler",
            args: ["{that}.socket", "{that}.send", "{arguments}.0"]
        },
        onSuccessHandler: {
            funcName: "kettle.request.io.onSuccessHandler",
            args: ["{that}.send", "{arguments}.0"]
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
kettle.request.io.ensureResponseDisposes = function (that) {
    that.socket.on("disconnect", function () {
        if (!fluid.isDestroyed(that)) {
            that.events.onRequestEnd.fire();
            that.destroy();
        }
    });
};

/**
 * Send an error message to the client if the error event is fired.
 * @param  {Function} send a response.send function.
 * @param  {Object}   response an error message.
 */
kettle.request.io.onErrorHandler = function (socket, send, error) {
    if (!send) {
        return;
    }
    error = error || {
        isError: true,
        message: "Unknown error"
    };
    socket.emit("error", error);
};

/**
 * Send a successful message to the client if the success event is fired.
 * @param  {Function} send a response.send function.
 * @param  {Object} response a success message.
 */
kettle.request.io.onSuccessHandler = function (send, response) {
    if (!send) {
        return;
    }
    send(response);
};
