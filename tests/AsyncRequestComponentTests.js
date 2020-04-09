/**
 * Kettle Asynchronous Request tests
 *
 * Copyright 2019 Raising The Floor - International
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

if (!fluid.registerPotentia) { // These tests are only meaningful under post FLUID-6148 versions of Infusion
    return;
}

kettle.loadTestingSupport();

require("./shared/SingleRequestTestDefs.js");

fluid.registerNamespace("kettle.tests.asyncRequest");

fluid.defaults("kettle.tests.asyncRequest.testDefTemplate", {
    gradeNames: "fluid.component",
    mergePolicy: {
        sequence: "noexpand"
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
        {
            func: "{testRequest}.send"
        }, {
            event: "{testRequest}.events.onComplete",
            listener: "kettle.test.assertJSONResponse",
            args: {
                message: "{testCaseHolder}.options.message",
                statusCode: "{testCaseHolder}.options.expectedStatusCode",
                string: "{arguments}.0",
                request: "{testRequest}",
                expected: {
                    dataSource: "works"
                }
            }
        }
    ]
});

fluid.defaults("kettle.tests.asyncRequest.handler.config", {
    handler: {
        type: "kettle.tests.asyncRequest.handler"
    },
    name: "Asynchronous request startup: basic fetch test",
    message: "Received correctly relayed JSON response fetched during request startup via async I/O"
});

fluid.defaults("kettle.tests.asyncRequest.handler", {
    gradeNames: ["kettle.request.http", "fluid.modelComponent", "fluid.resourceLoader"],
    resources: {
        data: {
            path: "%kettle/tests/data/dataSourceTestFile.json",
            dataType: "json"
        }
    },
    model: "{that}.resources.data.parsed",
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.asyncRequest.handleRequest"
        }
    }
});

kettle.tests.asyncRequest.handleRequest = function (request) {
    request.events.onSuccess.fire(request.model);
};


kettle.tests.asyncRequest.testDefs = [
    "kettle.tests.asyncRequest.handler.config"
];

kettle.tests.singleRequest.executeTests(kettle.tests.asyncRequest.testDefs,
    "kettle.tests.asyncRequest.testDefTemplate", false);
