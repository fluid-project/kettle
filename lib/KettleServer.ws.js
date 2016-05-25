/**
 * Kettle support for websockets/ws WebSockets-based I/O
 *
 * Copyright 2013 OCAD University
 * Copyright 2015 Raising the Floor (International)
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    kettle = fluid.registerNamespace("kettle");
    
fluid.require("ws", require, "kettle.npm.ws");

/**
 * A grade that can be applied to the kettle.server component that extends
 * its capabilities to support WebSockets based requests
 */
fluid.defaults("kettle.server.ws", {
    members: {
        wsServer: "@expand:kettle.server.ws.create({that}, {that}.dispatcher, {that}.options.wsServerOptions, {that}.httpServer)"
    },
    wsServerOptions: {
        disableHixie: true
    },
    listeners: {
        "onStopped.shredWs": "kettle.server.ws.shred({that})"
    }
});

// Construct a fake "response" object for the purpose of fooling the session middleware into
// executing, which would be expecting to return a cookie header for a standard HTTP request
kettle.server.ws.fakeResponse = function () {
    return {};
};

kettle.server.ws.create = function (server, dispatcher, wsServerOptions, httpServer) {
    fluid.log("Initializing the ws server");
    var options = fluid.extend({
        server: httpServer,
        // The entirety of the standard express middleware chain is packed into our "verifyClient" handler, that will reject handshake if any reject
        // https://github.com/websockets/ws/blob/master/doc/ws.md#optionsverifyclient
        verifyClient: function (info, callback) {
            dispatcher(info.req, kettle.server.ws.fakeResponse(), callback, {expectedRequestGrade: "kettle.request.ws"});
        }
    }, wsServerOptions);
    var wsServer = new kettle.npm.ws.Server(options);
    wsServer.on("connection", function (ws) {
        var req = ws.upgradeReq;
        var request = req.fluidRequest;
        fluid.log("Received WebSockets connection on path ", req.url);
        request.ws = ws;
        kettle.withRequest(request, function () {
            request.events.onBindWs.fire(request, ws);
        })();
    });
    return wsServer;
};

kettle.server.ws.shred = function (that) {
    delete that.ws;
};
