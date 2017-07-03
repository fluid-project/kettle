/**
 * Kettle Resolver Tests
 *
 * Copyright 2017 Raising the Floor - International
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    kettle = fluid.require("%kettle"),
    jqUnit = fluid.require("node-jqunit", require, "jqUnit");

kettle.loadTestingSupport();

fluid.registerNamespace("kettle.tests");

kettle.tests.loadConfigTest = function (configName) {
    return kettle.config.loadConfig({
        configName: configName,
        configPath: "%kettle/tests/configs"
    });
};

jqUnit.test("Test present environment substitution", function () {
    process.env.KETTLE_ENV_TEST = "environment value";
    var that = kettle.tests.loadConfigTest("kettle.tests.resolver.envConfig");
    jqUnit.assertEquals("Environment value is resolved", "environment value",
        that.options.option6);
    delete process.env.KETTLE_ENV_TEST;
});

// Note that because of FLUID-6156, this tests missing values via an options
// distribution rather than via grade overriding
jqUnit.test("Test absent environment substitution", function () {
    var that = kettle.tests.loadConfigTest("kettle.tests.resolver.envConfig");
    jqUnit.assertEquals("Environment value is resolved", "OPTION6",
        that.options.option6);
});

jqUnit.test("Test absent environment substitution with default value", function () {
    var that = kettle.tests.loadConfigTest("kettle.tests.resolver.missingEnvConfigDefault");
    jqUnit.assertEquals("Environment value is resolved", "OPTION6",
        that.options.option6);
});

jqUnit.test("Test present file substitution", function () {
    var that = kettle.tests.loadConfigTest("kettle.tests.resolver.fileConfig");
    jqUnit.assertEquals("Environment value is resolved", "This is a secret secret",
        that.options.option6);
});

jqUnit.test("Test absent file substitution", function () {
    jqUnit.expect(1);
    try {
        kettle.tests.loadConfigTest("kettle.tests.resolver.missingFileConfig");
    } catch (e) {
        jqUnit.assertTrue("Missing file produces relevant exception",
            e.message.indexOf("nonexistent") !== -1);
    }
});

jqUnit.test("Test args substitution", function () {
    var oldarg1 = process.argv[1];
    process.argv[1] = "arg value";
    var that = kettle.tests.loadConfigTest("kettle.tests.resolver.argConfig");
    jqUnit.assertEquals("args value is resolved", "arg value",
        that.options.option6);
    process.argv[1] = oldarg1;
});
