/**
 * Kettle Sample app - testing Kettle server
 * 
 * Copyright 2015 Raising the Floor - International
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/gpii/universal/LICENSE.txt
 */
 
"use strict";

var fluid = require("infusion"),
    kettle = require("../../kettle.js"),
    examples = fluid.registerNamespace("examples");

kettle.loadTestingSupport();
 
fluid.registerNamespace("examples.tests.simpleConfig");

examples.tests.simpleConfig.testDefs = [{
    name: "SimpleConfig GET test",
    expect: 2,
    config: {
        configName: "examples.simpleConfig",
        configPath: "%kettle/examples/simpleConfig"
    },
    components: {
        getRequest: {
            type: "kettle.test.request.http",
            options: {
                path: "/handlerPath",
                method: "GET"
            }
        }
    },
    sequence: [{
        func: "{getRequest}.send"
    }, {
        event: "{getRequest}.events.onComplete",
        listener: "kettle.test.assertJSONResponse",
        args: {
            message: "Received GET request from simpleConfig server",
            string: "{arguments}.0",
            request: "{getRequest}",
            expected: {
                message: "GET request received on path /handlerPath"
            }
        }
    }]
}];

kettle.test.bootstrapServer(examples.tests.simpleConfig.testDefs);