/*
Kettle Data Source JSON tests

Copyright 2012-2015 Raising the Floor - International

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/GPII/kettle/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
     kettle = require("../kettle.js"),
     jqUnit = fluid.require("node-jqunit", require, "jqUnit");

require("./shared/DataSourceTestUtils.js");

// JSON parsing and diagnostics tests

fluid.defaults("kettle.tests.dataSourceJSONTester", {
    gradeNames: ["fluid.test.testEnvironment", "kettle.tests.fileRootedDataSource", "autoInit"],
    vars: {
        root: __dirname
    },
    events: {
        onError: null
    },
    components: {
        faultyJSONDataSource: {
            type: "kettle.dataSource.URL",
            options: {
                url: "file://%root/data/invalidJSONFile.jsonx"
            }
        },
        testCaseHolder: {
            type: "fluid.test.testCaseHolder",
            options: {
                modules: [{
                    name: "Kettle JSON parsing Tests",
                    tests: [{
                        expect: 2,
                        name: "JSON line number diagnostic test",
                        sequence: [{
                            funcName: "kettle.tests.fallibleDataSourceRead",
                            args: ["{faultyJSONDataSource}"]
                        }, {
                            event: "{testEnvironment}.events.onError",
                            listener: "kettle.tests.expectJSONDiagnostic"
                        }
                        ]
                    }]
                }]
            }
        }
    }
});


kettle.tests.fallibleDataSourceRead = function (dataSource) {
    dataSource.get(); // we expect failure - forwarded to root handler
};

kettle.tests.expectJSONDiagnostic = function (error) {
    console.log("Received JSON diagnostic error " + JSON.stringify(error, null, 2));
    jqUnit.assertTrue("Got message mentioning filename ", error.message.indexOf("invalidJSONFile") !== -1);
    jqUnit.assertTrue("Got message mentioning line number of error ", error.message.indexOf("59") !== -1);
};

fluid.test.runTests(["kettle.tests.dataSourceJSONTester"]);
