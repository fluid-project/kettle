/**
 * Kettle Bad Request Tests
 *
 * Copyright 2015 Raising The Floor - International
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    kettle = fluid.require("%kettle");

kettle.loadTestingSupport();

require("./shared/SingleRequestTestDefs.js");
require("./shared/HTTPMethodsTestDefs.js");

fluid.registerNamespace("kettle.tests.badRequest");

// Test the facility to register our own "upgrade error handler" - beat the one within KettleTestUtils
// ignore for unused arguments which must be supplied since app.use ridiculously checks the callee signature
kettle.tests.badRequest.upgradeError = function (server) {
    server.expressApp.use(function (err, req, res, next) { // eslint-disable-line
        kettle.request.http.errorHandler(res, err);
    });
};

fluid.defaults("kettle.tests.badRequest.testDefTemplate", {
    gradeNames: "fluid.component",
    mergePolicy: {
        sequence: "noexpand"
    },
    expectedStatusCode: 500,
    distributeOptions: {
        target: "{that server}.options.listeners.onCreate",
        record: {
            namespace: "upgradeError",
            listener: "kettle.tests.badRequest.upgradeError"
        }
    },
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
        { // Beat jqUnit's failure handler so we can test Kettle's
            funcName: "kettle.test.pushInstrumentedErrors",
            args: "fluid.identity"
        }, {
            func: "{testRequest}.send"
        }, {
            event: "{testRequest}.events.onComplete",
            listener: "kettle.test.assertErrorResponse",
            args: {
                message: "{testCaseHolder}.options.message",
                errorTexts: "{testCaseHolder}.options.errorTexts",
                statusCode: "{testCaseHolder}.options.expectedStatusCode",
                string: "{arguments}.0",
                request: "{testRequest}"
            }
        }, {
            funcName: "kettle.test.popInstrumentedErrors"
        }
    ]
});

/** Definitions for specific bad request tests **/

/* Missing handler test */

fluid.defaults("kettle.tests.badRequest.missing.handler.config", {
    handler: {
        type: "kettle.tests.badRequest.missing.handler"
    },
    name: "Bad config: missing handler test",
    message: "Received 500 error with helpful text for missing request handler",
    errorTexts: "couldn't load handler kettle.tests.badRequest.missing.handler"
});

/* Handler with missing type test */

fluid.defaults("kettle.tests.badRequest.missing.handlerType.config", {
    handler: {
        type: null
    },
    name: "Bad config: missing handler type test",
    message: "Received 500 error with helpful text for missing request handler type",
    errorTexts: ["must have a request grade name", "type"]
});

/* Throwing handler test */

fluid.defaults("kettle.tests.badRequest.throwing.handler.config", {
    handler: {
        type: "kettle.tests.badRequest.throwing.handler"
    },
    name: "Bad config: missing handler test",
    message: "Received 500 error with helpful text for throwing request handler",
    errorTexts: "Undesirable failure"
});

fluid.defaults("kettle.tests.badRequest.throwing.handler", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.badRequest.throwing.handleRequest"
        }
    }
});

kettle.tests.badRequest.throwing.handleRequest = function () {
    throw new Error("Undesirable failure");
};

/* Missing middleware test */

fluid.defaults("kettle.tests.badRequest.middleware.missing.config", {
    handler: {
        type: "kettle.tests.badRequest.middleware.missing.handler"
    },
    name: "Bad config: missing middleware test",
    message: "Received 500 error with helpful text for missing middleware",
    errorTexts: ["Couldn't resolve reference", "missingMiddleware"]
});

fluid.defaults("kettle.tests.badRequest.middleware.missing.handler", {
    gradeNames: "kettle.request.http",
    requestMiddleware: {
        missing: {
            middleware: "{middlewareHolder}.missingMiddleware"
        }
    },
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.HTTPMethods.get.handleRequest"
        }
    }
});

/* Bad middleware test */

fluid.defaults("kettle.tests.badRequest.middleware.bad.config", {
    handler: {
        type: "kettle.tests.badRequest.middleware.bad.handler"
    },
    name: "Bad config: bad middleware test",
    message: "Received 500 error with helpful text for bad middleware",
    errorTexts: ["is improperly configured", "kettle.tests.badRequest.bad.middleware"]
});

fluid.defaults("kettle.tests.badRequest.middleware.bad.handler", {
    gradeNames: "kettle.request.http",
    components: {
        badMiddleware: {
            type: "kettle.tests.badRequest.bad.middleware"
        }
    },
    requestMiddleware: {
        bad: {
            middleware: "{kettle.request.http}.badMiddleware"
        }
    },
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.HTTPMethods.get.handleRequest"
        }
    }
});

// should have a member "middleware" but doesn't
fluid.defaults("kettle.tests.badRequest.bad.middleware", {
    gradeNames: "kettle.plainMiddleware"
});

/* Bad static middleware test */

fluid.defaults("kettle.tests.badRequest.static.nopath.config", {
    handler: {
        type: "kettle.tests.badRequest.static.nopath.handler"
    },
    name: "Bad config: static middleware with no path test",
    message: "Received 500 error with helpful text for static middleware with no path",
    errorTexts: ["Static middleware must have a root path"]
});

// middleware should have a member "root" but doesn't
fluid.defaults("kettle.tests.badRequest.static.nopath.handler", {
    gradeNames: "kettle.request.http",
    components: {
        badStatic: {
            type: "kettle.middleware.static"
        }
    },
    requestMiddleware: {
        staticMiddleware: {
            middleware: "{kettle.request.http}.badStatic"
        }
    },
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.HTTPMethods.get.handleRequest"
        }
    }
});

/* Bad URL test */

fluid.defaults("kettle.tests.badRequest.badURL.config", {
    handler: {
        type: "kettle.tests.HTTPMethods.get.handler",
        route: "/route/:key"
    },
    name: "Bad request: bad URL-encoded request parameter",
    message: "Received 400 error with helpful text for badly URL-encoded request parameter",
    errorTexts: ["Failed to decode"],
    expectedStatusCode: 400,
    distributeOptions: {
        target: "{that testRequest}.options.path",
        record: "/route/%ZZ"
    }
});

kettle.tests.badRequest.testDefs = [
    "kettle.tests.badRequest.missing.handler.config",
    "kettle.tests.badRequest.missing.handlerType.config",
    "kettle.tests.badRequest.throwing.handler.config",
    "kettle.tests.badRequest.middleware.missing.config",
    "kettle.tests.badRequest.middleware.bad.config",
    "kettle.tests.badRequest.static.nopath.config",
    "kettle.tests.badRequest.badURL.config"
];

kettle.tests.singleRequest.executeTests(kettle.tests.badRequest.testDefs, "kettle.tests.badRequest.testDefTemplate", true);
