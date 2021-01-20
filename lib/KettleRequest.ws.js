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
 * https://github.com/fluid-project/kettle/blob/main/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    kettle = fluid.registerNamespace("kettle");

/*
 * Refinement of the `kettle.request` grade to handle WebSockets connections. Note that unlike `kettle.request.http`
 * components, these requests are long-lived and will process numerous messages whilst the WebSockets bus remains
 * connected. They participate in the Kettle middleware chain only during the process of initial negotiation up
 * from the base HTTP connection.
 */
fluid.defaults("kettle.request.ws", {
    gradeNames: ["kettle.request"],
    members: {
    //      ws: null // arrives on the `connection` message handled by the kettle.server.ws
    },
    events: {
        onBindWs: null,
        onReceiveMessage: null,
        onSendMessage: null
    },
    receiveMessageJSON: true, // deserialize all received data as JSON
    sendMessageJSON: true, // serialize all sent data as JSON
    listeners: {
        "onBindWs.ensureResponseDisposes": {
            funcName: "kettle.request.ws.ensureResponseDisposes",
            priority: "before:handleRequest"
        },
        "onBindWs.listen": {
            funcName: "kettle.request.ws.listen",
            priority: "after:ensureResponseDisposes"
        },
        "onSendMessage.encode": {
            funcName: "kettle.request.ws.sendEncode",
            args: ["{that}.options.sendMessageJSON", "{arguments}.0"],
            priority: "before:send"
        },
        "onSendMessage.send": {
            funcName: "kettle.request.ws.sendMessageImpl",
            args: ["{that}", "{arguments}.0"]
        }
    },
    invokers: {
        sendMessage: {
            funcName: "kettle.request.ws.sendMessage",
            args: ["{that}", "{arguments}.0"] // message
        },
        sendTypedMessage: {
            funcName: "kettle.request.ws.sendTypedMessage",
            args: ["{that}", "{arguments}.0", "{arguments}.1"] // type, payload
        },
        handleRequest: "{request}.handlerPromise.resolve()", // by default we simply proceed
        handleFullRequest: "kettle.request.ws.handleFullRequest"
    }
});

fluid.defaults("kettle.request.ws.mismatch", {
    gradeNames: ["kettle.request.ws", "kettle.request.mismatch"]
});

// This is handed the verifyClient callback from ws
kettle.request.ws.handleFullRequest = function (request, fullRequestPromise, verifyCallback) {
    fullRequestPromise.then(function () {
        request.events.onRequestSuccess.fire();
        verifyCallback(true);
    }, function (err) {
        // note that these onRequestXxxx events by default have no listeners on a ws request
        request.events.onRequestError.fire(err);
        // note that this message cannot be read by the standard client, but we send it anyway. The status code can be read ok
        verifyCallback(false, err.statusCode, err.message);
    });
};

/** Begins listening for firings of the underlying ws `message` event and converts them into firings of the request
 * component's `onReceiveMessage` event with appropriate request marking.
 * @param {kettle.request.ws} that - The request component for which should start listening
 */
kettle.request.ws.listen = function (that) {
    that.ws.on("message", function (message) {
        kettle.withRequest(that, function () {
            message = that.options.receiveMessageJSON ? kettle.JSON.parse(message) : message;
            that.events.onReceiveMessage.fire(that, message);
        })();
    });
};

/**
 * Ensure that the request object is cleared on socket disconnect/close.
 * @param {kettle.request.ws} that - The request component for which we will listen for socket closure and convert this
 * into a firing of the `onRequestEnd` event followed by destruction of the component, if this has not already occurred
 */
kettle.request.ws.ensureResponseDisposes = function (that) {
    that.ws.on("close", kettle.withRequest(that, function () {
        if (!fluid.isDestroyed(that)) {
            that.events.onRequestEnd.fire();
            that.destroy();
        }
    }));
};

/** Utility function to encode a conditionally encode a payload as JSON depending on a flag value
 * @param {Booleanish} encode - If truthy, the supplied payloed will be encoded as JSON
 * @param {Any} data - The payload value
 * @return {Any} Either the original payload, or the payload encoded as JSON
 */
kettle.request.ws.sendEncode = function (encode, data) {
    return encode ? JSON.stringify(data) : data;
};

/** Invokes the transform chain pseudoevent for `onSendMessage`, given an initial message value
 * @param {kettle.request.ws} that - The request component holding the pseudoevent
 * @param {Any} message - The message to be sent as initial chain argument
 * @return {Promise} The resolved value of the `onSendMessage` transform chain, indicating whether the
 * payload was successfuly sent.
 */
kettle.request.ws.sendMessage = function (that, message) {
    var options = {}; // none currently supported
    var promise = fluid.promise.fireTransformEvent(that.events.onSendMessage, message, options);
    return promise;
};

/** The member of the `onSendMessage` transform chain responsible for actually dispatching the appropriately encoded
 * payload over the WebSockets bus.
 * @param {kettle.request.ws} that - The request component holding the WebSockets object
 * @param {Any} message - The message to be sent
 * @return {Promise} A promise for the disposition of sending the payload
 */
kettle.request.ws.sendMessageImpl = function (that, message) {
    var promise = fluid.promise();
    that.ws.send(message, function (err) {
        promise[err ? "reject" : "resolve"](err);
    });
    return promise;
};

/** A very simple utility facilitating the sending of "typed messages" which are payloads framed by a top-level
 * String member `type` and the payload itself into the member `payload`
 * @param {kettle.request.ws} that - The request over which the message is to be sent.
 * @param {String} type - The type to be ascribed to the payload
 * @param {JSONable} payload - The payload to be sent as the message
 * @return {Promise} A promise for the disposition of the message send
 */
kettle.request.ws.sendTypedMessage = function (that, type, payload) {
    return that.sendMessage({
        type: type,
        payload: payload
    });
};
