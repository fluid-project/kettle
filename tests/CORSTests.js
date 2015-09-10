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

"use strict";

var fluid = require("infusion"),
    path = require("path"),
    kettle = require("../kettle.js"),
    jqUnit = fluid.require("jqUnit"),
    configPath = path.resolve(__dirname, "./configs");

kettle.loadTestingSupport();

fluid.defaults("kettle.tests.CORS.handler", {
    gradeNames: "kettle.request.http",
    requestMiddleware: {
        CORS: {
            middleware: "{middlewareHolder}.CORS"
        }
    },
    invokers: {
        handleRequest: "kettle.tests.testGetCORS"
    }
});

fluid.defaults("kettle.tests.noCORS.handler", {
    gradeNames: "kettle.tests.CORS.handler",
    requestMiddleware: {
        CORS: {
            middleware: "{middlewareHolder}.null"
        }
    }
});


kettle.tests.testCORSOrigin = "localhost:8081";

kettle.tests.testGetCORS = function (request) {
    console.log("Handling request");
    jqUnit.assertTrue("The request was received", true);
    request.events.onSuccess.fire({
        success: true
    });
};

kettle.tests.CORS.success = {
    success: true
};

kettle.tests.CORS.testResponse = function (data, request) {
    kettle.test.assertJSONResponse({
        message: "Test CORS Response",
        string: data,
        request: request,
        expected: kettle.tests.CORS.success
    });
    kettle.tests.CORS.testResponseHeaders(data, request);
};

kettle.tests.CORS.testResponse_NoCred = function (data, request) {
    kettle.test.assertJSONResponse({
        message: "Test CORS Response with no credentials",
        string: data,
        request: request,
        expected: kettle.tests.CORS.success
    });
    kettle.tests.CORS.testResponseHeaders(data, request, "false");
};

kettle.tests.CORS.testResponse_Origin = function (data, request) {
    kettle.test.assertJSONResponse({
        message: "Test CORS Response without origin",
        string: data,
        request: request,
        expected: kettle.tests.CORS.success
    });
    kettle.tests.CORS.testResponseHeaders(data, request, "true", "null");
};


kettle.tests.CORS.testResponseHeaders = function (data, request, credentials, origin) {
    var headers = request.nativeResponse.headers;
    console.log("Testing headers ", headers);
    jqUnit.assertEquals("CORS origin is correct",
        origin || kettle.tests.testCORSOrigin,
        headers["access-control-allow-origin"]);
    jqUnit.assertEquals("CORS headers are correct", credentials || "true",
        headers["access-control-allow-credentials"]);
    jqUnit.assertEquals("CORS headers are correct", "X-Requested-With,Content-Type",
        headers["access-control-allow-headers"]);
    jqUnit.assertEquals("CORS methods are correct", "GET,OPTIONS,PUT,POST",
        headers["access-control-allow-methods"]);
};

kettle.tests.CORS.testNoCORSResponse = function (data, request) {
    kettle.test.assertJSONResponse({
        message: "Test Response without CORS middleware configured",
        string: data,
        request: request,
        expected: kettle.tests.CORS.success
    });
    var headers = request.nativeResponse.headers;
    jqUnit.assertUndefined("CORS origin is correct",
        headers["access-control-allow-origin"]);
    jqUnit.assertUndefined("CORS headers are correct",
        headers["access-control-allow-headers"]);
    jqUnit.assertUndefined("CORS methods are correct",
        headers["access-control-allow-methods"]);
};

var testDefs = [ {
    name: "CORS middleware tests",
    expect: 12,
    config: {
        configName: "kettle.tests.CORS.config",
        configPath: configPath
    },
    components: {
        corsRequest: {
            type: "kettle.test.request.http",
            options: {
                headers: {
                    "Origin": kettle.tests.testCORSOrigin
                }
            }
        },
        optionsCorsRequest: {
            type: "kettle.test.request.http",
            options: {
                method: "OPTIONS",
                headers: {
                    "Origin": kettle.tests.testCORSOrigin
                }
            }
        }
    },
    sequence: [{
        func: "{corsRequest}.send"
    }, {
        event: "{corsRequest}.events.onComplete",
        listener: "kettle.tests.CORS.testResponse"
    }, {
        func: "{optionsCorsRequest}.send"
    }, {
        event: "{optionsCorsRequest}.events.onComplete",
        listener: "kettle.tests.CORS.testResponseHeaders",
        args: ["{arguments}.0", "{arguments}.1"]
    }]
}, {
    name: "CORS middleware no credential tests",
    expect: 7,
    config: {
        configName: "kettle.tests.CORS.noCred.config",
        configPath: configPath
    },
    components: {
        corsRequest: {
            type: "kettle.test.request.http",
            options: {
                headers: {
                    "Origin": kettle.tests.testCORSOrigin
                }
            }
        }
    },
    sequence: [{
        func: "{corsRequest}.send"
    }, {
        event: "{corsRequest}.events.onComplete",
        listener: "kettle.tests.CORS.testResponse_NoCred"
    }]
}, {
    name: "CORS middleware custom origin tests",
    expect: 14,
    config: {
        configName: "kettle.tests.CORS.origin.config",
        configPath: configPath
    },
    components: {
        corsRequest: {
            type: "kettle.test.request.http",
            options: {
                headers: {
                    "Origin": kettle.tests.testCORSOrigin
                }
            }
        },
        invalidCorsRequest: {
            type: "kettle.test.request.http",
            options: {
                headers: {
                    "Origin": "invaliddomain.com"
                }
            }
        }
    },
    sequence: [{
        func: "{corsRequest}.send"
    }, {
        event: "{corsRequest}.events.onComplete",
        listener: "kettle.tests.CORS.testResponse"
    }, {
        func: "{invalidCorsRequest}.send"
    }, {
        event: "{invalidCorsRequest}.events.onComplete",
        listener: "kettle.tests.CORS.testResponse_Origin"
    }]
}, {
    name: "No CORS middleware tests",
    expect: 6,
    config: {
        configName: "kettle.tests.CORS.noCORS.config",
        configPath: configPath
    },
    components: {
        request: {
            type: "kettle.test.request.http"
        }
    },
    sequence: [{
        func: "{request}.send"
    }, {
        event: "{request}.events.onComplete",
        listener: "kettle.tests.CORS.testNoCORSResponse"
    }]
} ];

kettle.test.bootstrapServer(testDefs);
