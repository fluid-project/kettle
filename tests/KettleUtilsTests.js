/**
 * Kettle Utils Tests
 *
 * Copyright 2016 Raising the Floor - International
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    fs = require("fs"),
    kettle = require("../kettle.js"),
    jqUnit = fluid.require("node-jqunit", null, "jqUnit");
    
require("./shared/DataSourceTestUtils.js");

jqUnit.test("kettle JSON parsing error tests", function () {
    jqUnit.expectFrameworkDiagnostic("kettle.JSON.parse of non-string", function () {
        kettle.JSON.parse(3);
    }, "non-string");

    jqUnit.expect(1);
    var nonJSON = fs.readFileSync(__dirname + "/data/invalidJSONFile.jsonx", "utf8");
    try {
        kettle.JSON.parse(nonJSON);
    } catch (error) {
        jqUnit.assertTrue("Got message mentioning line number of error ", error.message.indexOf("59") !== -1);
    }
});

jqUnit.test("kettle.JSON.readFileSync of invalid JSON", function () {
    jqUnit.expect(2);
    kettle.JSON.readFileSync(__dirname + "/data/invalidJSONFile.jsonx").then(function () {
        jqUnit.fail("Invalid file produced no error");
    }, function (err) {
        kettle.tests.expectJSONDiagnostic(err);
    });
});

jqUnit.test("kettle.JSON.readFileSync of nonexistent file", function () {
    jqUnit.expect(1);
    kettle.JSON.readFileSync(__dirname + "/data/nonexistentFile.json").then(function () {
        jqUnit.fail("Invalid file produced no error");
    }, function (err) {
        jqUnit.assertTrue("Error listing filename", err.message.indexOf("nonexistentFile.json") >= 0);
    });
});