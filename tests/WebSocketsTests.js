/**
 * Kettle Socket Support Tests
 *
 * Copyright 2013 OCAD University
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/GPII/kettle/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    path = require("path"),
    kettle = require("../kettle.js"),
    jqUnit = fluid.require("jqUnit"),
    configPath = path.resolve(__dirname, "./configs");
    
kettle.loadTestingSupport();

fluid.defaults("kettle.tests.ws.testSocket.handler", {
    gradeNames: "kettle.request.ws",
    listeners: {
        onMessage: "kettle.tests.ws.testSocket.receiveMessage"
    }
});


kettle.tests.ws.messageCount = 0;

kettle.tests.ws.testSocket.receiveMessage = function (request, data) {
    jqUnit.assertDeepEq("Socket message data is correct", {
        index: kettle.tests.ws.messageCount++,
        test: true
    }, data);
    request.events.onSuccess.fire({
        success: true
    });
    console.log("Finished receiveMessage");
};

fluid.defaults("kettle.tests.ws.testGet.handler", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.ws.testGet.handleRequest"
        }
    }
});

kettle.tests.ws.testGet.handleRequest = function (request) {
    jqUnit.assertTrue("The request was received.", true);
    request.events.onSuccess.fire({
        success: true
    });
};


kettle.tests.ws.testResponse = function (data /*, headers*/ ) {
    jqUnit.assertDeepEq("The response is correct.", {
        success: true
    }, kettle.JSON.parse(data));
};

kettle.tests.ws.testSocketResponse = function (that, data) {
    jqUnit.assertDeepEq("Socket message delivered confirmed", {
        success: true
    }, data);
    console.log("FINISHED ASSERT");
};

kettle.tests.ws.testDefs = {
    name: "WebSockets tests",
    expect: 7,
    config: {
        configName: "kettle.tests.webSockets.config",
        configPath: configPath
    },
    components: {
        wsRequest: {
            type: "kettle.test.request.ws",
            options: {
                path: "/socket_path"
            }
        },
        httpRequest: {
            type: "kettle.test.request.http"
        }
    },
    sequence: [{
        func: "{wsRequest}.connect"
    }, {
        event: "{wsRequest}.events.onConnect",
        listener: "jqUnit.assert",
        args: "Received WebSockets connection event"
    }, {
        func: "{wsRequest}.send",
        args: {
            index: 0,
            test: true
        }
    }, {
        event: "{wsRequest}.events.onMessage",
        listener: "kettle.tests.ws.testSocketResponse"
    }, {
        func: "{wsRequest}.send",
        args: {
            index: 1,
            test: true
        }
    }, {
        event: "{wsRequest}.events.onMessage",
        listener: "kettle.tests.ws.testSocketResponse"
    }, {
        func: "{httpRequest}.send"
    }, {
        event: "{httpRequest}.events.onComplete",
        listener: "kettle.tests.ws.testResponse"
    }]
};

kettle.test.bootstrapServer(kettle.tests.ws.testDefs);
