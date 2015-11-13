/*!
Kettle Data Source Tests

Copyright 2012-2015 Raising the Floor - International

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
     
require ("./shared/DataSourceTestUtils.js");

fluid.defaults("kettle.tests.KETTLE34dataSource", {
    gradeNames: "kettle.dataSource.URL",
    url: "https://user:password@thing.available:997/path",
    headers: {
        "x-custom-header": "x-custom-value"
    }
});

fluid.defaults("kettle.tests.KETTLE34dataSource2", {
    gradeNames: "kettle.dataSource.URL",
    url: "http://localhost/device",
    port: 998
});
    

kettle.tests.dataSource.resolutionTests = [ {
    gradeName: "kettle.tests.KETTLE34dataSource",
    expectedOptions: {
        protocol: "https:",
        port: 999,
        auth: "user:password",
        path: "/path",
        method: "GET",
        host: "thing.available:997", // appears to be a parsing fault in url module
        family: 4,
        headers: {
            "x-custom-header": "x-custom-value",
            "x-custom-header2": "x-custom-value2"
        }
    },
    creatorArgs: {
        port: 998,
        family: 4
    },
    directOptions: {
        headers: {
            "x-custom-header2": "x-custom-value2"
        },
        port: 999
    }
}, {
    gradeName: "kettle.tests.KETTLE34dataSource2",
    expectedOptions: {
        protocol: "http:",
        port: 998,
        path: "/device",
        host: "localhost"
    }
}
];

kettle.tests.dataSource.resolutionTest = function (fixture) {
    jqUnit.test("KETTLE-34 request option resolution test", function () {
        var httpRequest = http.request,
            capturedOptions;
        http.request = function (requestOptions) {
            capturedOptions = requestOptions;
            return {
                on: fluid.identity,
                end: fluid.identity
            };
        };
        try {
            var dataSource = fluid.invokeGlobalFunction(fixture.gradeName, [fixture.creatorArgs]);
            dataSource.get(null, fixture.directOptions);
            jqUnit.assertLeftHand("Resolved expected requestOptions", fixture.expectedOptions, capturedOptions);
        } finally {
            http.request = httpRequest;
        }
    });
};

fluid.each(kettle.tests.dataSource.resolutionTests, function (fixture) {
    kettle.tests.dataSource.resolutionTest(fixture);
});




fluid.defaults("kettle.tests.KETTLE38base", {
    gradeNames: "kettle.dataSource.URL",
    writable: true
});

fluid.defaults("kettle.tests.KETTLE38derived", {
    gradeNames: "kettle.tests.KETTLE38base"
});

jqUnit.test("KETTLE-38 derived writable dataSource test", function () {
    var dataSource = kettle.tests.KETTLE38derived();
    jqUnit.assertValue("Resolved writable grade via base grade", dataSource.set);
});


kettle.tests.formencData = {
    "text1": "text default",
    "text2": "aωb"
};

fluid.defaults("kettle.tests.formencSource", {
    gradeNames: "kettle.dataSource.file.moduleTerms",
    path: "%kettle/tests/data/formenc.txt",
    components: {
        encoding: {
            type: "kettle.dataSource.encoding.formenc"
        }
    }
});

jqUnit.asyncTest("Reading file in formenc encoding", function () {
    var that = kettle.tests.formencSource();
    jqUnit.expect(1);
    that.get().then(function (result) {
        jqUnit.assertDeepEq("Received decoded result", kettle.tests.formencData, result);
        jqUnit.start();
    }, function (err) {
        jqUnit.fail("Got error " + JSON.stringify(err));
    });
});

fluid.defaults("kettle.tests.formencSourceWrite", {
    gradeNames: "kettle.dataSource.file.moduleTerms",
    path: "%kettle/tests/data/writeable/formenc.txt",
    writable: true,
    components: {
        encoding: {
            type: "kettle.dataSource.encoding.formenc"
        }
    }
});

jqUnit.asyncTest("Writing file in formenc encoding", function () {
    var that = kettle.tests.formencSourceWrite();
    jqUnit.expect(1);
    that.set(null, kettle.tests.formencData).then(function () {
        var written = fs.readFileSync("./data/writeable/formenc.txt", "utf8");
        var decoded = querystring.parse(written);
        jqUnit.assertDeepEq("Written decoded result", kettle.tests.formencData, decoded);
        jqUnit.start();
    }, function (err) {
        jqUnit.fail("Got error " + JSON.stringify(err));
    });
});


// Basic initialisation tests

kettle.tests.dataSource.testInit = function (dataSource) {
    jqUnit.assertValue("Data source is initialized", dataSource);
    jqUnit.assertValue("Data source should have a get method", dataSource.get);
    jqUnit.assertUndefined("Data source should not have a set method by default", dataSource.set);
    jqUnit.assertDeepEq("Data source should have a termMap", {}, dataSource.options.termMap);
};


fluid.defaults("kettle.tests.dataSource.initTester", {
    gradeNames: ["fluid.test.testEnvironment"],
    components: {
        urlDataSource: {
            type: "kettle.dataSource.URL"
        },
        couchDBDataSource: {
            type: "kettle.dataSource.URL",
            options: {
                gradeNames: "kettle.dataSource.CouchDB"
            }
        },
        testCases: {
            type: "kettle.tests.dataSource.initCases"
        }
    }
});


fluid.defaults("kettle.tests.dataSource.initCases", {
    gradeNames: ["fluid.test.testCaseHolder"],
    modules: [{
        name: "Kettle Data Source Init Tester",
        tests: [{
            expect: 4,
            name: "URL Data source initialization",
            func: "kettle.tests.dataSource.testInit",
            args: ["{urlDataSource}"]
        }, {
            expect: 4,
            name: "CouchDB Data source initialization",
            func: "kettle.tests.dataSource.testInit",
            args: ["{couchDBDataSource}"]
        }]
    }]
});

// Attached URL resolver tests

kettle.tests.testUrlResolver = function (dataSource, directModel) {
    var resolved = dataSource.resolveUrl(dataSource.options.url, dataSource.options.termMap, directModel);
    jqUnit.assertEquals("Data source should should expand urls based on termMap with URIEncoding",
        "http://test%20with%20space/test.json", resolved);
};

fluid.defaults("kettle.tests.dataSource.resolverTester", {
    gradeNames: ["fluid.test.testEnvironment"],
    components: {
        urlDataSourceDynamic: {
            type: "kettle.dataSource.URL",
            options: {
                url: "http://%expand/test.json",
                termMap: {
                    expand: "%expand"
                }
            }
        },
        testCases: {
            type: "kettle.tests.urlResolverTester"
        }
    }
});


fluid.defaults("kettle.tests.urlResolverTester", {
    gradeNames: ["fluid.test.testCaseHolder"],
    modules: [{
        name: "Kettle UrlResolver Tests",
        tests: [{
            expect: 1,
            name: "URL resolver with URI escaping",
            func: "kettle.tests.testUrlResolver",
            args: ["{urlDataSourceDynamic}", {
                expand: "test with space"
            }]
        }]
    }]
});

// General DataSource test grades


fluid.defaults("kettle.tests.dataSourceTestCaseHolder", {
    gradeNames: ["fluid.test.testCaseHolder"],
    moduleSource: {
        funcName: "kettle.tests.simpleDSModuleSource",
        args: "{testEnvironment}.options"
    }
});

kettle.tests.dataSource.defaultResponseFunc = function (shouldError, data) {
    fluid.fail(shouldError ? "Got response rather than error from dataSource: " :
        "Error in test configuration - should have overridden response function: ", data);
};

kettle.tests.dataSource.defaultErrorFunc = function (shouldError, data) {
    fluid.fail(shouldError ? "Error in test configuration - should have overridden error function: " :
        "Got error rather than response from dataSource: ", data);
};


// Base grade for each individual DataSource test fixture: Top-level component holding dataSource, test environment and standard events
fluid.defaults("kettle.tests.simpleDataSourceTest", {
    gradeNames: ["fluid.test.testEnvironment", "kettle.tests.dataSource.onErrorLink"],
    shouldError: false,
    events: {
        onResponse: null,
        onError: null
    },
    components: {
        testCaseHolder: {
            type: "kettle.tests.dataSourceTestCaseHolder"
        },
        dataSource: {
            type: "kettle.dataSource" // uninstantiable, must be overridden
        }
    },
    invokers: { // one of these should be overridden, depending on whether "shouldError" is set
        responseFunc: {
            funcName: "kettle.tests.dataSource.defaultResponseFunc",
            args: ["{that}.options.shouldError", "{arguments}.0"]
        },
        errorFunc: {
            funcName: "kettle.tests.dataSource.defaultErrorFunc",
            args: ["{that}.options.shouldError", "{arguments}.0"]
        }
    },
    listeners: {
        onResponse: "{that}.responseFunc",
        onError: "{that}.errorFunc"
    }
});

// Utility for binding returned promise value back to test environment's firers
kettle.tests.dataSource.invokePromiseProducer = function (producerFunc, args, testEnvironment) {
    var promise = producerFunc.apply(null, args);
    promise.then(function (response) {
        testEnvironment.events.onResponse.fire(response);
    });
};

fluid.defaults("kettle.tests.promiseDataSourceTest", {
    gradeNames: ["fluid.component"],
    testPromiseAPI: true,
    invokers: {
        invokePromiseProducer: {
            funcName: "kettle.tests.dataSource.invokePromiseProducer",
            args: ["{arguments}.0", "{arguments}.1", "{testEnvironment}"]
        }
    }
});

// Accepts options for the overall environment and produces a 2-element sequence
// operating the test. 
kettle.tests.simpleDSModuleSource = function (options) {
    var dataSourceMethod = options.dataSourceMethod || "get";
    var dataSourceArgs = [options.directModel];
    if (dataSourceMethod === "set") {
        dataSourceArgs.push(options.dataSourceModel);
    }
    if (options.testPromiseAPI) {
        var onErrorRecord = { // test this special feature of the DataSource API which allows bypass of the standard error handler per-request
            onError: "{testEnvironment}.events.onError.fire"
        };
        dataSourceArgs.push(onErrorRecord);
    } else {
        dataSourceArgs.push("{testEnvironment}.events.onResponse.fire");
    }
    
    var dataSourceFunc = "{dataSource}." + dataSourceMethod;
    var sequence = [];
    if (options.testPromiseAPI) {
        sequence.push({
            func: "{testEnvironment}.invokePromiseProducer",
            args: [dataSourceFunc, dataSourceArgs]
        });
    } else {
        sequence.push({
            func: dataSourceFunc,
            args: dataSourceArgs
        });
    }
    
    sequence.push({
        event: "{testEnvironment}.events." + (options.shouldError ? "onError" : "onResponse"),
        listener: "fluid.identity",
        priority: "last"
    });
    var modules = [{
        name: options.name + (options.testPromiseAPI ? " - via promise API" : ""),
        tests: [{
            expect: 1,
            name: "Simple " + dataSourceMethod + " test",
            sequence: sequence
        }]
    }];
    return modules;
};

kettle.tests.dataSource.testEmptyResponse = function (data) {
    jqUnit.assertEquals("Data response should be undefined", undefined, data);
};

kettle.tests.dataSource.testResponse = function (expected, data) {
    jqUnit.assertDeepEq("Data response should hold correct value", expected, data);
};

kettle.tests.dataSource.testErrorResponse = function (expected, data) {
    jqUnit.assertDeepEq("Error response should hold correct value", expected, data);
};

kettle.tests.dataSource.testSetResponse = function (dataSource, directModel, expected) {
    var fileName = kettle.dataSource.URL.resolveUrl(dataSource.options.path, dataSource.options.termMap, directModel, true),
        data = JSON.parse(fs.readFileSync(fileName, "utf8"));
    jqUnit.assertDeepEq("Response is correct", expected, data);
    fs.unlink(fileName);
};


fluid.defaults("kettle.tests.dataSource.1.file.empty", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "1. Testing file datasource with empty response",
    components: {
        dataSource: {
            type: "kettle.dataSource.file.moduleTerms",
            options: {
                path: "%kettle/tests/data/emptyDataSourceTestFile.txt"
            }
        }
    },
    invokers: {
        responseFunc: "kettle.tests.dataSource.testEmptyResponse"
    }
});

fluid.defaults("kettle.tests.dataSource.2.file.standard", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "2. Testing file datasource with standard response",
    components: {
        dataSource: {
            type: "kettle.dataSource.file.moduleTerms",
            options: {
                path: "%kettle/tests/data/dataSourceTestFile.json"
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

fluid.defaults("kettle.tests.dataSource.3.CouchDB.standard", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "3. Testing CouchDB datasource with standard response",
    components: {
        dataSource: {
            options: {
                gradeNames: ["kettle.dataSource.file.moduleTerms", "kettle.dataSource.CouchDB"],
                path: "%kettle/tests/data/couchDataSourceTestFile.json"
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

fluid.defaults("kettle.tests.dataSource.4.CouchDB.empty", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "4. Testing CouchDB datasource with empty response",
    components: {
        dataSource: {
            options: {
                gradeNames: ["kettle.dataSource.file.moduleTerms", "kettle.dataSource.CouchDB"],
                path: "%kettle/tests/data/emptyDataSourceTestFile.txt"
            }
        }
    },
    invokers: {
        responseFunc: "kettle.tests.dataSource.testEmptyResponse"
    }
});

fluid.defaults("kettle.tests.dataSource.5.CouchDB.error", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "5. Testing CouchDB datasource with error response",
    shouldError: true,
    components: {
        dataSource: {
            options: {
                gradeNames: ["kettle.dataSource.file.moduleTerms", "kettle.dataSource.CouchDB"],
                path: "%kettle/tests/data/couchDataSourceError.json"
            }
        }
    },
    invokers: {
        errorFunc: {
            funcName: "kettle.tests.dataSource.testErrorResponse",
            args: [{
                isError: true,
                message: fluid.module.resolvePath("not_found: missing while reading file %kettle/tests/data/couchDataSourceError.json")
            }, "{arguments}.0"]
        }
    }
});

fluid.defaults("kettle.tests.dataSource.6.file.expand.present", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "6. Testing filesystem datasource with expansion",
    directModel: {
        expand: "dataSourceTestFile"
    },
    components: {
        dataSource: {
            options: {
                gradeNames: "kettle.dataSource.file.moduleTerms",
                path: "%kettle/tests/data/%expand.json",
                termMap: {
                    expand: "%expand"
                }
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

fluid.defaults("kettle.tests.dataSource.7.file.expand.missing", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "7. Testing file datasource with filesystem with expansion",
    directModel: {
        expand: "nonexistent_file"
    },
    components: {
        dataSource: {
            options: {
                gradeNames: "kettle.dataSource.file.moduleTerms",
                path: "%kettle/tests/data/%expand.json",
                notFoundIsEmpty: true,
                termMap: {
                    expand: "%expand"
                }
            }
        }
    },
    invokers: {
        responseFunc: "kettle.tests.dataSource.testEmptyResponse"
    }
});

fluid.defaults("kettle.tests.dataSource.8.CouchDB.expand.missing", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "8. Testing file datasource with filesystem with expansion",
    directModel: {
        expand: "nonexistent_file"
    },
    components: {
        dataSource: {
            options: {
                gradeNames: ["kettle.dataSource.file.moduleTerms", "kettle.dataSource.CouchDB"],
                path: "%kettle/tests/data/%expand.json",
                notFoundIsEmpty: true,
                termMap: {
                    expand: "%expand"
                }
            }
        }
    },
    invokers: {
        responseFunc: "kettle.tests.dataSource.testEmptyResponse"
    }
});

fluid.defaults("kettle.tests.dataSource.9.file.expand.static", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "9. Testing file datasource with filesystem with static expansion",
    components: {
        dataSource: {
            options: {
                gradeNames: "kettle.dataSource.file.moduleTerms",
                path: "%kettle/tests/data/dataSourceTestFile.json"
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

fluid.defaults("kettle.tests.dataSource.10.CouchDB.expand.static", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "10. Testing couchdb datasource with filesystem with static expansion",
    components: {
        dataSource: {
            options: {
                gradeNames: ["kettle.dataSource.file.moduleTerms", "kettle.dataSource.CouchDB"],
                path: "%kettle/tests/data/couchDataSourceTestFile.json"
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

fluid.defaults("kettle.tests.dataSource.11.CouchDB.expand.dynamic", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "11. Testing couchdb datasource with filesystem and dynamic expansion",
    directModel: {
        expand: "couchDataSourceTestFile"
    },
    components: {
        dataSource: {
            options: {
                gradeNames: ["kettle.dataSource.file.moduleTerms", "kettle.dataSource.CouchDB"],
                path: "%kettle/tests/data/%expand.json",
                termMap: {
                    expand: "%expand"
                }
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

fluid.defaults("kettle.tests.dataSource.12.file.set", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "12. Testing file datasource with filesystem - set",
    dataSourceMethod: "set",
    dataSourceModel: {
        test: "test"
    },
    components: {
        dataSource: {
            options: {
                gradeNames: "kettle.dataSource.file.moduleTerms",
                path: "%kettle/tests/data/writeable/test.json",
                writable: true
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.dataSource.testSetResponse",
            args: ["{dataSource}", null, {
                test: "test"
            }]
        }
    }
});

fluid.defaults("kettle.tests.dataSource.13.CouchDB.set", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "13. Testing CouchDB datasource with filesystem - set",
    dataSourceMethod: "set",
    dataSourceModel: {
        test: "test"
    },
    components: {
        dataSource: {
            options: {
                gradeNames: ["kettle.dataSource.file.moduleTerms", "kettle.dataSource.CouchDB"],
                notFoundIsEmpty: true,
                path: "%kettle/tests/data/writeable/test.json",
                writable: true
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.dataSource.testSetResponse",
            args: ["{dataSource}", "{testEnvironment}.options.directModel", {
                value: {
                    test: "test"
                }
            }]
        }
    }
});

kettle.tests.dataSource.supplyWriteableCouchDBFile = function () {
    var source = __dirname + "/data/couchDataSourceTestFile.json";
    var target = __dirname + "/data/writeable/couchDataSourceTestFile.json";
    kettle.test.copyFileSync(source, target);
};

fluid.defaults("kettle.tests.dataSource.14.CouchDB.set.existing", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "14. Testing CouchDB datasource with filesystem existing document - set",
    dataSourceMethod: "set",
    dataSourceModel: {
        test: "test"
    },
    listeners: {
        onCreate: "kettle.tests.dataSource.supplyWriteableCouchDBFile"
    },
    components: {
        dataSource: {
            options: {
                gradeNames: ["kettle.dataSource.file.moduleTerms", "kettle.dataSource.CouchDB"],
                path: "%kettle/tests/data/writeable/couchDataSourceTestFile.json",
                writable: true
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.dataSource.testSetResponse",
            args: ["{dataSource}", "{testEnvironment}.options.directModel", {
                value: {
                    test: "test"
                },
                _rev: "test_rev", // With a real Couch/Pouch backend, these would increment
                _id: "test_id"
            }]
        }
    }
});

fluid.defaults("kettle.tests.dataSource.15.file.set.expand", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "15. Testing file datasource with filesystem and expansion - set",
    dataSourceMethod: "set",
    directModel: {
        expand: "test"
    },
    dataSourceModel: {
        test: "test"
    },
    components: {
        dataSource: {
            options: {
                gradeNames: "kettle.dataSource.file.moduleTerms",
                path: "%kettle/tests/data/writeable/%expand.json",
                termMap: {
                    expand: "%expand"
                },
                writable: true
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.dataSource.testSetResponse",
            args: ["{dataSource}", "{testEnvironment}.options.directModel", {
                test: "test"
            }]
        }
    }
});

fluid.defaults("kettle.tests.dataSource.16.CouchDB.set.existing.expand", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "16. Testing couchdb datasource with filesystem, existing document and expansion - set",
    dataSourceMethod: "set",
    directModel: {
        expand: "couchDataSourceTestFile"
    },
    dataSourceModel: {
        test: "test"
    },
    listeners: {
        onCreate: "kettle.tests.dataSource.supplyWriteableCouchDBFile"
    },
    components: {
        dataSource: {
            options: {
                gradeNames: ["kettle.dataSource.file.moduleTerms", "kettle.dataSource.CouchDB"],
                path: "%kettle/tests/data/writeable/%expand.json",
                termMap: {
                    expand: "%expand"
                },
                writable: true
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.dataSource.testSetResponse",
            args: ["{dataSource}", "{testEnvironment}.options.directModel", {
                value: {
                    test: "test"
                },
                _rev: "test_rev", // With a real Couch/Pouch backend, these would increment
                _id: "test_id"
            }]
        }
    }
});


kettle.tests.dataSource.standardTests = [
    "kettle.tests.dataSource.1.file.empty",
    "kettle.tests.dataSource.2.file.standard",
    "kettle.tests.dataSource.3.CouchDB.standard",
    "kettle.tests.dataSource.4.CouchDB.empty",
    "kettle.tests.dataSource.5.CouchDB.error",
    "kettle.tests.dataSource.6.file.expand.present",
    "kettle.tests.dataSource.7.file.expand.missing",
    "kettle.tests.dataSource.8.CouchDB.expand.missing",
    "kettle.tests.dataSource.9.file.expand.static",
    "kettle.tests.dataSource.10.CouchDB.expand.static",
    "kettle.tests.dataSource.11.CouchDB.expand.dynamic",
    "kettle.tests.dataSource.12.file.set",
    "kettle.tests.dataSource.13.CouchDB.set",
    "kettle.tests.dataSource.14.CouchDB.set.existing",
    "kettle.tests.dataSource.15.file.set.expand",
    "kettle.tests.dataSource.16.CouchDB.set.existing.expand"
];

// Convert each of the standard test fixture grades into tests of the equivalent promise-based API
kettle.tests.dataSource.promisifiedTests = fluid.transform(kettle.tests.dataSource.standardTests, function (element) {
    return {
        type: element,
        options: {
            gradeNames: "kettle.tests.promiseDataSourceTest"
        }
    };
});

var tests = kettle.tests.dataSource.standardTests.concat(kettle.tests.dataSource.promisifiedTests).concat([
    "kettle.tests.dataSource.initTester",
    "kettle.tests.dataSource.resolverTester"
]);

jqUnit.onAllTestsDone.addListener(kettle.tests.dataSource.ensureWriteableEmpty);

kettle.test.bootstrap(tests);
