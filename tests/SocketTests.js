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

fluid.defaults("kettle.requests.request.handler.testSocket", {
    gradeNames: ["fluid.component"],
    invokers: {
        handle: {
            funcName: "kettle.tests.socket.testSocket",
            args: ["{requestProxy}", "{request}.data"],
            dynamic: true
        }
    }
});

fluid.defaults("kettle.requests.request.handler.testGet", {
    gradeNames: ["fluid.component"],
    invokers: {
        handle: {
            funcName: "kettle.tests.socket.testGet",
            args: "{requestProxy}"
        }
    }
});

fluid.registerNamespace("kettle.tests.socket");

kettle.tests.socket.testGet = function (requestProxy) {
    jqUnit.assertTrue("The request was received.", true);
    requestProxy.events.onSuccess.fire({
        success: true
    });
};

kettle.tests.socket.testSocketCount = 0;

kettle.tests.socket.testSocket = function (requestProxy, data) {
    jqUnit.assertDeepEq("Socket message data is correct", {
        index: kettle.tests.socket.testSocketCount++,
        test: true
    }, data);
    requestProxy.events.onSuccess.fire({
        success: true
    });
};

kettle.tests.socket.testResponse = function (data /*, headers*/ ) {
    jqUnit.assertDeepEq("The response is correct.", {
        success: true
    }, JSON.parse(data));
};

kettle.tests.socket.testSocketResponse = function (data) {
    jqUnit.assertDeepEq("Socket message delivered confirmed", {
        success: true
    }, data);
};

kettle.tests.socket.testDefs = [{
    name: "Socket tests",
    expect: 6,
    config: {
        configName: "socket",
        configPath: configPath
    },
    components: {
        ioRequest: {
            type: "kettle.test.request.io",
            options: {
                path: "/socket_path",
                listenOnInit: true
            }
        },
        httpRequest: {
            type: "kettle.test.request.http"
        }
    },
    sequence: [{
        func: "{ioRequest}.send",
        args: {
            index: 0,
            test: true
        }
    }, {
        event: "{ioRequest}.events.onComplete",
        listener: "kettle.tests.socket.testSocketResponse"
    }, {
        func: "{ioRequest}.send",
        args: {
            index: 1,
            test: true
        }
    }, {
        event: "{ioRequest}.events.onComplete",
        listener: "kettle.tests.socket.testSocketResponse"
    }, {
        func: "{httpRequest}.send"
    }, {
        event: "{httpRequest}.events.onComplete",
        listener: "kettle.tests.socket.testResponse"
    }]
}];

kettle.test.bootstrapServer(kettle.tests.socket.testDefs);
