/**
 * Kettle MultiConfig Tests
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
    kettle = require("../kettle.js");
    
kettle.loadTestingSupport();

fluid.defaults("kettle.tests.multiConfig.source.get.handler", {
    gradeNames: "kettle.request.http",
    components: {
        targetSource: {
            type: "kettle.dataSource.URL",
            options: {
                url: "http://localhost:8088/"
            }
        }
    },
    invokers: {
        handleRequest: "kettle.tests.multiConfig.source.get.handleRequest"
    }
});

kettle.tests.multiConfig.source.get.handleRequest = function (request) {
    var result = request.targetSource.get();
    fluid.promise.follow(result, request.handlerPromise);
};


fluid.defaults("kettle.tests.multiConfig.target.get.handler", {
    gradeNames: "kettle.request.http",
    invokers: {
        handleRequest: "kettle.tests.multiConfig.target.get.handleRequest"
    }
});

kettle.tests.multiConfig.target.get.handleRequest = function (request) {
    request.handlerPromise.resolve({
        message: "Result from target config"
    });
};

kettle.tests.multiConfig.testDefs = [{
    name: "Simple MultiConfig Test",
    expect: 2,
    config: {
        configName: "kettle.tests.multiConfig.head.config",
        configPath: "%kettle/tests/configs"
    },
    components: {
        getRequest: {
            type: "kettle.test.request.http"
        }
    },
    sequence: [{
        func: "{getRequest}.send"
    }, {
        event: "{getRequest}.events.onComplete",
        listener: "kettle.test.assertJSONResponse",
        args: {
            message: "Received relayed response from multiConfig server",
            string: "{arguments}.0",
            request: "{getRequest}",
            expected: {
                message: "Result from target config"
            }
        }
    }]
}];


kettle.test.bootstrapServer(kettle.tests.multiConfig.testDefs);