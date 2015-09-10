/*
Kettle Data Source Tests

Copyright 2012-2015 Raising the Floor - International

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/GPII/kettle/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
     kettle = require("../kettle.js"),
     fs = require("fs");
 
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
