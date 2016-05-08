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

fluid.defaults("kettle.tests.dataSource.pouchDB.write.environment", {
    gradeNames: "kettle.tests.dataSource.pouchDB.environment",
    events: {
        onVerify: null
    },
    finalSequence: {
        listener: "fluid.identity",
        event: "{testEnvironment}.events.onVerify"
    }
});

kettle.tests.dataSource.testURLSetResponse = function (that, dataSource, directModel, dataSourceModel) {
    var reread = dataSource.get(directModel);
    reread.then(function (response) {
        jqUnit.assertDeepEq("Reread expected response from dataSource", dataSourceModel, response);
        that.events.onVerify.fire();
    }, function (error) {
        jqUnit.fail("Failed to reread dataSource response: " + error);
        that.events.onVerify.fire();
    });
};

/** These fixture are analogues of some of those in DataSourceMatrixTests.js, and their index numbers are taken from those **/

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
    gradeNames: "kettle.tests.dataSource.pouchDB.environment",
    name: "5. Testing CouchDB URL datasource with missing file",
    shouldError: true,
    port: 6789,
    components: {
        dataSource: {
            type: "kettle.dataSource.URL",
            options: {
                gradeNames: "kettle.dataSource.CouchDB",
                url: "http://localhost:6789/testFile/nonexistent_id",
                notFoundIsEmpty: false // equivalent to the default
            }
        }
    },
    invokers: {
        errorFunc: {
            funcName: "kettle.tests.dataSource.testErrorResponse",
            args: [{
                isError: true,
                statusCode: 404,
                reason: "missing",
                message: "not_found while executing HTTP GET on url http://localhost:6789/testFile/nonexistent_id"
            }, "{arguments}.0"]
        }
    }
});

fluid.defaults("kettle.tests.dataSource.5a.CouchDB.URL.missing", {
    gradeNames: "kettle.tests.dataSource.pouchDB.environment",
    name: "5a. Testing CouchDB URL datasource with missing file and notFoundIsEmpty",
    port: 6789,
    components: {
        dataSource: {
            type: "kettle.dataSource.URL",
            options: {
                gradeNames: "kettle.dataSource.CouchDB",
                url: "http://localhost:6789/testFile/nonexistent_id",
                notFoundIsEmpty: true
            }
        }
    },
    invokers: {
        responseFunc: "kettle.tests.dataSource.testEmptyResponse"
    }
});

fluid.defaults("kettle.tests.dataSource.14.CouchDB.URL.set", {
    gradeNames: "kettle.tests.dataSource.pouchDB.write.environment",
    name: "14. Testing CouchDB URL datasource with HTTP - set",
    dataSourceMethod: "set",
    dataSourceModel: {
        test: "test"
    },
    components: {
        dataSource: {
            type: "kettle.dataSource.URL",
            options: {
                gradeNames: "kettle.dataSource.CouchDB",
                url: "http://localhost:6789/testFile/nonexistent_id",
                writable: true
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.dataSource.testURLSetResponse",
            args: ["{testEnvironment}", "{testEnvironment}.dataSource", "{testEnvironment}.options.directModel", "{testEnvironment}.options.dataSourceModel"]
        }
    }
});

fluid.defaults("kettle.tests.dataSource.15.CouchDB.URL.set.existing", {
    gradeNames: "kettle.tests.dataSource.14.CouchDB.URL.set",
    name: "15. Testing CouchDB URL datasource with HTTP existing document - set",
    distributeOptions: {
        record: "http://localhost:6789/testFile/test_id",
        target: "{that > kettle.dataSource.URL}.options.url"
    }
});

fluid.test.runTests([
    "kettle.tests.dataSource.3.CouchDB.URL.standard",
    "kettle.tests.dataSource.5.CouchDB.URL.missing",
    "kettle.tests.dataSource.5a.CouchDB.URL.missing",
    "kettle.tests.dataSource.14.CouchDB.URL.set",
    "kettle.tests.dataSource.15.CouchDB.URL.set.existing"
]);