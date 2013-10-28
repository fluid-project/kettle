/**
 * Kettle Session Support Tests
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

fluid.defaults("kettle.requests.request.handler.testSessionSocket", {
    gradeNames: ["fluid.littleComponent", "autoInit"],
    invokers: {
        handle: {
            funcName: "kettle.tests.testSessionSocket",
            args: ["{requestProxy}", "{request}.data"]
        }
    }
});

kettle.tests.testSessionSocketModel = {
    test: true
};

kettle.tests.testSessionSocketResponse = {
    success: true
};

kettle.tests.testSessionSocket = function (requestProxy, data) {
    jqUnit.assertDeepEq("Socket message data is correct",
        kettle.tests.testSessionSocketModel, data);
    requestProxy.events.onSuccess.fire(kettle.tests.testSessionSocketResponse);
};

kettle.tests.testSocketResponse = function (data) {
    jqUnit.assertDeepEq("Socket message delivered confirmed",
        kettle.tests.testSessionSocketResponse, data);
};

var testDefs = [{
    name: "Session tests.",
    expect: 2,
    config: {
        nodeEnv: "session",
        configPath: configPath
    },
    components: {
        ioRequest: {
            type: "kettle.tests.request.io",
            options: {
                requestOptions: {
                    path: "/testSessionSocket"
                }
            }
        },
        httpRequest: {
            type: "kettle.tests.request.http"
        }
    },
    sequence: [{
        func: "{ioRequest}.send",
        args: kettle.tests.testSessionSocketModel
    }, {
        event: "{ioRequest}.events.onComplete",
        listener: "kettle.tests.testSocketResponse"
    }]
}];

kettle.tests.runTests(testDefs);
