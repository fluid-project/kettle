/*
Kettle Data Source Test Utilities

Copyright 2012-2015 Raising the Floor - International

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/GPII/kettle/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
     kettle = require("../../kettle.js"),
     fs = require("fs");
 
kettle.loadTestingSupport();

fluid.registerNamespace("kettle.tests.dataSource");

// reinitialise the "writeable" directory area used by tests which issue dataSource writes,
// the start of every test run
kettle.tests.dataSource.ensureWriteableEmpty = function () {
    var writeableDir = fluid.module.resolvePath("${kettle}/tests/data/writeable");
    kettle.test.deleteFolderRecursive(writeableDir);
    fs.mkdirSync(writeableDir);
};


// distribute down a standard error handler for any nested dataSource

fluid.defaults("kettle.tests.fileRootedDataSource", {
    gradeNames: ["fluid.component"],
    distributeOptions: {
        onError: {
            record: {
                namespace: "testEnvironment",
                func: "{testEnvironment}.events.onError.fire",
                args: "{arguments}.0"
            },
            target: "{that dataSource}.options.listeners.onError"
        },
        moduleTerms: {
            record: kettle.module.terms,
            target: "{that dataSource}.options.termMap"
        }
    }
});
