/**
 * Kettle Middleware Tests
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

kettle.tests.testGetCORS = function (requestProxy) {
    jqUnit.assertTrue("The request was received.", true);
    requestProxy.events.onSuccess.fire({
        success: true
    });
};

kettle.tests.testCORSResponse = function (data, headers) {
    kettle.tests.testResponseData(data, headers);
    kettle.tests.testCORSResponseHeaders(data, headers);
};

kettle.tests.testResponseData = function (data) {
    jqUnit.assertDeepEq("The response is correct.", {
        success: true
    }, JSON.parse(data));
};

kettle.tests.testCORSResponseHeaders = function (data, headers) {
    jqUnit.assertEquals("CORS origin is correct", "*",
        headers["access-control-allow-origin"]);
    jqUnit.assertEquals("CORS headers are correct", "X-Requested-With,Content-Type",
        headers["access-control-allow-headers"]);
    jqUnit.assertEquals("CORS methods are correct", "GET,OPTIONS",
        headers["access-control-allow-methods"]);
};

kettle.tests.testNoCORSResponse = function (data, headers) {
    kettle.tests.testResponseData(data, headers);
    jqUnit.assertUndefined("CORS origin is correct",
        headers["access-control-allow-origin"]);
    jqUnit.assertUndefined("CORS headers are correct",
        headers["access-control-allow-headers"]);
    jqUnit.assertUndefined("CORS methods are correct",
        headers["access-control-allow-methods"]);
};

var testDefs = [{
    name: "CORS middleware tests.",
    expect: 8,
    config: {
        nodeEnv: "CORS",
        configPath: configPath
    },
    components: {
        corsRequest: {
            type: "kettle.tests.request"
        },
        optionsCorsRequest: {
            type: "kettle.tests.request",
            options: {
                requestOptions: {
                    method: "OPTIONS"
                }
            }
        }
    },
    sequence: [{
        func: "{corsRequest}.send"
    }, {
        event: "{corsRequest}.events.onComplete",
        listener: "kettle.tests.testCORSResponse"
    }, {
        func: "{optionsCorsRequest}.send"
    }, {
        event: "{optionsCorsRequest}.events.onComplete",
        listener: "kettle.tests.testCORSResponseHeaders"
    }]
}, {
    name: "No CORS middleware tests.",
    expect: 5,
    config: {
        nodeEnv: "noCORS",
        configPath: configPath
    },
    components: {
        request: {
            type: "kettle.tests.request"
        }
    },
    sequence: [{
        func: "{request}.send"
    }, {
        event: "{request}.events.onComplete",
        listener: "kettle.tests.testNoCORSResponse"
    }]
}];

kettle.tests.runTests(testDefs);
