/*
Kettle Resolvers

Copyright 2017 Raising the Floor - International

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
    fs = require("fs"),
    kettle = fluid.registerNamespace("kettle");

fluid.registerNamespace("kettle.resolvers");

kettle.resolvers.env = function (name) {
    return process.env[name];
};

kettle.resolvers.file = function (fileName) {
    if (fileName.charAt(0) === "%") {
        fileName = fluid.module.resolvePath(fileName);
    }
    return fs.readFileSync(fileName, "utf8");
};

kettle.resolvers.args = function (index) {
    return index === undefined ? process.argv : process.argv[index];
};

// We plan for these to be mockable via a FLUID-6157 approach
