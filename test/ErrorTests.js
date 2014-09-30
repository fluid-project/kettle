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

fluid.registerNamespace("kettle.tests");

fluid.defaults("kettle.requests.request.handler.requestError", {
    gradeNames: ["fluid.littleComponent", "autoInit"],
    invokers: {
        handle: {
            funcName: "fluid.fail",
            args: "Assertion failed in request - this failure is expected: "
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
    jqUnit.assert(message);
};

fluid.defaults("kettle.tests.logNotifierHolder", {
    gradeNames: ["fluid.eventedComponent", "autoInit"],
    events: {
        logNotifier: null
    }
});

fluid.staticEnvironment.logNotifierHolder = kettle.tests.logNotifierHolder();

kettle.tests.notifyGlobalError = function () {
    fluid.staticEnvironment.logNotifierHolder.events.logNotifier.fire(fluid.makeArray(arguments));
};

// This is a clone of kettle.utils.failureHandler - since there seems to be some kind of exception handler on the
// path up to TCP.onread that is present in a typical kettle request. When we have FLUID-5518 implemented, this
// duplication can be elimiated
kettle.tests.failureHandlerLater = function (args, activity) {
    var messages = ["ASSERTION FAILED: "].concat(args).concat(activity);
    fluid.log.apply(null, [fluid.logLevel.FATAL].concat(messages));
    var request = kettle.getCurrentRequest();
    request.events.onError.fire({
        isError: true,
        message: args[0]
    });
    fluid.invokeLater(function () {
        fluid.builtinFail(false, args, activity);
    });
};

kettle.tests.pushInstrumentedErrors = function () {
    // Beat jqUnit's exception handler so that we can test kettle's instead
    fluid.pushSoftFailure(kettle.tests.failureHandlerLater);
    // Beat the existing global exception handler for the duration of these tests
    fluid.onUncaughtException.addListener(kettle.tests.notifyGlobalError, "fail", null,
        fluid.handlerPriorities.uncaughtException.fail);
};

kettle.tests.popInstrumentedErrors = function () {
    fluid.pushSoftFailure(-1);
    // restore whatever was the old listener in this namespace, as per FLUID-5506 implementation
    fluid.onUncaughtException.removeListener("fail");
};

// Tests two effects:
// i) Triggering a global error will definitely cause a logged message via the uncaught exception handler
// ii) Triggering an error during a request will also cause a logged message

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
            type: "kettle.test.request.http"
        }
    },
    sequence: [{ //Beat jqUnit's failure handler so we can test Kettle's rather than jqUnit's
        funcName: "kettle.tests.pushInstrumentedErrors"
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
    }, {
        funcName: "kettle.tests.popInstrumentedErrors"
    }]
}];

module.exports = kettle.test.bootstrapServer(testDefs);