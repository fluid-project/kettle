/**
 * Kettle Good Request Tests
 *
 * Copyright 2016 Raising The Floor - International
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/kettle/blob/main/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    kettle = fluid.require("%kettle");

kettle.loadTestingSupport();

require("./shared/SingleRequestTestDefs.js");

fluid.registerNamespace("kettle.tests.goodRequest");

fluid.defaults("kettle.tests.goodRequest.testDefTemplate", {
    gradeNames: "fluid.component",
    mergePolicy: {
        sequence: "noexpand"
    },
    expectedStatusCode: 200,
    components: {
        testRequest: {
            type: "kettle.test.request.http",
            options: {
                path: "/",
                method: "GET"
            }
        }
    },
    sequence: [
        {
            func: "{testRequest}.send"
        }, {
            event: "{testRequest}.events.onComplete",
            listener: "kettle.test.assertResponse",
            args: {
                message: "{testCaseHolder}.options.message",
                plainText: "{testCaseHolder}.options.plainText",
                statusCode: "{testCaseHolder}.options.expectedStatusCode",
                expected: "{testCaseHolder}.options.expected",
                expectedSubstring: "{testCaseHolder}.options.expectedSubstring",
                string: "{arguments}.0",
                request: "{testRequest}"
            }
        }
    ]
});

/* Empty parameter test */

fluid.defaults("kettle.tests.goodRequest.emptyParameter.config", {
    handler: {
        type: "kettle.tests.goodRequest.emptyParameter.handler",
        route: "/route/:key?"
    },
    name: "Good request: bad URL-encoded request parameter",
    message: "Received response from successful request with empty parameter",
    expected: {message: "Value of key is undefined"},
    distributeOptions: {
        target: "{that testRequest}.options.path",
        record: "/route"
    }
});

fluid.defaults("kettle.tests.goodRequest.emptyParameter.handler", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.goodRequest.emptyParameter.handleRequest"
        }
    }
});

kettle.tests.goodRequest.emptyParameter.handleRequest = function (request) {
    request.events.onSuccess.fire({message: "Value of key is " + request.req.params.key});
};

/* Double handling test */

fluid.defaults("kettle.tests.goodRequest.doubleResponse.config", {
    handler: {
        type: "kettle.tests.goodRequest.doubleResponse.handler"
    },
    name: "Good request: double handling test",
    message: "Received first response from double handler",
    expected: {message: "First response"}
});

fluid.defaults("kettle.tests.goodRequest.doubleResponse.handler", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.goodRequest.doubleResponse.handleRequest"
        }
    }
});

kettle.tests.goodRequest.doubleResponse.handleRequest = function (request) {
    kettle.withRequest(request, function () { // coverage test for withRequest double wrapping
        request.events.onSuccess.fire({message: "First response"});
        // This second firing will cause a logged message but no failure
        request.events.onSuccess.fire({message: "Second response"});
    })();
};

/* OPTIONS test */

fluid.defaults("kettle.tests.goodRequest.options.config", {
    handler: {
        type: "kettle.tests.goodRequest.options.handler",
        method: "options"
    },
    name: "Good request: options request",
    message: "Received response from successful request with empty parameter",
    expected: undefined,
    expectedStatusCode: 204,
    distributeOptions: {
        target: "{that testRequest}.options.method",
        record: "OPTIONS"
    }
});

fluid.defaults("kettle.tests.goodRequest.options.handler", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.goodRequest.options.handleRequest"
        }
    }
});

kettle.tests.goodRequest.options.handleRequest = function (request) {
    request.events.onSuccess.fire(undefined, {
        statusCode: 204,
        headers: {
            Allow: "OPTIONS"
        }
    });
};


/* Mismatched route test */

fluid.defaults("kettle.tests.goodRequest.mismatchRoute.config", {
    handler: null, // important coverage test - overriding a handler with "null" is a specifically supported technique
    name: "Good request: mismatched route",
    message: "Received response from unhandled request with mismatched route",
    plainText: true,
    expectedSubstring: "Cannot GET /route",
    expectedStatusCode: 404,
    distributeOptions: {
        target: "{that testRequest}.options.path",
        record: "/route"
    }
});

/* KETTLE-45 handler with gradeNames support */

fluid.defaults("kettle.tests.goodRequest.gradeNames.config", {
    handler: {
        type: "kettle.tests.goodRequest.gradeNames.handler",
        gradeNames: "kettle.tests.goodRequest.gradeNames.mixin",
        method: "get"
    },
    name: "Good request: gradeNames for handler",
    message: "Received response from handler with gradeNames",
    expected: {message: "Fetched from derived grade"}
});

fluid.defaults("kettle.tests.goodRequest.gradeNames.handler", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.goodRequest.gradeNames.handleRequest"
        }
    }
});

fluid.defaults("kettle.tests.goodRequest.gradeNames.mixin", {
    gradeNames: "fluid.component",
    mixinValue: "Fetched from derived grade"
});

kettle.tests.goodRequest.gradeNames.handleRequest = function (request) {
    request.events.onSuccess.fire({message: request.options.mixinValue});
};

kettle.tests.goodRequest.testDefs = [
    "kettle.tests.goodRequest.emptyParameter.config",
    "kettle.tests.goodRequest.doubleResponse.config",
    "kettle.tests.goodRequest.options.config",
    "kettle.tests.goodRequest.mismatchRoute.config",
    "kettle.tests.goodRequest.gradeNames.config"
];

kettle.tests.singleRequest.executeTests(kettle.tests.goodRequest.testDefs, "kettle.tests.goodRequest.testDefTemplate");
