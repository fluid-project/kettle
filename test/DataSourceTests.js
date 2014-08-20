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

kettle.tests.dataSource.handleError = function (data) {
    jqUnit.assertTrue(
        "Data source should properly handle paths to non-existent or empty files",
        data.isError);
};

kettle.tests.makeSetResponseTester = function (dataSource, directModel, expected) {
    var testResponse = function () {
        var fileName = dataSource.urlResolver.resolve(directModel).substring(7),
            data = JSON.parse(fs.readFileSync(fileName, "utf8"));
        jqUnit.assertDeepEq("Response is correct", expected, data);
        fs.unlink(fileName);
    };
    return testResponse;
};

kettle.tests.setCouchDocument = function (config, dataSource) {
    var data = fluid.copy(config.model),
        fileName = dataSource.urlResolver.resolve(config.directModel);
    fileName = fileName.substring(7);
    data._id = "test_id";
    data._rev = "test_rev";
    data.ok = true;
    fs.writeFileSync(fileName, JSON.stringify(data), "utf8");
};

kettle.tests.makeResponseTester = function (expected) {
    return function testResponse(data) {
        jqUnit.assertDeepEq("Response is correct", expected, data);
    };
};

kettle.tests.makePromise = function (adapter, operation, directModel, callback) {
    adapter[operation](directModel).then(callback);
};

kettle.tests.makeSetPromise = function (adapter, operation, directModel, model, callback) {
    adapter[operation](directModel, model).then(callback);
};

kettle.tests.testInit = function (dataSource, expectedWrite) {
    jqUnit.assertValue("Data source is initialized", dataSource);
    jqUnit.assertValue("Data source should have a get method",
        dataSource.get);
    jqUnit.assertEquals("Data source should have a correct write method",
        expectedWrite, dataSource.options.writeMethod);
    jqUnit.assertUndefined("Data source should not have a set method by default",
        dataSource.set);
    jqUnit.assertDeepEq("Data source should have a termMap", {},
        dataSource.options.termMap);
    jqUnit.assertValue("urlResolver is initialized", dataSource.urlResolver);
};

kettle.tests.testUrlResolver = function (urlResolver, directModel) {
    jqUnit.assertEquals("Data source should should expand urls based on termMap",
        "file://test/test.json", urlResolver.resolve(directModel));
};

fluid.defaults("kettle.tests.dataSource", {
    gradeNames: ["fluid.test.testEnvironment", "autoInit"],
    mergePolicy: {
        handleError: "noexpand"
    },
    distributeOptions: [{
        source: "{that}.options.handleError",
        target: "{that errback}.options.invokers.handleError"
    }, {
        source: "{that}.options.vars",
        target: "{that urlExpander}.options.vars"
    }],
    handleError: {
        funcName: "kettle.tests.dataSource.handleError",
        args: "{arguments}.0"
    },
    vars: {
        root: __dirname
    },
    components: {

        // Data source test components.
        urlDataSource: {
            type: "kettle.dataSource.URL"
        },
        couchDBDataSource: {
            type: "kettle.dataSource.CouchDB"
        },
        urlDataSourceStatic: {
            type: "kettle.dataSource.URL",
            options: {
                url: "file://%expand/test.json",
                termMap: {
                    expand: "test"
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
        dataSource1: {
            type: "kettle.dataSource.URL",
            options: {
                url: "file://%root/data/emptyDataSourceTestFile.txt"
            }
        },
        dataSource2: {
            type: "kettle.dataSource.URL",
            options: {
                url: "file://%root/data/dataSourceTestFile.json"
            }
        },
        dataSource3: {
            type: "kettle.dataSource.CouchDB",
            options: {
                url: "file://%root/data/couchDataSourceTestFile.json"
            }
        },
        dataSource4: {
            type: "kettle.dataSource.CouchDB",
            options: {
                url: "file://%root/data/emptyDataSourceTestFile.txt"
            }
        },
        dataSource5: {
            type: "kettle.dataSource.CouchDB",
            options: {
                url: "file://%root/data/couchDataSourceError.json"
            }
        },
        dataSource6: {
            type: "kettle.dataSource.URL",
            options: {
                url: "file://%root/data/%expand.json",
                termMap: {
                    expand: "%expand"
                }
            }
        },
        dataSource7: {
            type: "kettle.dataSource.CouchDB",
            options: {
                url: "file://%root/data/%expand.json",
                termMap: {
                    expand: "%expand"
                }
            }
        },
        dataSource8: {
            type: "kettle.dataSource.URL",
            options: {
                url: "file://%root/data/%expand.json",
                termMap: {
                    expand: "dataSourceTestFile"
                }
            }
        },
        dataSource9: {
            type: "kettle.dataSource.CouchDB",
            options: {
                url: "file://%root/data/%expand.json",
                termMap: {
                    expand: "couchDataSourceTestFile"
                }
            }
        },
        dataSource10: {
            type: "kettle.dataSource.URL",
            options: {
                url: "file://%root/data/%expand.json",
                termMap: {
                    expand: "%expand"
                }
            }
        },
        dataSource11: {
            type: "kettle.dataSource.CouchDB",
            options: {
                url: "file://%root/data/%expand.json",
                termMap: {
                    expand: "%expand"
                }
            }
        },
        dataSource12: {
            type: "kettle.dataSource.URL",
            options: {
                url: "file://%root/data/test.json",
                writable: true
            }
        },
        dataSource13: {
            type: "kettle.dataSource.CouchDB",
            options: {
                url: "file://%root/data/test.json",
                writable: true
            }
        },
        dataSource14: {
            type: "kettle.dataSource.CouchDB",
            options: {
                url: "file://%root/data/tmpCouchDataSourceTestFile.json",
                writable: true
            }
        },
        dataSource15: {
            type: "kettle.dataSource.URL",
            options: {
                url: "file://%root/data/%expand.json",
                termMap: {
                    expand: "%expand"
                },
                writable: true
            }
        },
        dataSource16: {
            type: "kettle.dataSource.CouchDB",
            options: {
                url: "file://%root/data/%expand.json",
                termMap: {
                    expand: "%expand"
                },
                writable: true
            }
        },

        // Adapter test components.
        adapter1: {
            type: "kettle.dataSource.URL",
            options: {
                gradeNames: ["kettle.dataSource.promiseCallbackWrapper"],
                url: "file://%root/data/dataSourceTestFile.json"
            }
        },
        adapter2: {
            type: "kettle.dataSource.URL",
            options: {
                gradeNames: ["kettle.dataSource.promiseCallbackWrapper"],
                url: "file://%root/data/emptyDataSourceTestFile.txt"
            }
        },
        adapter3: {
            type: "kettle.dataSource.URL",
            options: {
                gradeNames: ["kettle.dataSource.promiseCallbackWrapper"],
                url: "file://%root/data/%expand.json",
                termMap: {
                    expand: "%expand"
                }
            }
        },
        adapter4: {
            type: "kettle.dataSource.URL",
            options: {
                gradeNames: ["kettle.dataSource.promiseCallbackWrapper"],
                url: "file://%root/data/%expand.json",
                termMap: {
                    expand: "dataSourceTestFile"
                }
            }
        },
        adapter5: {
            type: "kettle.dataSource.URL",
            options: {
                gradeNames: ["kettle.dataSource.promiseCallbackWrapper"],
                url: "file://%root/data/%expand.json",
                termMap: {
                    expand: "%expand"
                }
            }
        },
        adapter6: {
            type: "kettle.dataSource.CouchDB",
            options: {
                gradeNames: ["kettle.dataSource.promiseCallbackWrapper"],
                url: "file://%root/data/%expand.json",
                termMap: {
                    expand: "%expand"
                }
            }
        },
        adapter7: {
            type: "kettle.dataSource.URL",
            options: {
                gradeNames: ["kettle.dataSource.promiseCallbackWrapper"],
                url: "file://%root/data/test.json",
                writable: true
            }
        },
        adapter8: {
            type: "kettle.dataSource.URL",
            options: {
                gradeNames: ["kettle.dataSource.promiseCallbackWrapper"],
                url: "file://%root/data/%expand.json",
                termMap: {
                    expand: "%expand"
                },
                writable: true
            }
        },

        // Testers.
        promiseAdapterDataSourceTester: {
            type: "kettle.tests.promiseAdapterDataSourceTester"
        },
        dataSourceTester: {
            type: "kettle.tests.dataSourceTester"
        },
        generalDataSourceTester: {
            type: "kettle.tests.generalDataSourceTester"
        },
        urlResolverTester: {
            type: "kettle.tests.urlResolverTester"
        }
    }
});

fluid.defaults("kettle.tests.dataSourceTester", {
    gradeNames: ["fluid.test.testCaseHolder", "autoInit"],
    modules: [{
        name: "Data Source",
        tests: [{
            expect: 1,
            name: "Testing url datasource with empty response.",
            func: "{dataSource1}.get",
            args: [null, fluid.identity]
        }, {
            expect: 1,
            name: "Testing url datasource with filesystem",
            func: "{dataSource2}.get",
            args: [null, {
                expander: {
                    func: "kettle.tests.makeResponseTester",
                    args: {
                        dataSource: "works"
                    }
                }
            }]
        }, {
            expect: 1,
            name: "Testing couchdb datasource with filesystem",
            func: "{dataSource3}.get",
            args: [null, {
                expander: {
                    func: "kettle.tests.makeResponseTester",
                    args: {
                        dataSource: "works"
                    }
                }
            }]
        }, {
            expect: 1,
            name: "Testing couchdb datasource with empty response",
            func: "{dataSource4}.get",
            args: [null, fluid.identity]
        }, {
            expect: 1,
            name: "Testing couchdb datasource with filesystem and error response",
            func: "{dataSource5}.get",
            args: [null, {
                expander: {
                    func: "kettle.tests.makeResponseTester",
                    args: {
                        isError: true,
                        message: "not_found: missing"
                    }
                }
            }]
        }, {
            expect: 1,
            name: "Testing url datasource with filesystem with expansion and no file",
            func: "{dataSource6}.get",
            args: [{
                expand: "not_found"
            }, fluid.identity]
        }, {
            expect: 1,
            name: "Testing couchdb datasource with filesystem with expansion and no file",
            func: "{dataSource7}.get",
            args: [{
                expand: "not_found"
            }, fluid.identity]
        }, {
            expect: 1,
            name: "Testing url datasource with filesystem with expansion and static termMap",
            func: "{dataSource8}.get",
            args: [null, {
                expander: {
                    func: "kettle.tests.makeResponseTester",
                    args: {
                        dataSource: "works"
                    }
                }
            }]
        }, {
            expect: 1,
            name: "Testing couchdb datasource with filesystem with expansion and static termMap",
            func: "{dataSource9}.get",
            args: [null, {
                expander: {
                    func: "kettle.tests.makeResponseTester",
                    args: {
                        dataSource: "works"
                    }
                }
            }]
        }, {
            expect: 1,
            name: "Testing url datasource with filesystem and expansion",
            func: "{dataSource10}.get",
            args: [{
                expand: "dataSourceTestFile"
            }, {
                expander: {
                    func: "kettle.tests.makeResponseTester",
                    args: {
                        dataSource: "works"
                    }
                }
            }]
        }, {
            expect: 1,
            name: "Testing couchdb datasource with filesystem and expansion",
            func: "{dataSource11}.get",
            args: [{
                expand: "couchDataSourceTestFile"
            }, {
                expander: {
                    func: "kettle.tests.makeResponseTester",
                    args: {
                        dataSource: "works"
                    }
                }
            }]
        }, {
            expect: 1,
            name: "Testing url datasource with filesystem - set",
            func: "{dataSource12}.set",
            args: [null, {
                test: "test"
            }, {
                expander: {
                    func: "kettle.tests.makeSetResponseTester",
                    args: ["{dataSource12}", null, {
                        test: "test"
                    }]
                }
            }]
        }, {
            expect: 1,
            name: "Testing couchdb datasource with filesystem - set",
            func: "{dataSource13}.set",
            args: [null, {
                test: "test"
            }, {
                expander: {
                    func: "kettle.tests.makeSetResponseTester",
                    args: ["{dataSource13}", null, {
                        test: "test"
                    }]
                }
            }]
        }, {
            expect: 1,
            name: "Testing couchdb datasource with filesystem exiting doc - set",
            func: "{dataSource14}.set",
            args: [null, {
                test: "test"
            }, {
                expander: {
                    func: "kettle.tests.makeSetResponseTester",
                    args: ["{dataSource14}", null, {
                        value: {
                            test: "test"
                        },
                        _rev: "test_rev",
                        _id: "test_id"
                    }]
                }
            }]
        }, {
            expect: 1,
            name: "Testing url datasource with filesystem and expansion- set",
            func: "{dataSource15}.set",
            args: [{
                expand: "test"
            }, {
                test: "test"
            }, {
                expander: {
                    func: "kettle.tests.makeSetResponseTester",
                    args: ["{dataSource15}", {
                        expand: "test"
                    }, {
                        test: "test"
                    }]
                }
            }]
        }, {
            expect: 1,
            name: "Testing couchdb datasource with filesystem and expansion- set",
            func: "{dataSource16}.set",
            args: [{
                expand: "test"
            }, {
                test: "test"
            }, {
                expander: {
                    func: "kettle.tests.makeSetResponseTester",
                    args: ["{dataSource16}", {
                        expand: "test"
                    }, {
                        value: {
                            test: "test"
                        },
                        _rev: "test_rev",
                        _id: "test_id"
                    }]
                }
            }]
        }]
    }]
});

fluid.defaults("kettle.tests.promiseAdapterDataSourceTester", {
    gradeNames: ["fluid.test.testCaseHolder", "autoInit"],
    modules: [{
        name: "Promise Adapter Data Source",
        tests: [{
            expect: 1,
            name: "Testing promise adapter with filesystem",
            func: "kettle.tests.makePromise",
            args: ["{adapter1}", "get", null, {
                expander: {
                    func: "kettle.tests.makeResponseTester",
                    args: {
                        dataSource: "works"
                    }
                }
            }]
        }, {
            expect: 1,
            name: "Testing promise adapter with empty response",
            func: "kettle.tests.makePromise",
            args: ["{adapter2}", "get", null, fluid.identity]
        }, {
            expect: 1,
            name: "Testing promise adapter with filesystem with expansion and no file",
            func: "kettle.tests.makePromise",
            args: ["{adapter3}", "get", {
                expand: "not_found"
            }, fluid.identity]
        }, {
            expect: 1,
            name: "Testing promise adapter with filesystem with expansion and static termMap",
            func: "kettle.tests.makePromise",
            args: ["{adapter4}", "get", null, {
                expander: {
                    func: "kettle.tests.makeResponseTester",
                    args: {
                        dataSource: "works"
                    }
                }
            }]
        }, {
            expect: 1,
            name: "Testing promise adapter with filesystem and expansion",
            func: "kettle.tests.makePromise",
            args: ["{adapter5}", "get", {
                expand: "dataSourceTestFile"
            }, {
                expander: {
                    func: "kettle.tests.makeResponseTester",
                    args: {
                        dataSource: "works"
                    }
                }
            }]
        }, {
            expect: 1,
            name: "Testing promise adapter with filesystem and expansion",
            func: "kettle.tests.makePromise",
            args: ["{adapter6}", "get", {
                expand: "couchDataSourceTestFile"
            }, {
                expander: {
                    func: "kettle.tests.makeResponseTester",
                    args: {
                        dataSource: "works"
                    }
                }
            }]
        }, {
            expect: 1,
            name: "Testing promise adapter with filesystem - set",
            func: "kettle.tests.makeSetPromise",
            args: ["{adapter7}", "set", null, {
                test: "test"
            }, {
                expander: {
                    func: "kettle.tests.makeSetResponseTester",
                    args: ["{adapter7}", null, {
                        test: "test"
                    }]
                }
            }]
        }, {
            expect: 1,
            name: "Testing promise adapter with filesystem and expansion- set",
            func: "kettle.tests.makeSetPromise",
            args: ["{adapter8}", "set", {
                expand: "test"
            }, {
                test: "test"
            }, {
                expander: {
                    func: "kettle.tests.makeSetResponseTester",
                    args: ["{adapter8}", {
                        expand: "test"
                    }, {
                        test: "test"
                    }]
                }
            }]
        }]
    }]
});

fluid.defaults("kettle.tests.generalDataSourceTester", {
    gradeNames: ["fluid.test.testCaseHolder", "autoInit"],
    modules: [{
        name: "General Data Source",
        tests: [{
            expect: 6,
            name: "URL Data source initialization",
            func: "kettle.tests.testInit",
            args: ["{urlDataSource}", "POST"]
        }, {
            expect: 6,
            name: "CouchDB Data source initialization",
            func: "kettle.tests.testInit",
            args: ["{couchDBDataSource}", "PUT"]
        }]
    }]
});

fluid.defaults("kettle.tests.urlResolverTester", {
    gradeNames: ["fluid.test.testCaseHolder", "autoInit"],
    modules: [{
        name: "UrlResolver",
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
                expand: "test"
            }]
        }]
    }]
});

module.exports = kettle.test.bootstrap("kettle.tests.dataSource");

