/**
 * Kettle Bad Config Tests
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
    jqUnit = fluid.registerNamespace("jqUnit"),
    kettle = require("../kettle.js");

kettle.loadTestingSupport();

fluid.registerNamespace("kettle.tests.badConfig");

/** Configs which can be found to be bad at definition time **/

jqUnit.test("Config with bad top-level keys", function () {
    jqUnit.expectFrameworkDiagnostic("Got framework diagnostic on loading config with faulty top-level keys", function () {
        kettle.config.createDefaults({
            configPath: "%kettle/tests/configs",
            configName: "kettle.tests.badConfig.keys.config"
        });
    }, "distributeOptions");
});
