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
    jqUnit = fluid.require("node-jqunit", require, "jqUnit");

require("./shared/DataSourceTestUtils.js");

kettle.tests.dataSource.ensureWriteableEmpty();

kettle.tests.dataSource.testFileSetResponse = function (dataSource, directModel, expected) {
    var fileName = kettle.dataSource.URL.resolveUrl(dataSource.options.path, dataSource.options.termMap, directModel, true),
        data = JSON.parse(fs.readFileSync(fileName, "utf8"));
    jqUnit.assertDeepEq("Response is correct", expected, data);
    fs.unlink(fileName);
};

fluid.defaults("kettle.tests.dataSource.1.recursiveFile", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "Testing recursive file datasource with result in root folder",
    components: {
        dataSource: {
            type: "kettle.dataSource.recursiveFile.moduleTerms",
            options: {
                filename: "dataSourceTestFile.json"
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

fluid.defaults("kettle.tests.dataSource.2.recursiveFile", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "Testing recursive file datasource with result in root folder and no '/' at the end of path",
    components: {
        dataSource: {
            type: "kettle.dataSource.recursiveFile.moduleTerms",
            options: {
                filename: "dataSourceTestFile.json"
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

fluid.defaults("kettle.tests.dataSource.3.recursiveFile", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "Testing recursive file datasource with result inside subfolder",
    components: {
        dataSource: {
            type: "kettle.dataSource.recursiveFile.moduleTerms",
            options: {
                filename: "nestedFile.json"
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.dataSource.testResponse",
            args: [{
                nestedFile: "works"
            }, "{arguments}.0"]
        }
    }
});

fluid.defaults("kettle.tests.dataSource.4.recursiveFile", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "Testing recursive file datasource with result inside nested subfolder",
    components: {
        dataSource: {
            type: "kettle.dataSource.recursiveFile.moduleTerms",
            options: {
                filename: "doubleNestedFile.json"
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.dataSource.testResponse",
            args: [{
                doubleNestedFile: "works"
            }, "{arguments}.0"]
        }
    }
});

fluid.defaults("kettle.tests.dataSource.5.recursiveFile", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "Recursive file datasource: Non existing file",
    shouldError: true,
    components: {
        dataSource: {
            type: "kettle.dataSource.recursiveFile.moduleTerms",
            options: {
                filename: "Idontexist.json"
            }
        }
    },
    invokers: {
        errorFunc: {
            funcName: "kettle.tests.dataSource.testErrorResponse",
            args: [{
                isError: true,
                message: fluid.module.resolvePath("File Idontexist.json was not found when searching from path " + process.cwd()),
                statusCode: 404
            }, "{arguments}.0"]
        }
    }
});

fluid.defaults("kettle.tests.dataSource.6.recursiveFile", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "Recursive file datasource: folder has same name as file - it wont count as a hit",
    shouldError: true,
    components: {
        dataSource: {
            type: "kettle.dataSource.recursiveFile.moduleTerms",
            options: {
                filename: "nested"
            }
        }
    },
    invokers: {
        errorFunc: {
            funcName: "kettle.tests.dataSource.testErrorResponse",
            args: [{
                isError: true,
                message: fluid.module.resolvePath("File nested was not found when searching from path " + process.cwd()),
                statusCode: 404
            }, "{arguments}.0"]
        }
    }
});

fluid.defaults("kettle.tests.dataSource.7.recursiveFile", {
    gradeNames: ["kettle.tests.simpleDataSourceTest"],
    name: "Recursive file datasource: multiple hits of the same file... Same file is always read",
    components: {
        dataSource: {
            type: "kettle.dataSource.recursiveFile.moduleTerms",
            options: {
                filename: "commonFileName.json"
            }
        }
    },
    invokers: {
        responseFunc: {
            funcName: "kettle.tests.dataSource.testResponse",
            args: [{
                content: "the outer file"
            }, "{arguments}.0"]
        }
    }
});

kettle.tests.dataSource.standardTests = [
    "kettle.tests.dataSource.1.recursiveFile",
    "kettle.tests.dataSource.2.recursiveFile",
    "kettle.tests.dataSource.3.recursiveFile",
    "kettle.tests.dataSource.4.recursiveFile",
    "kettle.tests.dataSource.5.recursiveFile",
    "kettle.tests.dataSource.6.recursiveFile",
    "kettle.tests.dataSource.7.recursiveFile"
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

jqUnit.onAllTestsDone.addListener(kettle.tests.dataSource.ensureWriteableEmpty);

fluid.test.runTests(tests);
