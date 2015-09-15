/**
 * Kettle Test Utilities
 * 
 * Contains base utilities for node.js based tests in Kettle
 *
 * Copyright 2013-2015 Raising the Floor (International)
 * Copyright 2013 OCAD University
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/gpii/universal/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    kettle = fluid.registerNamespace("kettle"),
    fs = require("fs"),
    QUnit = fluid.registerNamespace("QUnit");

fluid.require("ws", require, "kettle.npm.ws");

fluid.registerNamespace("kettle.test");

// Register an uncaught exception handler that will cause any active test fixture to unconditionally fail

kettle.test.handleUncaughtException = function (err) {
    console.log("!!!!JQKK ", err);
    if (QUnit.config.current) {
        QUnit.ok(false, "Unexpected failure in test case (see following log for more details): " + err.message);
    } else {
        process.exit(1);
    }
};

fluid.onUncaughtException.addListener(kettle.test.handleUncaughtException, "fail",
    fluid.handlerPriorities.uncaughtException.fail);

/*
 * Some low-quality synchronous file utilities, suitable for use in test fixtures
 */
    
// Utility to recursively delete a directory and its contents from http://www.geedew.com/2012/10/24/remove-a-directory-that-is-not-empty-in-nodejs/
// Useful for cleaning up before and after test cases

kettle.test.deleteFolderRecursive = function (path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file) {
            var curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) {
                kettle.test.deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

kettle.test.copyFileSync = function (sourceFile, targetFile) {
    fs.writeFileSync(targetFile, fs.readFileSync(sourceFile));
};

// Two utilities which aid working with "sequences" in IoC testing fixtures

// returns subarray including only elements between start and end (non-inclusive)
kettle.test.elementsBetween = function (origArray, start, end) {
    var array = fluid.makeArray(origArray);
    start = start || 0;
    if (!end && end !== 0) {
        end = array.length;
    }
    array.length = end;
    array.splice(0, start);
    return array;
};

// insert the supplied elements into the array at position index (DESTRUCTIVE)
kettle.test.insertIntoArray = function (origArray, index, elements) {
    var spliceArgs = [index || 0, 0].concat(elements);
    origArray.splice.apply(origArray, spliceArgs);
};
