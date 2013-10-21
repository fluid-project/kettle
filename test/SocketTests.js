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

kettle.tests.testSocketResponse = function (data) {
    jqUnit.assertDeepEq("Socket message delivered confirmed", {
        success: true
    }, data);
};

var testDefs = [{
    name: "Socket tests.",
    expect: 4,
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
    }]
}];

kettle.tests.runTests(testDefs);
