/*
Kettle Config Loader

Copyright 2012-2013 OCAD University
Copyright 2015 Raising the Floor - International

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
    fs = require("fs"),
    kettle = fluid.registerNamespace("kettle");

// A global resolver that can be used to pull raw environment variables from configuration blocks.
fluid.defaults("kettle.resolvers", {
    gradeNames: ["fluid.component", "fluid.resolveRootSingle"],
    singleRootType: "kettle.resolvers",
    members: {
        env:  "@expand:kettle.resolvers.makeEnvResolver()",
        file: "@expand:kettle.resolvers.makeFileResolver()"
    }
});

kettle.resolvers.makeEnvResolver = function () {
    return {
        resolvePathSegment: kettle.resolvers.env
    };
};

kettle.resolvers.env = function (name) {
    return process.env[name];
};

kettle.resolvers.makeFileResolver = function () {
    return {
        resolvePathSegment: kettle.resolvers.file
    };
};

kettle.resolvers.file = function (fileName) {
    if (fileName.charAt(0) === "%") {
        fileName = fluid.module.resolvePath(fileName);
    }
    return fs.readFileSync(fileName, "utf8");
};

fluid.construct("kettle_resolvers", {
    type: "kettle.resolvers"
});
