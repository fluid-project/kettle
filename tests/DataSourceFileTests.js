/*!
Kettle Data Source Tests

Copyright 2017-2018 OCAD University
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
    JSON5 = require("json5"),
    jqUnit = fluid.require("node-jqunit", require, "jqUnit");

require("./shared/DataSourceTestUtils.js");

kettle.tests.dataSource.ensureDirectoryEmpty("%kettle/tests/data/writeable");

kettle.tests.dataSource.testFileSetResponse = function (dataSource, directModel, expected, encoding) {
    var fileName = fluid.dataSource.URL.resolveUrl(dataSource.options.path, dataSource.options.termMap, directModel, true),
        encoder = encoding === "JSON5" ? JSON5 : JSON,
        data = encoder.parse(fs.readFileSync(fileName, "utf8"));
    jqUnit.assertDeepEq("Response is correct", expected, data);
    fs.unlinkSync(fileName);
};


fluid.defaults("kettle.tests.dataSource.1.file.empty", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "1. Testing file datasource with empty response",
    components: {
        dataSource: {
            type: "kettle.dataSource.file",
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
            type: "kettle.dataSource.file",
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

fluid.defaults("kettle.tests.dataSource.3.CouchDB.file.standard", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "3. Testing CouchDB datasource with standard response",
    components: {
        dataSource: {
            type: "kettle.dataSource.file",
            options: {
                gradeNames: "kettle.dataSource.CouchDB",
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

fluid.defaults("kettle.tests.dataSource.4.CouchDB.file.empty", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "4. Testing CouchDB datasource with empty response",
    components: {
        dataSource: {
            type: "kettle.dataSource.file",
            options: {
                gradeNames: "kettle.dataSource.CouchDB",
                path: "%kettle/tests/data/emptyDataSourceTestFile.txt"
            }
        }
    },
    invokers: {
        responseFunc: "kettle.tests.dataSource.testEmptyResponse"
    }
});

fluid.defaults("kettle.tests.dataSource.5.CouchDB.file.missing", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "5. Testing CouchDB file datasource with missing file",
    shouldError: true,
    components: {
        dataSource: {
            type: "kettle.dataSource.file",
            options: {
                gradeNames: "kettle.dataSource.CouchDB",
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
                message: fluid.module.resolvePath("File %kettle/tests/data/nonexistent.txt was not found")
            }, "{arguments}.0"]
        }
    }
});

fluid.defaults("kettle.tests.dataSource.6.CouchDB.file.error", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "6. Testing CouchDB datasource with error response",
    shouldError: true,
    components: {
        dataSource: {
            type: "kettle.dataSource.file",
            options: {
                gradeNames: "kettle.dataSource.CouchDB",
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

fluid.defaults("kettle.tests.dataSource.7.file.expand.present", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "7. Testing filesystem datasource with expansion",
    directModel: {
        expand: "dataSourceTestFile"
    },
    components: {
        dataSource: {
            type: "kettle.dataSource.file",
            options: {
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

fluid.defaults("kettle.tests.dataSource.8.file.expand.missing", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "8. Testing file datasource with filesystem with expansion",
    directModel: {
        expand: "nonexistent_file"
    },
    components: {
        dataSource: {
            type: "kettle.dataSource.file",
            options: {
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

fluid.defaults("kettle.tests.dataSource.9.CouchDB.file.expand.missing", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "9. Testing file datasource with filesystem with expansion",
    directModel: {
        expand: "nonexistent_file"
    },
    components: {
        dataSource: {
            type: "kettle.dataSource.file",
            options: {
                gradeNames: "kettle.dataSource.CouchDB",
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

fluid.defaults("kettle.tests.dataSource.10.file.expand.static", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "10. Testing file datasource with filesystem with static expansion",
    components: {
        dataSource: {
            type: "kettle.dataSource.file",
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

fluid.defaults("kettle.tests.dataSource.11.CouchDB.file.expand.static", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "11. Testing couchdb datasource with filesystem with static expansion",
    components: {
        dataSource: {
            type: "kettle.dataSource.file",
            options: {
                gradeNames: "kettle.dataSource.CouchDB",
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

fluid.defaults("kettle.tests.dataSource.12.CouchDB.file.expand.dynamic", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "12. Testing couchdb datasource with filesystem and dynamic expansion",
    directModel: {
        expand: "couchDataSourceTestFile"
    },
    components: {
        dataSource: {
            type: "kettle.dataSource.file",
            options: {
                gradeNames: "kettle.dataSource.CouchDB",
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

fluid.defaults("kettle.tests.dataSource.13.file.set", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "13. Testing file datasource with filesystem - set",
    dataSourceMethod: "set",
    dataSourceModel: {
        test: "test"
    },
    components: {
        dataSource: {
            type: "kettle.dataSource.file",
            options: {
                path: "%kettle/tests/data/writeable/test.json",
                writable: true
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.dataSource.testFileSetResponse",
            args: ["{testEnvironment}.dataSource", null, {
                test: "test"
            }]
        }
    }
});

fluid.defaults("kettle.tests.dataSource.13a.file.JSON5.set", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "13a. Testing file datasource with filesystem - set with JSON5 encoding",
    dataSourceMethod: "set",
    dataSourceModel: {
        test: Infinity
    },
    components: {
        dataSource: {
            type: "kettle.dataSource.file",
            options: {
                path: "%kettle/tests/data/writeable/test.json5",
                writable: true,
                components: {
                    encoding: {
                        type: "kettle.dataSource.encoding.JSON5"
                    }
                }
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.dataSource.testFileSetResponse",
            args: ["{testEnvironment}.dataSource", null, {
                test: Infinity
            }, "JSON5"]
        }
    }
});

fluid.defaults("kettle.tests.dataSource.14.CouchDB.file.set", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "14. Testing CouchDB datasource with filesystem - set",
    dataSourceMethod: "set",
    dataSourceModel: {
        test: "test"
    },
    components: {
        dataSource: {
            type: "kettle.dataSource.file",
            options: {
                gradeNames: "kettle.dataSource.CouchDB",
                notFoundIsEmpty: true,
                path: "%kettle/tests/data/writeable/test.json",
                writable: true
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.dataSource.testFileSetResponse",
            args: ["{testEnvironment}.dataSource", "{testEnvironment}.options.directModel", {
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

fluid.defaults("kettle.tests.dataSource.15.CouchDB.file.set.existing", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "15. Testing CouchDB datasource with filesystem existing document - set",
    dataSourceMethod: "set",
    dataSourceModel: {
        test: "test"
    },
    listeners: {
        onCreate: "kettle.tests.dataSource.supplyWriteableCouchDBFile"
    },
    components: {
        dataSource: {
            type: "kettle.dataSource.file",
            options: {
                gradeNames: "kettle.dataSource.CouchDB",
                notFoundIsEmpty: true,
                path: "%kettle/tests/data/writeable/couchDataSourceTestFile.json",
                writable: true
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.dataSource.testFileSetResponse",
            args: ["{testEnvironment}.dataSource", "{testEnvironment}.options.directModel", {
                value: {
                    test: "test"
                },
                _rev: "test_rev", // With a real Couch/Pouch backend, these would increment
                _id: "test_id"
            }]
        }
    }
});

fluid.defaults("kettle.tests.dataSource.16.file.set.expand", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "16. Testing file datasource with filesystem and expansion - set",
    dataSourceMethod: "set",
    directModel: {
        expand: "test"
    },
    dataSourceModel: {
        test: "test"
    },
    components: {
        dataSource: {
            type: "kettle.dataSource.file",
            options: {
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
            funcName: "kettle.tests.dataSource.testFileSetResponse",
            args: ["{testEnvironment}.dataSource", "{testEnvironment}.options.directModel", {
                test: "test"
            }]
        }
    }
});

fluid.defaults("kettle.tests.dataSource.17.CouchDB.file.set.existing.expand", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "17. Testing couchdb datasource with filesystem, existing document and expansion - set",
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
            type: "kettle.dataSource.file",
            options: {
                gradeNames: "kettle.dataSource.CouchDB",
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
            funcName: "kettle.tests.dataSource.testFileSetResponse",
            args: ["{testEnvironment}.dataSource", "{testEnvironment}.options.directModel", {
                value: {
                    test: "test"
                },
                _rev: "test_rev", // With a real Couch/Pouch backend, these would increment
                _id: "test_id"
            }]
        }
    }
});

fluid.defaults("kettle.tests.dataSource.18.JSON5file.standard", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "18. Testing JSON5 file datasource with standard response",
    components: {
        dataSource: {
            type: "kettle.dataSource.file",
            options: {
                path: "%kettle/tests/data/dataSourceJSON5TestFile.json5",
                components: {
                    encoding: {
                        type: "kettle.dataSource.encoding.JSON5"
                    }
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

fluid.defaults("kettle.tests.dataSource.19.JSON5file.empty", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "19. Testing JSON5 file datasource with empty response",
    components: {
        dataSource: {
            type: "kettle.dataSource.file",
            options: {
                path: "%kettle/tests/data/emptyDataSourceTestFile.txt",
                components: {
                    encoding: {
                        type: "kettle.dataSource.encoding.JSON5"
                    }
                }
            }
        }
    },
    invokers: {
        responseFunc: "kettle.tests.dataSource.testEmptyResponse"
    }
});



kettle.tests.dataSource.standardTests = [
    "kettle.tests.dataSource.1.file.empty",
    "kettle.tests.dataSource.2.file.standard",
    "kettle.tests.dataSource.3.CouchDB.file.standard",
    "kettle.tests.dataSource.4.CouchDB.file.empty",
    "kettle.tests.dataSource.5.CouchDB.file.missing",
    "kettle.tests.dataSource.6.CouchDB.file.error",
    "kettle.tests.dataSource.7.file.expand.present",
    "kettle.tests.dataSource.8.file.expand.missing",
    "kettle.tests.dataSource.9.CouchDB.file.expand.missing",
    "kettle.tests.dataSource.10.file.expand.static",
    "kettle.tests.dataSource.11.CouchDB.file.expand.static",
    "kettle.tests.dataSource.12.CouchDB.file.expand.dynamic",
    "kettle.tests.dataSource.13.file.set",
    "kettle.tests.dataSource.13a.file.JSON5.set",
    "kettle.tests.dataSource.14.CouchDB.file.set",
    "kettle.tests.dataSource.15.CouchDB.file.set.existing",
    "kettle.tests.dataSource.16.file.set.expand",
    "kettle.tests.dataSource.17.CouchDB.file.set.existing.expand",
    "kettle.tests.dataSource.18.JSON5file.standard",
    "kettle.tests.dataSource.19.JSON5file.empty"
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

var tests = kettle.tests.dataSource.standardTests.concat(kettle.tests.dataSource.promisifiedTests);

jqUnit.onAllTestsDone.addListener(function () {
    kettle.tests.dataSource.ensureDirectoryEmpty("%kettle/tests/data/writeable");
});

fluid.test.runTests(tests);
