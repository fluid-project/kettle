/*!
Kettle DataSource PouchDB Tests

Copyright 2016 Raising the Floor - International

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
     kettle = require("../kettle.js"),
     fs = require("fs"),
     querystring = require("querystring"),
     http = require("http"),
     jqUnit = fluid.require("node-jqunit", require, "jqUnit");

require("./shared/DataSourceTestUtils.js");

require("./shared/gpii-pouchdb-harness.js");

fluid.defaults("kettle.tests.dataSource.pouchDB.environment", {
    gradeNames: ["gpii.pouch.tests.environment", "kettle.tests.simpleDataSourceTest"],
    initSequence: [ // duplicated material from gpii-express helpers-caseholder.js, needed everywhere we evade QUnit's bug
        {
            func: "{testEnvironment}.events.constructServer.fire"
        },
        {
            listener: "fluid.identity",
            event: "{testEnvironment}.events.onStarted"
        }
    ]
});



fluid.defaults("kettle.tests.dataSource.3.CouchDB.URL.standard", {
    gradeNames: ["kettle.tests.dataSource.pouchDB.environment"],
    name: "3. Testing CouchDB URL datasource with standard response",
    components: {
        dataSource: {
            type: "kettle.dataSource.URL",
            options: {
                url: "http://localhost:6789/testFile/test_id",
                gradeNames: "kettle.dataSource.CouchDB"
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.dataSource.testResponse",
            args: [{
                dataSource: "works"
            }, "{arguments}.0"]
        }
    }
});

fluid.defaults("kettle.tests.dataSource.5.CouchDB.URL.missing", {
    gradeNames: ["kettle.tests.dataSource.pouchDB.environment"],
    name: "5. Testing CouchDB URL datasource with missing file",
    shouldError: true,
    components: {
        dataSource: {
            type: "kettle.dataSource.URL",
            options: {
                url: "http://localhost:6789/testFile/test_id",
                notFoundIsEmpty: false, // equivalent to the default
                path: "%kettle/tests/data/nonexistent.txt"
            }
        }
    },
    invokers: {
        errorFunc: {
            funcName: "kettle.tests.dataSource.testErrorResponse",
            args: [{
                isError: true,
                statusCode: 404,
                message: "Document test_id in database testFile was not found"
            }, "{arguments}.0"]
        }
    }
});

fluid.test.runTests([
    "kettle.tests.dataSource.3.CouchDB.URL.standard",
    "kettle.tests.dataSource.5.CouchDB.URL.missing"
]);