/*
Kettle Data Source JSON5 tests

Copyright 2012-2016 Raising the Floor - International

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
    kettle = require("../kettle.js");

require("./shared/DataSourceTestUtils.js");

// JSON5 parsing and diagnostics tests

fluid.defaults("kettle.tests.dataSourceJSON5Tester", {
    gradeNames: ["fluid.test.testEnvironment", "kettle.tests.dataSource.onErrorLink"],
    events: {
        onError: null
    },
    components: {
        faultyJSONDataSource: {
            type: "kettle.dataSource.file.moduleTerms",
            options: {
                path: "%kettle/tests/data/invalid/invalidJSON5File.json5",
                components: {
                    encoding: {
                        type: "kettle.dataSource.encoding.JSON5"
                    }
                }
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
                            listener: "kettle.tests.expectJSON5Diagnostic"
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

fluid.test.runTests(["kettle.tests.dataSourceJSON5Tester"]);
