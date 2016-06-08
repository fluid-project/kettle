/**
 * Kettle Initialisation Tests
 *
 * Copyright 2013 OCAD University
 * Copyright 2012-2015 Raising the Floor - International
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    kettle = require("../kettle.js"),
    jqUnit = fluid.require("node-jqunit", null, "jqUnit");


fluid.defaults("kettle.tests.init.server", {
    gradeNames: ["kettle.server"],
    members: {
        fireRecord: []
    },
    listeners: {
        onListen: {
            priority: "last",
            funcName: "kettle.tests.init.assertAndCleanup",
            args: "{that}"
        },
        onContributeMiddleware: {
            funcName: "kettle.tests.init.record",
            args: ["{that}", "onContributeMiddleware"]
        },
        onContributeRouteHandlers: {
            funcName: "kettle.tests.init.record",
            args: ["{that}", "onContributeRouteHandlers"]
        },
        onCreate: {
            priority: "first",
            funcName: "kettle.tests.init.record",
            args: ["{that}", "onCreate"]
        }
    }
});

kettle.tests.init.record = function (that, name) {
    that.fireRecord.push(name);
};

kettle.tests.init.assertAndCleanup = function (that) {
    jqUnit.assertDeepEq("Expected init event sequence", ["onCreate", "onContributeMiddleware", "onContributeRouteHandlers"], that.fireRecord);
    that.stop();
    jqUnit.start();
};

jqUnit.asyncTest("Kettle server initialisation test", function () {
    jqUnit.expect(1);

    kettle.tests.init.server({});
});

require("./shared/HTTPMethodsTestDefs.js");

kettle.tests.init.envTest = function (options) {
    jqUnit.asyncTest(options.message, function () {
        jqUnit.expect(2);
        var oldArgv = process.argv;
        var oldEnv = process.env.NODE_ENV;
        process.argv = options.argv;
        process.env.NODE_ENV = options.nodeEnv;
        var server = kettle.config.initCLI();
        var request = kettle.test.request.http({
            listeners: {
                onComplete: function (data) {
                    kettle.tests.HTTPMethods.get.testResponse(data);
                    server.destroy();
                    jqUnit.start();
                    process.argv = oldArgv;
                    process.env.NODE_ENV = oldEnv;
                }
            }
        });
        request.send();
    });
};

kettle.tests.init.badEnvTest = function (options) {
    jqUnit.test(options.message, function () {
        jqUnit.expectFrameworkDiagnostic(options.message, function () {
            var oldArgv = process.argv;
            var oldEnv = process.env.NODE_ENV;
            process.argv = options.argv;
            if (options.nodeEnv) {
                process.env.NODE_ENV = options.nodeEnv;
            } else { // assigning `undefined` will call toString on it!
                delete process.env.NODE_ENV;
            }
            try {
                kettle.config.initCLI();
            } catch (e) {
                process.argv = oldArgv;
                process.env.NODE_ENV = oldEnv;
                throw e;
            }
        }, options.errorTexts);
    });
};

kettle.tests.init.envTest({
    message: "Kettle server initialisation test via init.js and args",
    argv: ["node.exe", "init.js", fluid.module.resolvePath("%kettle/tests/configs"), "kettle.tests.HTTPMethods.config"]
});

kettle.tests.init.envTest({
    message: "Kettle server initialisation test via init.js and NODE_ENV",
    argv: ["node.exe", "init.js", "%kettle/tests/configs"],
    nodeEnv: "kettle.tests.HTTPMethods.config"
});

kettle.tests.init.badEnvTest({
    message: "Kettle server initialisation test via init.js without config name",
    argv: ["node.exe", "init.js", "%kettle/tests/configs"],
    errorTexts: "No configuration"
});

kettle.tests.init.badEnvTest({
    message: "Kettle server initialisation test via init.js without config path",
    argv: ["node.exe", "init.js", "-"],
    errorTexts: "Config path"
});
