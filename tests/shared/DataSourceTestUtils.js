/*
Kettle Data Source Test Utilities

Copyright 2017-2018 OCAD University
Copyright 2012-2015 Raising the Floor - International

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/main/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
    kettle = require("../../kettle.js"),
    jqUnit = fluid.require("node-jqunit", require, "jqUnit"),
    fs = require("fs");

kettle.loadTestingSupport();

fluid.registerNamespace("kettle.tests.dataSource");

// empties a directory, used by the dataSource and multer tests when testing
// file system writes / uploads
// directoryPath: a path statement to a directory, resolved by fluid.module.resolvePath

kettle.tests.dataSource.ensureDirectoryEmpty = function (directoryPath) {
    var directory = fluid.module.resolvePath(directoryPath);
    kettle.test.deleteFolderRecursive(directory);
    fs.mkdirSync(directory);
};

// distribute down a standard error handler for any nested dataSource

fluid.defaults("kettle.tests.dataSource.onErrorLink", {
    distributeOptions: {
        onError: {
            record: {
                namespace: "testEnvironment",
                func: "{testEnvironment}.events.onError.fire",
                args: "{arguments}.0"
            },
            target: "{that dataSource}.options.listeners.onError"
        }
    }
});


// General DataSource test grades

fluid.defaults("kettle.tests.dataSourceTestCaseHolder", {
    gradeNames: ["fluid.test.testCaseHolder"],
    moduleSource: {
        funcName: "kettle.tests.simpleDSModuleSource",
        args: "{testEnvironment}.options"
    }
});

kettle.tests.dataSource.defaultResponseFunc = function (shouldError, data) {
    fluid.fail(shouldError ? "Got response rather than error from dataSource: " :
        "Error in test configuration - should have overridden response function: ", data);
};

kettle.tests.dataSource.defaultErrorFunc = function (shouldError, data) {
    fluid.fail(shouldError ? "Error in test configuration - should have overridden error function: " :
        "Got error rather than response from dataSource: ", data);
};

// Base grade for each individual DataSource test fixture: Top-level component holding dataSource, test environment and standard events
fluid.defaults("kettle.tests.simpleDataSourceTest", {
    gradeNames: ["fluid.test.testEnvironment", "kettle.tests.dataSource.onErrorLink", "kettle.dataSource.distributeDevTerms"],
    mergePolicy: {
        initSequence: "noexpand"
    },
    shouldError: false,
    events: {
        onResponse: null,
        onError: null
    },
    components: {
        // cf. kettle.test.serverEnvironment which calls this "tests"
        testCaseHolder: {
            type: "kettle.tests.dataSourceTestCaseHolder"
        },
        dataSource: {
            type: "kettle.dataSource" // uninstantiable, must be overridden
        }
    },
    invokers: { // one of these should be overridden, depending on whether "shouldError" is set
        responseFunc: {
            funcName: "kettle.tests.dataSource.defaultResponseFunc",
            args: ["{that}.options.shouldError", "{arguments}.0"]
        },
        errorFunc: {
            funcName: "kettle.tests.dataSource.defaultErrorFunc",
            args: ["{that}.options.shouldError", "{arguments}.0"]
        }
    },
    listeners: {
        onResponse: "{that}.responseFunc",
        onError: "{that}.errorFunc"
    }
});

// Utility for binding returned promise value back to test environment's firers
kettle.tests.dataSource.invokePromiseProducer = function (producerFunc, args, testEnvironment) {
    var promise = producerFunc.apply(null, args);
    promise.then(function (response) {
        testEnvironment.events.onResponse.fire(response);
    });
};

fluid.defaults("kettle.tests.promiseDataSourceTest", {
    gradeNames: ["fluid.component"],
    testPromiseAPI: true,
    invokers: {
        invokePromiseProducer: {
            funcName: "kettle.tests.dataSource.invokePromiseProducer",
            args: ["{arguments}.0", "{arguments}.1", "{testEnvironment}"]
        }
    }
});

// Accepts options for the overall testEnvironment and produces a 2-element sequence
// operating the test. Configured as a func moduleSource in dataSourceTestCaseHolder and accepts {testEnvironment}.options
// TODO: This terrible mess should be resolved with FLUID-5903
kettle.tests.simpleDSModuleSource = function (options) {
    var dataSourceMethod = options.dataSourceMethod || "get";
    var dataSourceArgs = [options.directModel];
    if (dataSourceMethod === "set") {
        dataSourceArgs.push(options.dataSourceModel);
    }
    if (options.testPromiseAPI) {
        var onErrorRecord = { // test this special feature of the DataSource API which allows bypass of the standard error handler per-request
            onError: "{testEnvironment}.events.onError.fire"
        };
        dataSourceArgs.push(onErrorRecord);
    } else {
        dataSourceArgs.push("{testEnvironment}.events.onResponse.fire");
    }

    var dataSourceFunc = "{testEnvironment}.dataSource." + dataSourceMethod;
    var sequence = fluid.makeArray(options.initSequence);
    if (options.testPromiseAPI) {
        sequence.push({
            func: "{testEnvironment}.invokePromiseProducer",
            args: [dataSourceFunc, dataSourceArgs]
        });
    } else {
        sequence.push({
            func: dataSourceFunc,
            args: dataSourceArgs
        });
    }

    sequence.push({
        event: "{testEnvironment}.events." + (options.shouldError ? "onError" : "onResponse"),
        listener: "fluid.identity",
        priority: "last"
    });
    sequence.push.apply(sequence, fluid.makeArray(options.finalSequence));
    var modules = [{
        name: options.name + (options.testPromiseAPI ? " - via promise API" : ""),
        tests: [{
            expect: 1 + (options.expect || 0),
            name: "Simple " + dataSourceMethod + " test",
            sequence: sequence
        }]
    }];
    return modules;
};


kettle.tests.dataSource.testEmptyResponse = function (data) {
    jqUnit.assertEquals("Data response should be undefined", undefined, data);
};

kettle.tests.dataSource.testResponse = function (expected, data) {
    jqUnit.assertDeepEq("Data response should hold correct value", expected, data);
};

kettle.tests.dataSource.testErrorResponse = function (expected, data) {
    var cloned = kettle.cloneError(data);
    jqUnit.assertDeepEq("Error response should hold correct value", expected, cloned);
};

kettle.tests.expectJSONDiagnostic = function (error) {
    fluid.log("Received JSON diagnostic error " + JSON.stringify(error, null, 2));
    jqUnit.assertTrue("Got message mentioning filename ", error.message.indexOf("invalidJSONFile") !== -1);
    jqUnit.assertTrue("Got message mentioning line number of error ", error.message.indexOf("59") !== -1);
};

kettle.tests.expectJSON5Diagnostic = function (error) {
    fluid.log("Received JSON5 diagnostic error " + JSON.stringify(error, null, 2));
    jqUnit.assertTrue("Got message mentioning filename ", error.message.indexOf("invalidJSON5File") !== -1);
    jqUnit.assertTrue("Got message mentioning line number of error ", error.message.indexOf("49") !== -1);
};
