/**
 * Kettle Bad Request Tests
 *
 * Copyright 2020 Raising The Floor - International
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    jqUnit = fluid.registerNamespace("jqUnit"),
    kettle = fluid.require("%kettle");

kettle.loadTestingSupport();

require("./shared/SingleRequestTestDefs.js");
require("./shared/HTTPMethodsTestDefs.js");

kettle.tests.slowishMiddlewareHandler = function (req, res, next) {
    setTimeout(function () {
        next();
    }, 500);
};

fluid.defaults("kettle.tests.slowishMiddleware", {
    gradeNames: "kettle.plainAsyncMiddleware",
    middleware: kettle.tests.slowishMiddlewareHandler
});

fluid.registerNamespace("kettle.tests.requestAbort");

kettle.tests.requestAbort.exceptionHandler = function () {
    jqUnit.fail("Client abort should not cause global error");
};

kettle.tests.requestAbort.abortRequest = function (req) {
    setTimeout(function () {
        req.abort();
    }, 10);
};

kettle.tests.requestAbort.assertResponse = function (response) {
    jqUnit.assert("Received special response structure");
    jqUnit.assertTrue("Message mentions socket", response.string.includes("socket"));
};

kettle.tests.requestAbort.waitExplosion = function () {
    var togo = fluid.promise();
    setInterval(togo.resolve, 1000);
    return togo;
};

fluid.defaults("kettle.tests.requestAbort.testDefTemplate", {
    gradeNames: "fluid.component",
    mergePolicy: {
        sequence: "noexpand"
    },
    components: {
        testRequest: {
            type: "kettle.test.request.http",
            options: {
                path: "/",
                method: "GET",
                failOnError: false
            }
        }
    },
    sequence: [
        { // Beat jqUnit's failure handler so we can test Kettle's
            funcName: "kettle.test.pushInstrumentedErrors",
            args: "kettle.tests.requestAbort.exceptionHandler"
        }, {
            func: "{testRequest}.send"
        }, {
            func: "kettle.tests.requestAbort.abortRequest",
            args: "{testRequest}.nativeRequest"
        }, {
            event: "{testRequest}.events.onComplete",
            listener: "kettle.tests.requestAbort.assertResponse",
            args: {
                string: "{arguments}.0",
                request: "{testRequest}"
            }
        }, {
            task: "kettle.tests.requestAbort.waitExplosion",
            resolve: "fluid.identity"
        }, {
            funcName: "kettle.test.popInstrumentedErrors"
        }
    ]
});

fluid.defaults("kettle.tests.requestAbort.handler", {
    gradeNames: "kettle.request.http",
    components: {
        slowishMiddleware: {
            type: "kettle.tests.slowishMiddleware"
        }
    },
    requestMiddleware: {
        slowishMiddleware: {
            middleware: "{kettle.request.http}.slowishMiddleware"
        }
    },
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.HTTPMethods.get.handleRequest"
        }
    }
});

fluid.defaults("kettle.tests.requestAbort.config", {
    handler: {
        type: "kettle.tests.requestAbort.handler"
    },
    name: "Request abort test",
    message: "Client abort should not have produced global error",
    errorTexts: ["socket"]
});

kettle.tests.singleRequest.executeTests(["kettle.tests.requestAbort.config"],
    "kettle.tests.requestAbort.testDefTemplate", false);
