/**
 * Kettle Test Utilities for WebSockets
 *
 * Contains facilities for issuing WebSocketsrequests encoded declaratively as Infusion components
 * Copyright 2013-2015 Raising the Floor (International)
 * Copyright 2013 OCAD University
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/gpii/universal/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    kettle = fluid.registerNamespace("kettle");

fluid.require("ws", require, "kettle.npm.ws");

fluid.defaults("kettle.test.request.ws", {
    gradeNames: ["kettle.test.request"],
    receiveJSON: true, // deserialize all received data as JSON
    sendJSON: true, // serialize all sent data as JSON
    webSocketsProtocols: null, // forwarded to "protocols" argument of new ws.WebSocket()
    invokers: {
        connect: {
            funcName: "kettle.test.request.ws.connect",
            args: ["{that}", "{cookieJar}", "{arguments}.0"]
        },
        send: {
            funcName: "kettle.test.request.ws.send",
            args: [
                "{that}",
                "{arguments}.0", // model
                "{arguments}.1"  // send options: https://github.com/websockets/ws/blob/master/doc/ws.md#websocketsenddata-options-callback
            ]
        },
        disconnect: {
            funcName: "kettle.test.request.ws.disconnect",
            args: "{that}.ws"
        }
    },
    events: {
        onConnect: null, // fired when we receive "open" for initial connection
        onReceiveMessage: null,
        onError: null // fires if connect fails
    },
    listeners: {
        onDestroy: "{that}.disconnect"
    }
});

// A variety of WebSockets request that retrieve cookies from a "jar" higher in the component tree
fluid.defaults("kettle.test.request.wsCookie", {
    gradeNames: ["kettle.test.request.ws"],
    storeCookies: true
});

// permitted options taken from https://github.com/websockets/ws/blob/master/doc/ws.md#new-wswebsocketaddress-protocols-options
kettle.test.request.ws.requestOptions = ["protocol", "agent", "headers", "protocolVersion", "hostname", "port", "path", "termMap"];

kettle.test.request.ws.connect = function (that, cookieJar, directOptions) {
    if (that.ws) {
        fluid.fail("You cannot reuse a kettle.test.request.ws object once it has connected - please construct a fresh component for this request");
    }
    var requestOptions = kettle.dataSource.URL.prepareRequestOptions(that.options, cookieJar, directOptions, kettle.test.request.ws.requestOptions, that.resolveUrl);

    var url = "ws://" + requestOptions.hostname + ":" + requestOptions.port + requestOptions.path;
    fluid.log("connecting ws.WebSocket to: " + url + " with request options ", requestOptions);

    that.ws = new kettle.npm.ws(url, that.options.webSocketsProtocols, requestOptions);
    that.ws.on("open", function () {
        that.events.onConnect.fire(that);
    });
    that.ws.on("unexpected-response", function (req, res) { // mined out of the source code of ws WebSockets.js to get extra detail on native HTTP response
        that.nativeResponse = { // to enable parallel processing of errors as for kettle.test.request.http
            statusCode: res.statusCode
        };
        that.events.onError.fire(// Fabricate a response body as if from HTTP response which we can't read
             JSON.stringify({statusCode: res.statusCode,
             isError: true,
             message: "Unexpected HTTP response where WebSockets response was expected"}), that, res);
    });
    that.ws.on("error", function (err) {
        fluid.log("kettle.test.request.ws.connect client error on connect ", err);
        that.events.onError.fire(that, err);
    });
    that.ws.on("message", function (data) {
        fluid.log("kettle.test.request.ws.connect client message ", data);
        that.events.onReceiveMessage.fire(that.options.receiveJSON ? kettle.JSON.parse(data) : data, that);
    });
};

kettle.test.request.ws.disconnect = function (ws) {
    if (ws) {
        ws.terminate();
    }
};

kettle.test.request.ws.send = function (that, model, directOptions) {
    if (!that.ws) {
        fluid.fail("Error in kettle.test.request.ws.send - you must first call connect() on this request object before calling send()");
    }
    var togo = fluid.promise();
    var text = that.options.sendJSON ? JSON.stringify(model) : model;
    that.ws.send(text, directOptions, function (err) {
        if (err) {
            that.events.onError.fire(that, err); // TODO: somehow advertise to users that they should not double-handle
            togo.reject(err);
        } else {
            togo.resolve();
        }
    });
    return togo;
};
