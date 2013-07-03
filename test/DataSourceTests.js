/*!
Kettle Data Source Tests

Copyright 2012 Raising the Floor - International

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/GPII/kettle/LICENSE.txt
*/

/*global require, __dirname*/

(function () {
    // This loads universal.
     var fluid = require("infusion"),
         path = require("path"),
         kettle = fluid.require(path.resolve(__dirname, "../kettle.js"));
         fs = require("fs"),
         jqUnit = fluid.require("jqUnit");

    fluid.demands("kettle.urlExpander", "fluid.test.testEnvironment", {
        options: {
            vars: {
                root: __dirname
            }
        }
    });

    fluid.demands("kettle.dataSource.errback.handleError",
        ["kettle.dataSource.errback", "fluid.test.testEnvironment"], {
            funcName: "kettle.dataSource.errback.handleErrorTest",
            args: "{arguments}.0"
        }
    );

    fluid.test.cleanUpAndContinue = function cleanUpAndContinue(fileName) {
        fileName = fileName.substring(7);
        fs.unlink(fileName);
        jqUnit.start();
    };

    kettle.dataSource.errback.handleErrorTest = function (data) {
        jqUnit.assertTrue(
            "Data source should properly handle paths to non-existent or empty files",
            data.isError);
    };

    fluid.test.setCouchDocument = function setCouchDocument(config, dataSource) {
        var data = fluid.copy(config.model),
            fileName = dataSource.urlResolver.resolve(config.directModel);
        fileName = fileName.substring(7);
        data._id = "test_id";
        data._rev = "test_rev";
        data.ok = true;
        fs.writeFileSync(fileName, JSON.stringify(data), "utf8");
    };

    fluid.defaults("fluid.test.dataSource", {
        gradeNames: ["fluid.test.testEnvironment", "autoInit"],
        components: {
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
            dataSourceTester: {
                type: "fluid.test.dataSourceTester"
            }
        }
    });

    fluid.test.makeResponseTester = function makeResponseTester(expected) {
        return function testResponse(data) {
            jqUnit.assertDeepEq("Response is correct", expected, data);
        };
    };

    fluid.test.makePromise = function (adapter, operation, directModel, callback) {
        adapter[operation](directModel).then(callback);
    };

    fluid.defaults("fluid.test.dataSourceTester", {
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
                args: [null, fluid.identity]
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
            }]
        }]
    });

    fluid.defaults("fluid.test.promiseAdapterdataSource", {
        gradeNames: ["fluid.test.testEnvironment", "autoInit"],
        components: {
            callbackWrapper: {
                type: "kettle.requestContextCallbackWrapper"
            },
            rawDataSource1: {
                type: "kettle.dataSource.URL",
                options: {
                    url: "file://%root/data/dataSourceTestFile.json"
                }
            },
            adapter1: {
                type: "kettle.callbackWrappingPromiseDataSource",
                options: {
                    components: {
                        rawSource: "{rawDataSource1}"
                    }
                }
            },
            promiseAdapterDataSourceTester: {
                type: "fluid.test.promiseAdapterDataSourceTester"
            }
        }
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
            }]
        }]
    });

    fluid.test.runTests([
        "fluid.test.dataSource",
        "fluid.test.promiseAdapterdataSource"
    ]);

    // var testConfig = {
    //     "Testing promise adapter with filesystem": {
    //         dataSourceOptions: {
    //             url: "file://%root/data/dataSourceTestFile.json"
    //         },
    //         testEnv: promiseAdapterDataSourceTester,
    //         adapter: "kettle.callbackWrappingPromiseDataSource",
    //         testType: "asyncTest",
    //         operation: "get",
    //         directModel: null,
    //         testCases: {
    //             "Data source should properly fetch data from a local file": {
    //                 operation: "assertDeepEq",
    //                 expected: {
    //                     dataSource: "works"
    //                 },
    //                 getTestValue: function (options) {
    //                     return options.data;
    //                 }
    //             }
    //         }
    //     },
    //     "Testing promise adapter with empty response": {
    //         testEnv: promiseAdapterDataSourceTester,
    //         adapter: "kettle.callbackWrappingPromiseDataSource",
    //         dataSourceOptions: {
    //             url: "file://%root/data/emptyDataSourceTestFile.json"
    //         },
    //         testType: "asyncTest",
    //         operation: "get",
    //         directModel: null
    //     },
    //     "Testing promise adapter with filesystem with expansion and no file": {
    //         dataSourceOptions: {
    //             url: "file://%root/data/%expand.json",
    //             termMap: {
    //                 expand: "%expand"
    //             }
    //         },
    //         testEnv: promiseAdapterDataSourceTester,
    //         adapter: "kettle.callbackWrappingPromiseDataSource",
    //         testType: "asyncTest",
    //         operation: "get",
    //         directModel: {
    //             expand: "not_found"
    //         }
    //     },
    //     "Testing promise adapter with filesystem with expansion and static termMap": {
    //         dataSourceOptions: {
    //             url: "file://%root/data/%expand.json",
    //             termMap: {
    //                 expand: "dataSourceTestFile"
    //             }
    //         },
    //         testEnv: promiseAdapterDataSourceTester,
    //         adapter: "kettle.callbackWrappingPromiseDataSource",
    //         testType: "asyncTest",
    //         operation: "get",
    //         directModel: null,
    //         testCases: {
    //             "Data source should properly fetch data from a local file": {
    //                 operation: "assertDeepEq",
    //                 expected: {
    //                     dataSource: "works"
    //                 },
    //                 getTestValue: function (options) {
    //                     return options.data;
    //                 }
    //             }
    //         }
    //     },
    //     "Testing url datasource with filesystem and expansion": {
    //         dataSourceOptions: {
    //             url: "file://%root/data/%expand.json",
    //             termMap: {
    //                 expand: "%expand"
    //             }
    //         },
    //         testType: "asyncTest",
    //         operation: "get",
    //         directModel: {
    //             expand: "dataSourceTestFile"
    //         },
    //         testCases: {
    //             "Data source should properly fetch data from a local file": {
    //                 operation: "assertDeepEq",
    //                 expected: {
    //                     dataSource: "works"
    //                 },
    //                 getTestValue: function (options) {
    //                     return options.data;
    //                 }
    //             }
    //         }
    //     },
    //     "Testing couchdb datasource with filesystem and expansion": {
    //         dataSourceType: "CouchDB",
    //         dataSourceOptions: {
    //             url: "file://%root/data/%expand.json",
    //             termMap: {
    //                 expand: "%expand"
    //             }
    //         },
    //         testType: "asyncTest",
    //         operation: "get",
    //         directModel: {
    //             expand: "couchDataSourceTestFile"
    //         },
    //         testCases: {
    //             "Data source should properly fetch data from a local file": {
    //                 operation: "assertDeepEq",
    //                 expected: {
    //                     dataSource: "works"
    //                 },
    //                 getTestValue: function (options) {
    //                     return options.data;
    //                 }
    //             }
    //         }
    //     },
    //     "Testing promise adapter with filesystem and expansion": {
    //         dataSourceOptions: {
    //             url: "file://%root/data/%expand.json",
    //             termMap: {
    //                 expand: "%expand"
    //             }
    //         },
    //         testEnv: promiseAdapterDataSourceTester,
    //         adapter: "kettle.callbackWrappingPromiseDataSource",
    //         testType: "asyncTest",
    //         operation: "get",
    //         directModel: {
    //             expand: "dataSourceTestFile"
    //         },
    //         testCases: {
    //             "Data source should properly fetch data from a local file": {
    //                 operation: "assertDeepEq",
    //                 expected: {
    //                     dataSource: "works"
    //                 },
    //                 getTestValue: function (options) {
    //                     return options.data;
    //                 }
    //             }
    //         }
    //     },
    //     "Testing url datasource with filesystem - set": {
    //         dataSourceOptions: {
    //             url: "file://%root/data/test.json",
    //             writable: true
    //         },
    //         testType: "asyncTest",
    //         operation: "set",
    //         directModel: null,
    //         model: {
    //             test: "test"
    //         },
    //         testCases: {
    //             "Data source should properly save data to a local file": {
    //                 operation: "assertDeepEq",
    //                 expected: {
    //                     test: "test"
    //                 },
    //                 getTestValue: function (options) {
    //                     var path = options.dataSource.urlResolver.resolve(options.directModel).substring(7);
    //                     return JSON.parse(fs.readFileSync(path, "utf8"));
    //                 }
    //             }
    //         }
    //     },
    //     "Testing couchdb datasource with filesystem - set": {
    //         dataSourceType: "CouchDB",
    //         dataSourceOptions: {
    //             url: "file://%root/data/test.json",
    //             writable: true
    //         },
    //         testType: "asyncTest",
    //         operation: "set",
    //         directModel: null,
    //         model: {
    //             test: "test"
    //         },
    //         testCases: {
    //             "Data source should properly save data to a local file": {
    //                 operation: "assertDeepEq",
    //                 expected: {
    //                     test: "test"
    //                 },
    //                 getTestValue: function (options) {
    //                     var path = options.dataSource.urlResolver.resolve(options.directModel).substring(7);
    //                     return JSON.parse(fs.readFileSync(path, "utf8"));
    //                 }
    //             }
    //         }
    //     },
    //     "Testing couchdb datasource with filesystem exiting doc - set": {
    //         dataSourceType: "CouchDB",
    //         preInit: setCouchDocument,
    //         dataSourceOptions: {
    //             url: "file://%root/data/tmpCouchDataSourceTestFile.json",
    //             writable: true
    //         },
    //         testType: "asyncTest",
    //         operation: "set",
    //         directModel: null,
    //         model: {
    //             test: "test"
    //         },
    //         testCases: {
    //             "Data source should properly save data to a local file": {
    //                 operation: "assertDeepEq",
    //                 expected: {
    //                     value: {
    //                         test: "test"
    //                     },
    //                     _rev: "test_rev",
    //                     _id: "test_id"
    //                 },
    //                 getTestValue: function (options) {
    //                     var path = options.dataSource.urlResolver.resolve(options.directModel).substring(7);
    //                     return JSON.parse(fs.readFileSync(path, "utf8"));
    //                 }
    //             }
    //         }
    //     },
    //     "Testing promise adapter with filesystem - set": {
    //         dataSourceOptions: {
    //             url: "file://%root/data/test.json",
    //             writable: true
    //         },
    //         testEnv: promiseAdapterDataSourceTester,
    //         adapter: "kettle.callbackWrappingPromiseDataSource",
    //         testType: "asyncTest",
    //         operation: "set",
    //         directModel: null,
    //         model: {
    //             test: "test"
    //         },
    //         testCases: {
    //             "Data source should properly save data to a local file": {
    //                 operation: "assertDeepEq",
    //                 expected: {
    //                     test: "test"
    //                 },
    //                 getTestValue: function (options) {
    //                     var path = options.dataSource.urlResolver.resolve(options.directModel).substring(7);
    //                     return JSON.parse(fs.readFileSync(path, "utf8"));
    //                 }
    //             }
    //         }
    //     },
    //     "Testing url datasource with filesystem and expansion- set": {
    //         dataSourceOptions: {
    //             url: "file://%root/data/%expand.json",
    //             termMap: {
    //                 expand: "%expand"
    //             },
    //             writable: true
    //         },
    //         testType: "asyncTest",
    //         operation: "set",
    //         directModel: {
    //             expand: "test"
    //         },
    //         model: {
    //             test: "test"
    //         },
    //         testCases: {
    //             "Data source should properly save data to a local file": {
    //                 operation: "assertDeepEq",
    //                 expected: {
    //                     test: "test"
    //                 },
    //                 getTestValue: function (options) {
    //                     var path = options.dataSource.urlResolver.resolve(options.directModel).substring(7);
    //                     return JSON.parse(fs.readFileSync(path, "utf8"));
    //                 }
    //             }
    //         }
    //     },
    //     "Testing couchdb datasource with filesystem and expansion- set": {
    //         dataSourceType: "CouchDB",
    //         dataSourceOptions: {
    //             url: "file://%root/data/%expand.json",
    //             termMap: {
    //                 expand: "%expand"
    //             },
    //             writable: true
    //         },
    //         testType: "asyncTest",
    //         operation: "set",
    //         directModel: {
    //             expand: "test"
    //         },
    //         model: {
    //             test: "test"
    //         },
    //         testCases: {
    //             "Data source should properly save data to a local file": {
    //                 operation: "assertDeepEq",
    //                 expected: {
    //                     test: "test"
    //                 },
    //                 getTestValue: function (options) {
    //                     var path = options.dataSource.urlResolver.resolve(options.directModel).substring(7);
    //                     return JSON.parse(fs.readFileSync(path, "utf8"));
    //                 }
    //             }
    //         }
    //     },
    //     "Testing promise adapter with filesystem and expansion- set": {
    //         dataSourceOptions: {
    //             url: "file://%root/data/%expand.json",
    //             termMap: {
    //                 expand: "%expand"
    //             },
    //             writable: true
    //         },
    //         testEnv: promiseAdapterDataSourceTester,
    //         adapter: "kettle.callbackWrappingPromiseDataSource",
    //         testType: "asyncTest",
    //         operation: "set",
    //         directModel: {
    //             expand: "test"
    //         },
    //         model: {
    //             test: "test"
    //         },
    //         testCases: {
    //             "Data source should properly save data to a local file": {
    //                 operation: "assertDeepEq",
    //                 expected: {
    //                     test: "test"
    //                 },
    //                 getTestValue: function (options) {
    //                     var path = options.dataSource.urlResolver.resolve(options.directModel).substring(7);
    //                     return JSON.parse(fs.readFileSync(path, "utf8"));
    //                 }
    //             }
    //         }
    //     },
    //     "Initialization": {
    //         testType: "test",
    //         testCases: {
    //             "Data source is initialized": {
    //                 operation: "assertValue",
    //                 getTestValue: function (options) {
    //                     return options.dataSource;
    //                 }
    //             },
    //             "Data source should have a get method": {
    //                 operation: "assertValue",
    //                 getTestValue: function (options) {
    //                     return options.dataSource.get;
    //                 }
    //             },
    //             "Data source should have a correct write method": {
    //                 operation: "assertEquals",
    //                 expected: "POST",
    //                 getTestValue: function (options) {
    //                     return options.dataSource.options.writeMethod;
    //                 }
    //             },
    //             "Data source should not have a set method by default": {
    //                 operation: "assertUndefined",
    //                 getTestValue: function (options) {
    //                     return options.dataSource.set;
    //                 }
    //             }
    //         }
    //     },
    //     "UrlResolver tests: dynamic expansion": {
    //         testType: "test",
    //         dataSourceOptions: {
    //             url: "file://%expand/test.json",
    //             termMap: {
    //                 expand: "%expand"
    //             }
    //         },
    //         testCases: {
    //             "Data source should should expand urls based on termMap": {
    //                 operation: "assertEquals",
    //                 expected: "file://test/test.json",
    //                 getTestValue: function (options) {
    //                     return options.dataSource.urlResolver.resolve({expand: "test"});
    //                 }
    //             }
    //         }
    //     },
    //     "Initialization - CouchDB": {
    //         testType: "test",
    //         dataSourceType: "CouchDB",
    //         testCases: {
    //             "Data source is initialized": {
    //                 operation: "assertValue",
    //                 getTestValue: function (options) {
    //                     return options.dataSource;
    //                 }
    //             },
    //             "Data source should have a correct write method": {
    //                 operation: "assertEquals",
    //                 expected: "PUT",
    //                 getTestValue: function (options) {
    //                     return options.dataSource.options.writeMethod;
    //                 }
    //             },
    //             "Data source should have a termMap": {
    //                 operation: "assertDeepEq",
    //                 expected: {},
    //                 getTestValue: function (options) {
    //                     return options.dataSource.options.termMap;
    //                 }
    //             },
    //             "urlResolver is initialized": {
    //                 operation: "assertValue",
    //                 getTestValue: function (options) {
    //                     return options.dataSource.urlResolver;
    //                 }
    //             }
    //         }
    //     },
    //     "UrlResolver tests: static expansion": {
    //         testType: "test",
    //         dataSourceOptions: {
    //             url: "file://%expand/test.json",
    //             termMap: {
    //                 expand: "test"
    //             }
    //         },
    //         testCases: {
    //             "Data source should should expand urls based on termMap": {
    //                 operation: "assertEquals",
    //                 expected: "file://test/test.json",
    //                 getTestValue: function (options) {
    //                     return options.dataSource.urlResolver.resolve();
    //                 }
    //             }
    //         }
    //     }
    // };

    // var testRunner = function (testsConfig) {
    //     fluid.each(testsConfig, function (config, testName) {
    //         var testEnv = config.testEnv || dataSourceTester;
    //         testEnv[config.testType](testName, function () {
    //             var dataSourceType = config.dataSourceType || "URL",
    //                 dataSource = testEnv.addToEnvironment("dataSource", fluid.model.composeSegments("kettle.dataSource", dataSourceType), config.dataSourceOptions),
    //                 basicCallback = function (data) {
    //                     fluid.each(config.testCases, function (testCase, name) {
    //                         var args = [name], options = {
    //                             dataSource: dataSource,
    //                             data: data,
    //                             directModel: config.directModel
    //                         };
    //                         if (testCase.expected) {
    //                             args.push(testCase.expected);
    //                         }
    //                         args.push(testCase.getTestValue(options));
    //                         jqUnit[testCase.operation].apply(null, args);
    //                     });
    //                 }, callback, adapter, args = [];
    //             if (config.testType === "test") {
    //                 basicCallback();
    //                 return;
    //             }
    //             callback = function (data) {
    //                 basicCallback(data);
    //                 if (config.operation === "get") {
    //                     jqUnit.start();
    //                     return;
    //                 }
    //                 cleanUpAndContinue(dataSource.urlResolver.resolve(config.directModel));
    //             };
    //             args.push(config.directModel);
    //             if (config.model) {
    //                 args.push(config.model);
    //             }
    //             if (config.preInit) {
    //                 config.preInit(config, dataSource);
    //             }
    //             if (config.adapter) {
    //                 adapter = testEnv.addToEnvironment("adapter", config.adapter, {
                        // components: {
                        //     rawSource: "{dataSource}"
                        // }
    //                 });
    //                 adapter[config.operation].apply(null, args).then(callback);
    //             } else {
    //                 args.push(callback);
    //                 dataSource[config.operation].apply(null, args);
    //             }
    //         });
    //     });
    // };

}());