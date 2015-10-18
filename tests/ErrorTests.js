/**
 * Kettle Error Support Tests
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

fluid.registerNamespace("kettle.tests.error");

fluid.defaults("kettle.tests.error.requestError", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: {
            funcName: "fluid.fail",
            args: "Simulated assertion failed in request - this failure is expected: "
        },
        handleFullRequest: "kettle.tests.error.handleFullRequest"
    }
});

// Test overriding of "full request handler" in order to demonstrate forwarding failures to express
kettle.tests.error.handleFullRequest = function (request, fullRequestPromise, next) {
    fullRequestPromise.then(function () {
        next();
    }, function (err) {
        request.events.onRequestError.fire(err);
        console.log("FORWARDING ERROR TO EXPRESS");
        next(err);
    });
};

fluid.defaults("kettle.tests.error.requestErrorCode", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.triggerOnErrorCode"
        }
    }
});

kettle.tests.triggerOnErrorCode = function (request) {
    request.events.onError.fire({
        isError: true,
        message: "Unauthorised",
        statusCode: 401
    });
};

kettle.tests.triggerGlobalErrorSync = function () {
    //fluid.onUncaughtException.fire("Global Error Triggered");
    // we'd like to do the following but it busts express permanently
    "Global Error Triggered".triggerError();
};


kettle.tests.triggerGlobalErrorAsync = function () {
    process.nextTick(function () {
         // Trigger this error asynchronously to avoid infuriating any of the testing frameworks 
        kettle.tests.triggerGlobalErrorSync();
    });
};

Error.stackTraceLimit = 100;

kettle.tests.awaitGlobalError = function (priority, message) {
    jqUnit.assert(message);
};

fluid.defaults("kettle.tests.logNotifierHolder", {
    gradeNames: ["fluid.component", "fluid.resolveRootSingle"],
    singleRootType: "kettle.tests.logNotifierHolder",
    events: {
        logNotifier: null
    }
});

var logNotifierHolder = kettle.tests.logNotifierHolder();

kettle.tests.notifyGlobalError = function () {
    logNotifierHolder.events.logNotifier.fire(fluid.makeArray(arguments));
};

kettle.tests.assertHttpStatusError = function (statusCode) {
    jqUnit.assertTrue("HTTP status code must be 5xx error", statusCode >= 500 && statusCode < 600);
};

kettle.tests.testRequestErrorStatus = function (request) {
    kettle.tests.assertHttpStatusError(request.nativeResponse.statusCode);
};

kettle.tests.testRequestStatusCode = function (request, expectedCode) {
    jqUnit.assertEquals("Expected HTTP status code", expectedCode, request.nativeResponse.statusCode);
};



// Tests four effects:
// i) Triggering a global error will definitely cause a logged message via the uncaught exception handler
// ii) Triggering an error during a request will also cause a logged message
// iii) Error within request will generate HTTP error status code
// iv) Ability to trigger custom HTTP response code with error 

kettle.tests.error.testDefs = [{
    name: "Error tests",
    expect: 4,
    config: {
        configName: "kettle.tests.error.config",
        configPath: configPath
    },
    components: {
        eventHolder: {
            type: "fluid.component",
            options: {
                events: {
                    logNotifier: "{logNotifierHolder}.events.logNotifier"
                }
            }
        },
        httpRequest: {
            type: "kettle.test.request.http"
        },
        httpRequest2: {
            type: "kettle.test.request.http",
            options: {
                path: "/errorCode"
            }
        }
    },
    sequence: [{ // Beat jqUnit's failure handler so we can test Kettle's rather than jqUnit's
        funcName: "kettle.test.pushInstrumentedErrors",
        args: "kettle.tests.notifyGlobalError"
    }, {
        funcName: "kettle.tests.triggerGlobalErrorAsync",
        args: "{testCaseHolder}"
    }, {
        event: "{eventHolder}.events.logNotifier",
        listener: "kettle.tests.awaitGlobalError"
    }, {
        func: "{httpRequest}.send"
    }, {
        event: "{eventHolder}.events.logNotifier",
        listener: "kettle.tests.awaitGlobalError"
    }, { // TODO: Currently this relies on a timing subtlety to evade bug FLUID-5502 in the IoC testing framework - 
         // we know that our error handler will definitely be invoked before one corresponding to actual I/O
        event: "{httpRequest}.events.onComplete",
        listener: "kettle.tests.testRequestErrorStatus",
        args: ["{httpRequest}"]
    }, {
        funcName: "kettle.test.popInstrumentedErrors"
    }, {
        func: "{httpRequest2}.send"
    }, {
        event: "{httpRequest2}.events.onComplete",
        listener: "kettle.tests.testRequestStatusCode",
        args: ["{httpRequest2}", 401]
    }]
}];

kettle.test.bootstrapServer(kettle.tests.error.testDefs);