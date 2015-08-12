/*!
Kettle Data Source Tests

Copyright 2012 Raising the Floor - International

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/GPII/kettle/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
     kettle = require("../kettle.js"),
     fs = require("fs"),
     jqUnit = fluid.require("jqUnit");
 
kettle.loadTestingSupport();

fluid.registerNamespace("kettle.tests.dataSource");

// reinitialise the "writeable" directory area used by tests which issue dataSource writes,
// the start of every test run
kettle.tests.dataSource.ensureWriteableEmpty = function () {
    var writeableDir = __dirname + "/data/writeable";
    kettle.test.deleteFolderRecursive(writeableDir);
    fs.mkdirSync(writeableDir);
};


// allow "%root" to be expanded to current directory name in all nested dataSources,
// as well as distributing down a standard error handler for any nested dataSource

fluid.defaults("kettle.tests.fileRootedDataSource", {
    gradeNames: ["fluid.component"],
    vars: {
        root: __dirname
    },
    distributeOptions: [{
        source: "{that}.options.vars",
        target: "{that urlExpander}.options.vars"
    },  {
        record: {
            namespace: "testEnvironment",
            func: "{testEnvironment}.events.onError.fire",
            args: "{arguments}.0"
        },
        target: "{that dataSource}.options.listeners.onError"
    }]
});

// Basic initialisation tests

kettle.tests.testInit = function (dataSource) {
    jqUnit.assertValue("Data source is initialized", dataSource);
    jqUnit.assertValue("Data source should have a get method", dataSource.get);
    jqUnit.assertUndefined("Data source should not have a set method by default", dataSource.set);
    jqUnit.assertDeepEq("Data source should have a termMap", {}, dataSource.options.termMap);
    jqUnit.assertValue("urlResolver is initialized", dataSource.urlResolver);
};


fluid.defaults("kettle.tests.dataSourceInitTester", {
    gradeNames: ["fluid.test.testEnvironment"],
    components: {
        urlDataSource: {
            type: "kettle.dataSource.URL"
        },
        couchDBDataSource: {
            type: "kettle.dataSource.CouchDB"
        },
        testCases: {
            type: "kettle.tests.dataSourceInitCases"
        }
    }
});


fluid.defaults("kettle.tests.dataSourceInitCases", {
    gradeNames: ["fluid.test.testCaseHolder"],
    modules: [{
        name: "Kettle Data Source Init Tester",
        tests: [{
            expect: 5,
            name: "URL Data source initialization",
            func: "kettle.tests.testInit",
            args: ["{urlDataSource}"]
        }, {
            expect: 5,
            name: "CouchDB Data source initialization",
            func: "kettle.tests.testInit",
            args: ["{couchDBDataSource}"]
        }]
    }]
});

// Attached URL resolver tests

kettle.tests.testUrlResolver = function (urlResolver, directModel) {
    jqUnit.assertEquals("Data source should should expand urls based on termMap with URIEncoding",
        "file://test%20with%20space/test.json", urlResolver.resolve(directModel));
};

fluid.defaults("kettle.tests.dataSourceInitTester", {
    gradeNames: ["fluid.test.testEnvironment"],
    components: {
        urlDataSource: {
            type: "kettle.dataSource.URL"
        },
        couchDBDataSource: {
            type: "kettle.dataSource.CouchDB"
        },
        testCases: {
            type: "kettle.tests.dataSourceInitCases"
        }
    }
});

fluid.defaults("kettle.tests.dataSourceResolverTester", {
    gradeNames: ["fluid.test.testEnvironment"],
    components: {
        urlDataSourceStatic: {
            type: "kettle.dataSource.URL",
            options: {
                url: "file://%expand/test.json",
                termMap: {
                    expand: "test with space"
                }
            }
        },
        urlDataSourceDynamic: {
            type: "kettle.dataSource.URL",
            options: {
                url: "file://%expand/test.json",
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
            name: "URL Data source initialization",
            func: "kettle.tests.testUrlResolver",
            args: "{urlDataSourceStatic}.urlResolver"
        }, {
            expect: 1,
            name: "CouchDB Data source initialization",
            func: "kettle.tests.testUrlResolver",
            args: ["{urlDataSourceDynamic}.urlResolver", {
                expand: "test with space"
            }]
        }]
    }]
});

kettle.tests.fallibleDataSourceRead = function (dataSource) {
    dataSource.get(); // we expect failure - forwarded to root handler
};

kettle.tests.expectJSONDiagnostic = function (error) {
    console.log("Received JSON diagnostic error " + JSON.stringify(error, null, 2));
    jqUnit.assertTrue("Got message mentioning filename ", error.message.indexOf("invalidJSONFile") !== -1);
    jqUnit.assertTrue("Got message mentioning line number of error ", error.message.indexOf("59") !== -1);
};

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
    gradeNames: ["fluid.test.testEnvironment", "kettle.tests.fileRootedDataSource"],
    shouldError: false,
    events: {
        onResponse: null,
        onError: null
    },
    components: {
        testCaseHolder: {
            type: "kettle.tests.dataSourceTestCaseHolder"
        }
    },
    dataSource: {
        type: "kettle.dataSource" // uninstantiable, must be overridden
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

kettle.tests.testEmptyResponse = function (data) {
    jqUnit.assertEquals("Data response should be undefined", undefined, data);
};

kettle.tests.testResponse = function (expected, data) {
    jqUnit.assertDeepEq("Data response should hold correct value", expected, data);
};

kettle.tests.testErrorResponse = function (expected, data) {
    jqUnit.assertDeepEq("Error response should hold correct value", expected, data);
};

kettle.tests.testSetResponse = function (dataSource, directModel, expected) {
    var fileName = dataSource.urlResolver.resolve(directModel).substring(7),
        data = JSON.parse(fs.readFileSync(fileName, "utf8"));
    jqUnit.assertDeepEq("Response is correct", expected, data);
    fs.unlink(fileName);
};


fluid.defaults("kettle.tests.dataSource.1.URL.empty", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "1. Testing url datasource with empty response",
    components: {
        dataSource: {
            type: "kettle.dataSource.URL",
            options: {
                url: "file://%root/data/emptyDataSourceTestFile.txt"
            }
        }
    },
    invokers: {
        responseFunc: "kettle.tests.testEmptyResponse"
    }
});

fluid.defaults("kettle.tests.dataSource.2.URL.standard", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "2. Testing url datasource with standard response",
    components: {
        dataSource: {
            type: "kettle.dataSource.URL",
            options: {
                url: "file://%root/data/dataSourceTestFile.json"
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.testResponse",
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
            type: "kettle.dataSource.CouchDB",
            options: {
                url: "file://%root/data/couchDataSourceTestFile.json"
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.testResponse",
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
            type: "kettle.dataSource.CouchDB",
            options: {
                url: "file://%root/data/emptyDataSourceTestFile.txt"
            }
        }
    },
    invokers: {
        responseFunc: "kettle.tests.testEmptyResponse"
    }
});

fluid.defaults("kettle.tests.dataSource.5.CouchDB.error", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "5. Testing CouchDB datasource with error response",
    shouldError: true,
    components: {
        dataSource: {
            type: "kettle.dataSource.CouchDB",
            options: {
                url: "file://%root/data/couchDataSourceError.json"
            }
        }
    },
    invokers: {
        errorFunc: {
            funcName: "kettle.tests.testErrorResponse",
            args: [{
                isError: true,
                message: "not_found: missing while reading file E:\\source\\gits\\kettle\\tests/data/couchDataSourceError.json"
            }, "{arguments}.0"]
        }
    }
});

fluid.defaults("kettle.tests.dataSource.6.URL.expand.present", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "6. Testing url datasource with filesystem with expansion",
    directModel: {
        expand: "dataSourceTestFile"
    },
    components: {
        dataSource: {
            type: "kettle.dataSource.URL",
            options: {
                url: "file://%root/data/%expand.json",
                termMap: {
                    expand: "%expand"
                }
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.testResponse",
            args: [{
                dataSource: "works"
            }, "{arguments}.0"]
        }
    }
});

fluid.defaults("kettle.tests.dataSource.7.URL.expand.missing", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "7. Testing url datasource with filesystem with expansion",
    directModel: {
        expand: "nonexistent_file"
    },
    components: {
        dataSource: {
            type: "kettle.dataSource.URL",
            options: {
                url: "file://%root/data/%expand.json",
                notFoundIsEmpty: true,
                termMap: {
                    expand: "%expand"
                }
            }
        }
    },
    invokers: {
        responseFunc: "kettle.tests.testEmptyResponse"
    }
});

fluid.defaults("kettle.tests.dataSource.8.CouchDB.expand.missing", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "8. Testing url datasource with filesystem with expansion",
    directModel: {
        expand: "nonexistent_file"
    },
    components: {
        dataSource: {
            type: "kettle.dataSource.CouchDB",
            options: {
                url: "file://%root/data/%expand.json",
                notFoundIsEmpty: true,
                termMap: {
                    expand: "%expand"
                }
            }
        }
    },
    invokers: {
        responseFunc: "kettle.tests.testEmptyResponse"
    }
});

fluid.defaults("kettle.tests.dataSource.9.URL.expand.static", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "9. Testing url datasource with filesystem with expansion and static termMap",
    components: {
        dataSource: {
            type: "kettle.dataSource.URL",
            options: {
                url: "file://%root/data/%expand.json",
                termMap: {
                    expand: "dataSourceTestFile"
                }
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.testResponse",
            args: [{
                dataSource: "works"
            }, "{arguments}.0"]
        }
    }
});

fluid.defaults("kettle.tests.dataSource.10.CouchDB.expand.static", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "10. Testing couchdb datasource with filesystem with expansion and static termMap",
    components: {
        dataSource: {
            type: "kettle.dataSource.CouchDB",
            options: {
                url: "file://%root/data/%expand.json",
                termMap: {
                    expand: "couchDataSourceTestFile"
                }
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.testResponse",
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
            type: "kettle.dataSource.CouchDB",
            options: {
                url: "file://%root/data/%expand.json",
                termMap: {
                    expand: "%expand"
                }
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.testResponse",
            args: [{
                dataSource: "works"
            }, "{arguments}.0"]
        }
    }
});

fluid.defaults("kettle.tests.dataSource.12.URL.set", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "12. Testing url datasource with filesystem - set",
    dataSourceMethod: "set",
    dataSourceModel: {
        test: "test"
    },
    components: {
        dataSource: {
            type: "kettle.dataSource.URL",
            options: {
                url: "file://%root/data/writeable/test.json",
                writable: true
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.testSetResponse",
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
            type: "kettle.dataSource.CouchDB",
            options: {
                notFoundIsEmpty: true,
                url: "file://%root/data/writeable/test.json",
                writable: true
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.testSetResponse",
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
            type: "kettle.dataSource.CouchDB",
            options: {
                url: "file://%root/data/writeable/couchDataSourceTestFile.json",
                writable: true
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.testSetResponse",
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

fluid.defaults("kettle.tests.dataSource.15.URL.set.expand", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "15. Testing url datasource with filesystem and expansion - set",
    dataSourceMethod: "set",
    directModel: {
        expand: "test"
    },
    dataSourceModel: {
        test: "test"
    },
    components: {
        dataSource: {
            type: "kettle.dataSource.URL",
            options: {
                url: "file://%root/data/writeable/%expand.json",
                termMap: {
                    expand: "%expand"
                },
                writable: true
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.testSetResponse",
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
            type: "kettle.dataSource.CouchDB",
            options: {
                url: "file://%root/data/writeable/%expand.json",
                termMap: {
                    expand: "%expand"
                },
                writable: true
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.testSetResponse",
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
    "kettle.tests.dataSource.1.URL.empty",
    "kettle.tests.dataSource.2.URL.standard",
    "kettle.tests.dataSource.3.CouchDB.standard",
    "kettle.tests.dataSource.4.CouchDB.empty",
    "kettle.tests.dataSource.5.CouchDB.error",
    "kettle.tests.dataSource.6.URL.expand.present",
    "kettle.tests.dataSource.7.URL.expand.missing",
    "kettle.tests.dataSource.8.CouchDB.expand.missing",
    "kettle.tests.dataSource.9.URL.expand.static",
    "kettle.tests.dataSource.10.CouchDB.expand.static",
    "kettle.tests.dataSource.11.CouchDB.expand.dynamic",
    "kettle.tests.dataSource.12.URL.set",
    "kettle.tests.dataSource.13.CouchDB.set",
    "kettle.tests.dataSource.14.CouchDB.set.existing",
    "kettle.tests.dataSource.15.URL.set.expand",
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
    "kettle.tests.dataSourceInitTester",
    "kettle.tests.dataSourceResolverTester"
]);

kettle.tests.dataSource.ensureWriteableEmpty();

kettle.test.bootstrap(tests);

fluid.test.runTests(["kettle.tests.dataSourceJSONTester"]);
