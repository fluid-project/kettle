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

/*global require, __dirname*/

var fluid = require("infusion"),
    path = require("path"),
    kettle = fluid.require(path.resolve(__dirname, "../kettle.js")),
    jqUnit = fluid.require("jqUnit"),
    configPath = path.resolve(__dirname, "./configs");

fluid.require(path.resolve(__dirname, "./utils/js/KettleTestUtils.js"));

/** Beat jqUnit's failure handler so we can test Kettle's rather than jqUnit's **/

fluid.pushSoftFailure(kettle.utils.failureHandler);

fluid.defaults("kettle.requests.request.handler.requestError", {
    gradeNames: ["fluid.littleComponent", "autoInit"],
    invokers: {
        handle: {
            funcName: "fluid.fail",
            args: "Assertion failed in request"
        }
    }
});

kettle.tests.triggerGlobalErrorSync = function () {
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
    var stack = new Error().stack;
    jqUnit.assert(message);
};

fluid.defaults("kettle.tests.logNotifierHolder", {
    gradeNames: ["fluid.eventedComponent", "autoInit"],
    events: {
        logNotifier: null
    }
});

fluid.staticEnvironment.logNotifierHolder = kettle.tests.logNotifierHolder();

kettle.tests.instrumentLogging = function () {
   kettle.tests.originalFluidLog = fluid.log;
   var notifying = false;
   fluid.log = function (logLevel) {
       var togo = kettle.tests.originalFluidLog.apply(null, arguments); 
       if (!notifying && logLevel.priority <= fluid.logLevel.FAIL.priority) {
           notifying = true;          
           fluid.staticEnvironment.logNotifierHolder.events.logNotifier.fire(fluid.makeArray(arguments));
           notifying = false;
       }
       return togo;
   };
};

kettle.tests.unInstrumentLogging = function () {
    fluid.log = kettle.tests.originalFluidLog;
};

var testDefs = [{
    name: "Error tests",
    expect: 2,
    config: {
        nodeEnv: "error",
        configPath: configPath
    },
    components: {
        eventHolder: {
            type: "fluid.eventedComponent",
            options: {
                events: {
                    logNotifier: "{logNotifierHolder}.events.logNotifier"
                }
            }
        },
        httpRequest: {
            type: "kettle.tests.request.http"
        }
    },
    sequence: [{
        func: "kettle.tests.instrumentLogging"
    }, {
        func: "kettle.tests.triggerGlobalErrorAsync",
        args: "{testCaseHolder}"
    }, {
        event: "{eventHolder}.events.logNotifier",
        listener: "kettle.tests.awaitGlobalError",
    }, {
        func: "{httpRequest}.send"
    }, {
        event: "{eventHolder}.events.logNotifier",
        listener: "kettle.tests.awaitGlobalError",
    }, {
        func: "kettle.tests.unInstrumentLogging"
    }]
}];

module.exports = kettle.tests.bootstrap(testDefs);