/*!
Kettle Data Source Tests

Copyright 2012 OCAD University
Copyright 2014 Raising the Floor - International

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/GPII/kettle/LICENSE.txt
*/

/*global require, module, __dirname*/

(function () {
    var fluid = require("infusion"),
         path = require("path"),
         kettle = fluid.require(path.resolve(__dirname, "../kettle.js")),
         fs = require("fs"),
         jqUnit = fluid.require("jqUnit");

    fluid.require(path.resolve(__dirname, "./utils/js/KettleTestUtils.js"));

    kettle.dataSource.errback.handleErrorTest = function (data) {
        jqUnit.assertTrue(
            "Data source should properly handle paths to non-existent or empty files",
            data.isError);
    };

    fluid.test.emptyResponseTester = function (data) {
        jqUnit.assertEquals("Expecting empty response on get to non-existent file/record",
            data, undefined);
    };

    fluid.test.makeSetResponseTester = function (dataSource, directModel, expected) {
        return function testResponse() {
            var fileName = dataSource.urlResolver.resolve(directModel).substring(7),
                data = JSON.parse(fs.readFileSync(fileName, "utf8"));

            jqUnit.assertDeepEq("Response is correct", expected, data);
            fs.unlink(fileName);
        };
    };

     fluid.test.setCouchDocument = function (config, dataSource) {
        var data = fluid.copy(config.model),
            fileName = dataSource.urlResolver.resolve(config.directModel);
        fileName = fileName.substring(7);
        data._id = "test_id";
        data._rev = "test_rev";
        data.ok = true;
        fs.writeFileSync(fileName, JSON.stringify(data), "utf8");
    };

    fluid.test.makeResponseTester = function (expected) {
        return function testResponse(data) {
            jqUnit.assertDeepEq("Response is correct", expected, data);
        };
    };

    fluid.test.makePromise = function (adapter, operation, directModel, callback) {
        adapter[operation](directModel).then(callback);
    };

    fluid.test.makeSetPromise = function (adapter, operation, directModel, model, callback) {
        adapter[operation](directModel, model).then(callback);
    };

    fluid.test.testInit = function (dataSource, expectedWrite) {
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

    fluid.test.testUrlResolver = function (urlResolver, directModel) {
        jqUnit.assertEquals("Data source should should expand urls based on termMap",
            "file://test/test.json", urlResolver.resolve(directModel));
    };

    fluid.defaults("fluid.test.dataSource", {
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
            funcName: "kettle.dataSource.errback.handleErrorTest",
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
                    url: "file://%root/data/emptyDataSourceTestFile.json"
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
                    url: "file://%root/data/emptyDataSourceTestFile.json"
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
            dataSource17: {
                type: "kettle.dataSource.URL",
                options: {
                    url: "file://%root/data/idontexist.json"
                }
            },

            // Adapter test components.
            callbackWrapper: {
                type: "kettle.requestContextCallbackWrapper"
            },
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
                    url: "file://%root/data/emptyDataSourceTestFile.json"
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
                type: "fluid.test.promiseAdapterDataSourceTester"
            },
            dataSourceTester: {
                type: "fluid.test.dataSourceTester"
            },
            generalDataSourceTester: {
                type: "fluid.test.generalDataSourceTester"
            },
            urlResolverTester: {
                type: "fluid.test.urlResolverTester"
            }
        }
    });

    fluid.defaults("fluid.test.dataSourceTester", {
        gradeNames: ["fluid.test.testCaseHolder", "autoInit"],
        modules: [{
            name: "Data Source",
            tests: [{
                expect: 1,
                name: "Testing url datasource with empty response.",
                func: "{dataSource1}.get",
                args: [null, fluid.test.emptyResponseTester]
            }, {
                name: "Testing get on url datasource for non-existent file.",
                func: "{dataSource17}.get",
                args: [null, fluid.test.emptyResponseTester]
            }, {
                expect: 1,
                name: "Testing url datasource with filesystem",
                func: "{dataSource2}.get",
                args: [null, {
                    expander: {
                        func: "fluid.test.makeResponseTester",
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
                        func: "fluid.test.makeResponseTester",
                        args: {
                            dataSource: "works"
                        }
                    }
                }]
            }, {
                expect: 1,
                name: "Testing couchdb datasource with empty response",
                func: "{dataSource4}.get",
                args: [null, fluid.test.emptyResponseTester]
            }, {
                expect: 1,
                name: "Testing couchdb datasource with filesystem and error response",
                func: "{dataSource5}.get",
                args: [null, {
                    expander: {
                        func: "fluid.test.makeResponseTester",
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
                }, fluid.test.emptyResponseTester]
            }, {
                expect: 1,
                name: "Testing couchdb datasource with filesystem with expansion and no file",
                func: "{dataSource7}.get",
                args: [{
                    expand: "not_found"
                }, fluid.test.emptyResponseTester]
            }, {
                expect: 1,
                name: "Testing url datasource with filesystem with expansion and static termMap",
                func: "{dataSource8}.get",
                args: [null, {
                    expander: {
                        func: "fluid.test.makeResponseTester",
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
                        func: "fluid.test.makeResponseTester",
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
                        func: "fluid.test.makeResponseTester",
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
                        func: "fluid.test.makeResponseTester",
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
                        func: "fluid.test.makeSetResponseTester",
                        args: ["{dataSource12}", null, {
                            test: "test"
                        }]
                    }
                }]
            }, {
                expect: 1,
                name: "Testing couchdb datasource with filesystem - set (non-existent file)",
                func: "{dataSource13}.set",
                args: [null, {
                    test: "test"
                }, {
                    expander: {
                        func: "fluid.test.makeSetResponseTester",
                        args: ["{dataSource13}", null, {
                            value:  {
                                test: "test"
                            }
                        }]
                    }
                }]
            }, {
                expect: 1,
                name: "Testing couchdb datasource with filesystem exiting doc - set",
                sequence: [{
                    func: "fluid.test.setCouchDocument",
                    args: [{
                        model: {
                            bogus: "text"
                        }
                    },
                    "{dataSource14}"

                    ]
                }, {
                    func: "{dataSource14}.set",
                    args: [null, {
                        test: "test"
                    }, {
                        expander: {
                            func: "fluid.test.makeSetResponseTester",
                            args: ["{dataSource14}", null, {
                                value: {
                                    test: "test"
                                },
                                _rev: "test_rev",
                                _id: "test_id"
                            }]
                        }
                    }]
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
                        func: "fluid.test.makeSetResponseTester",
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
                sequence: [{
                    func: "fluid.test.setCouchDocument",
                    args: [{
                        model: {
                            bogus: "text"
                        },
                        directModel: {
                            expand: "test"
                        }
                    }, "{dataSource16}" ]
                }, {
                    func: "{dataSource16}.set",
                    args: [{
                        expand: "test"
                    }, {
                        test: "test"
                    }, {
                        expander: {
                            func: "fluid.test.makeSetResponseTester",
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
        }]
    });

    fluid.defaults("fluid.test.promiseAdapterDataSourceTester", {
        gradeNames: ["fluid.test.testCaseHolder", "autoInit"],
        modules: [{
            name: "Promise Adapter Data Source",
            tests: [{
                expect: 1,
                name: "Testing promise adapter with filesystem",
                func: "fluid.test.makePromise",
                args: ["{adapter1}", "get", null, {
                    expander: {
                        func: "fluid.test.makeResponseTester",
                        args: {
                            dataSource: "works"
                        }
                    }
                }]
            }, {
                expect: 1,
                name: "Testing promise adapter with empty response",
                func: "fluid.test.makePromise",
                args: ["{adapter2}", "get", null, fluid.test.emptyResponseTester]
            }, {
                expect: 1,
                name: "Testing promise adapter with filesystem with expansion and no file",
                func: "fluid.test.makePromise",
                args: ["{adapter3}", "get", {
                    expand: "not_found"
                }, fluid.test.emptyResponseTester]
            }, {
                expect: 1,
                name: "Testing promise adapter with filesystem with expansion and static termMap",
                func: "fluid.test.makePromise",
                args: ["{adapter4}", "get", null, {
                    expander: {
                        func: "fluid.test.makeResponseTester",
                        args: {
                            dataSource: "works"
                        }
                    }
                }]
            }, {
                expect: 1,
                name: "Testing promise adapter with filesystem and expansion",
                func: "fluid.test.makePromise",
                args: ["{adapter5}", "get", {
                    expand: "dataSourceTestFile"
                }, {
                    expander: {
                        func: "fluid.test.makeResponseTester",
                        args: {
                            dataSource: "works"
                        }
                    }
                }]
            }, {
                expect: 1,
                name: "Testing promise adapter with filesystem and expansion",
                func: "fluid.test.makePromise",
                args: ["{adapter6}", "get", {
                    expand: "couchDataSourceTestFile"
                }, {
                    expander: {
                        func: "fluid.test.makeResponseTester",
                        args: {
                            dataSource: "works"
                        }
                    }
                }]
            }, {
                expect: 1,
                name: "Testing promise adapter with filesystem - set",
                func: "fluid.test.makeSetPromise",
                args: ["{adapter7}", "set", null, {
                    test: "test"
                }, {
                    expander: {
                        func: "fluid.test.makeSetResponseTester",
                        args: ["{adapter7}", null, {
                            test: "test"
                        }]
                    }
                }]
            }, {
                expect: 1,
                name: "Testing promise adapter with filesystem and expansion- set",
                func: "fluid.test.makeSetPromise",
                args: ["{adapter8}", "set", {
                    expand: "test"
                }, {
                    test: "test"
                }, {
                    expander: {
                        func: "fluid.test.makeSetResponseTester",
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

    fluid.defaults("fluid.test.generalDataSourceTester", {
        gradeNames: ["fluid.test.testCaseHolder", "autoInit"],
        modules: [{
            name: "General Data Source",
            tests: [{
                expect: 6,
                name: "URL Data source initialization",
                func: "fluid.test.testInit",
                args: ["{urlDataSource}", "POST"]
            }, {
                expect: 6,
                name: "CouchDB Data source initialization",
                func: "fluid.test.testInit",
                args: ["{couchDBDataSource}", "PUT"]
            }]
        }]
    });

    fluid.defaults("fluid.test.urlResolverTester", {
        gradeNames: ["fluid.test.testCaseHolder", "autoInit"],
        modules: [{
            name: "UrlResolver",
            tests: [{
                expect: 1,
                name: "URL Data source initialization",
                func: "fluid.test.testUrlResolver",
                args: "{urlDataSourceStatic}.urlResolver"
            }, {
                expect: 1,
                name: "CouchDB Data source initialization",
                func: "fluid.test.testUrlResolver",
                args: ["{urlDataSourceDynamic}.urlResolver", {
                    expand: "test"
                }]
            }]
        }]
    });

    if (kettle.tests.allTests) {
        module.exports = "fluid.test.dataSource";
    } else {
        fluid.test.runTests(["fluid.test.dataSource"]);
    }

}());
