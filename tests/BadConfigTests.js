/**
 * Kettle Bad Config Tests
 *
 * Copyright 2015 Raising The Floor - International
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/GPII/kettle/LICENSE.txt
 */
 
"use strict";

var fluid = require("infusion"),
    jqUnit = fluid.registerNamespace("jqUnit"),
    kettle = require("../kettle.js");

kettle.loadTestingSupport();

fluid.registerNamespace("kettle.tests.badConfig");


// Test the facility to register our own "upgrade error handler" - beat the one within KettleTestUtils
// jshint ignore:start
// ignore for unused arguments which must be supplied since app.use ridiculously checks the callee signature
kettle.tests.badConfig.upgradeError = function (server) {
    server.expressApp.use(function (err, req, res, next) {
        kettle.request.http.errorHandler(res, err);
    });
};
// jshint ignore:end

kettle.tests.badConfig.testDefs = [{
    name: "Bad config test",
    expect: 3,
    config: {
        configName: "kettle.tests.badConfig.config",
        configPath: "%kettle/tests/configs"
    },
    distributeOptions: {
        target: "{that server}.options.listeners.onCreate",
        record: {
            namespace: "upgradeErrors",
            listener: "kettle.tests.badConfig.upgradeError"
        }
    },
    components: {
        getRequest: {
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
            func: "{getRequest}.send"
        }, {
            event: "{getRequest}.events.onComplete",
            listener: "kettle.test.assertErrorResponse",
            args: {
                message: "Received 500 error with helpful text for missing request handler",
                errorTexts: "couldn't load handler kettle.tests.badConfig.missing.handler",
                statusCode: 500,
                string: "{arguments}.0",
                request: "{getRequest}"
            }
        }, {
            funcName: "kettle.test.popInstrumentedErrors"
        }
    ]
}];

jqUnit.test("Config with bad top-level keys", function () {
    jqUnit.expectFrameworkDiagnostic("Got framework diagnostic on loading config with faulty top-level keys", function () {
        kettle.config.createDefaults({
            configPath: "%kettle/tests/configs",
            configName: "kettle.tests.badConfig.keys.config"
        });
    }, "distributeOptions");
});

kettle.test.bootstrapServer(kettle.tests.badConfig.testDefs);