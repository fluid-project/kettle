/**
 * Kettle Request for use with WebSockets
 *
 * Copyright 2012-2013 OCAD University
 * Copyright 2015 Raising the Floor (International)
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

/**
 * WebSockets refinement of request object.
 */
fluid.defaults("kettle.request.ws", {
    gradeNames: ["kettle.request"],
    members: {
        ws: "{that}.options.ws"
    },
    events: {
        onMessage: null
    },
    messageJSON: true, // deserialize all received data as JSON
    sendJSON: true, // serialize all sent data as JSON
    listeners: {
        "onCreate.ensureResponseDisposes": {
            funcName: "kettle.request.ws.ensureResponseDisposes",
            priority: "before:handleRequest"
        },
        "onCreate.listen": {
            funcName: "kettle.request.ws.listen",
            priority: "after:ensureResponseDisposes"
        },
        "onError.handle": {
            funcName: "kettle.request.ws.onErrorHandler",
            args: ["{that}", "{arguments}.0"]
        },
        "onSuccess.handle": {
            funcName: "kettle.request.ws.onSuccessHandler",
            args: ["{that}", "{arguments}.0"]
        }
    },
    invokers: {
        handleRequest: "fluid.identity" // implement this since default usage is via onMessage
    }
});

kettle.request.ws.listen = function (that) {
    that.ws.on("message", function (message) {
        message = that.options.messageJSON ? kettle.JSON.parse(message) : message;
        that.events.onMessage.fire(that, message);
    });
};

/**
 * Ensure that the request object is cleared on socket diconnect.
 * @param  {Object} that Fluid request object.
 */
kettle.request.ws.ensureResponseDisposes = function (that) {
    that.ws.on("disconnect", function () {
        console.log("SERVER WS RECEIVED DISCONNECT");
        if (!fluid.isDestroyed(that)) {
            that.events.onRequestEnd.fire();
            that.destroy();
        }
    });
};

kettle.request.ws.onErrorHandler = function (that, error) {
    error = error || {
        isError: true,
        message: "Unknown error"
    };
    console.log("SERVER WS EMITTING ERROR ", error);
    that.ws.emit("error", error);
};

kettle.request.ws.onSuccessHandler = function (that, response) {
    console.log("SUCCESS sending response ", response);
    that.ws.send(that.options.sendJSON ? JSON.stringify(response) : response);
    console.log("SENT");
};
