/**
 * Kettle support for einaros ws WebSockets-based I/O
 *
 * Copyright 2013 OCAD University
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
    $ = fluid.registerNamespace("jQuery"),
    kettle = fluid.registerNamespace("kettle");
    
fluid.require("ws", require, "kettle.npm.ws");

/**
 * A grade that can be applied to the kettle.server component that extends
 * its capabilities to support WebSockets based requests
 */
fluid.defaults("kettle.server.ws", {
    members: {
        wsServer: "@expand:kettle.server.ws.create({that}.dispatcher, {that}.options.wsServerOptions, {that}.httpServer)"
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

kettle.server.ws.create = function (dispatcher, wsServerOptions, httpServer) {
    fluid.log("Initializing the ws server");
    var options = $.extend({
        server: httpServer
    }, wsServerOptions);
    var wsServer = new kettle.npm.ws.Server(options);
    wsServer.on("connection", function (ws) {
        var req = ws.upgradeReq;
        console.log("Received WebSockets connection on path ", req.url);
        dispatcher(req, kettle.server.ws.fakeResponse(), fluid.identity, {ws: ws, expectedRequestGrade: "kettle.request.ws"});
    });
    return wsServer;
};

kettle.server.ws.shred = function (that) {
    delete that.ws;
};
