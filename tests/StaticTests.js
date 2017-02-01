/**
 * Kettle HTTP Methods Tests
 *
 * Copyright 2014-2015 Raising The Floor - International
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    kettle = require("../kettle.js");

kettle.loadTestingSupport();

fluid.registerNamespace("kettle.tests.static");

fluid.defaults("kettle.tests.static.handler", {
    gradeNames: "kettle.request.http",
    requestMiddleware: {
        "static": {
            middleware: "{server}.infusionStatic"
        }
    },
    invokers: {
        handleRequest: {
            funcName: "kettle.request.notFoundHandler"
        }
    }
});

var infusionPackage = fluid.require("%infusion/package.json");

//------------- Test defs for GET, POST, PUT ---------------
kettle.tests["static"].testDefs = [{
    name: "HTTPMethods GET test",
    expect: 5,
    config: {
        configName: "kettle.tests.static.config",
        configPath: "%kettle/tests/configs"
    },
    components: {
        packageRequest: {
            type: "kettle.test.request.http",
            options: {
                path: "/infusion/package.json",
                method: "GET"
            }
        },
        packageRequest2: {
            type: "kettle.test.request.http",
            options: {
                path: "/infusion/package.json",
                method: "GET"
            }
        },
        missingRequest: {
            type: "kettle.test.request.http",
            options: {
                path: "/infusion/package.jsonx",
                method: "GET"
            }
        }
    },
    sequence: [{
        func: "{packageRequest}.send"
    }, { // Send 2nd request back-to-back to test KETTLE-57
        func: "{packageRequest2}.send"
    }, {
        event: "{packageRequest}.events.onComplete",
        listener: "kettle.test.assertJSONResponse",
        args: {
            message: "Resolved Infusion's package.json from static hosting",
            string: "{arguments}.0",
            request: "{packageRequest}",
            expected: infusionPackage
        }
    },
    // We don't listen for packageRequest2 onComplete since we can't predict its sequence relative to packageRequest and
    // the IoC Testing Framework doesn't make it easy to express "don't care non-determinism"
    {
        func: "{missingRequest}.send"
    }, {
        event: "{missingRequest}.events.onComplete",
        listener: "kettle.test.assertErrorResponse",
        args: {
            message: "Received 404 for nonexistent file within static hosting's URL space",
            statusCode: 404,
            string: "{arguments}.0",
            request: "{missingRequest}",
            errorTexts: "Cannot GET"
        }
    }]
}];

kettle.test.bootstrapServer(kettle.tests["static"].testDefs);
