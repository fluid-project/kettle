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

/*global require, __dirname*/

var fluid = require("infusion"),
    path = require("path"),
    kettle = fluid.require(path.resolve(__dirname, "../kettle.js")),
    jqUnit = fluid.require("jqUnit"),
    configPath = path.resolve(__dirname, "./configs");

fluid.require(path.resolve(__dirname, "./utils/js/KettleTestUtils.js"));

fluid.defaults("kettle.requests.request.handler.testSocket", {
    gradeNames: ["fluid.littleComponent", "autoInit"],
    invokers: {
        handle: {
            funcName: "kettle.tests.testSocket",
            args: ["{requestProxy}", "{request}.data"]
        }
    }
});

fluid.defaults("kettle.requests.request.handler.testGet", {
    gradeNames: ["fluid.littleComponent", "autoInit"],
    invokers: {
        handle: {
            funcName: "kettle.tests.testGet",
            args: "{requestProxy}"
        }
    }
});

kettle.tests.testGet = function (requestProxy) {
    jqUnit.assertTrue("The request was received.", true);
    requestProxy.events.onSuccess.fire({
        success: true
    });
};

kettle.tests.testSocketCount = 0;

kettle.tests.testSocket = function (requestProxy, data) {
    jqUnit.assertDeepEq("Socket message data is correct", {
        index: kettle.tests.testSocketCount++,
        test: true
    }, data);
    requestProxy.events.onSuccess.fire({
        success: true
    });
};

kettle.tests.testResponse = function (data, headers) {
    jqUnit.assertDeepEq("The response is correct.", {
        success: true
    }, JSON.parse(data));
};

kettle.tests.testSocketResponse = function (data) {
    jqUnit.assertDeepEq("Socket message delivered confirmed", {
        success: true
    }, data);
};

var testDefs = [{
    name: "Socket tests.",
    expect: 6,
    config: {
        nodeEnv: "socket",
        configPath: configPath
    },
    components: {
        ioRequest: {
            type: "kettle.tests.request.io",
            options: {
                requestOptions: {
                    path: "socket_path"
                }
            }
        },
        httpRequest: {
            type: "kettle.tests.request.http"
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
        listener: "kettle.tests.testSocketResponse"
    }, {
        func: "{ioRequest}.send",
        args: {
            index: 1,
            test: true
        }
    }, {
        event: "{ioRequest}.events.onComplete",
        listener: "kettle.tests.testSocketResponse"
    }, {
        func: "{httpRequest}.send"
    }, {
        event: "{httpRequest}.events.onComplete",
        listener: "kettle.tests.testResponse"
    }]
}];

kettle.tests.runTests(testDefs);
