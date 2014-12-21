/**
 * Kettle Tests
 *
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
    kettle = require("../kettle.js");

kettle.loadTestingSupport();

var testIncludes = [
    "./InitTests.js",
    "./DataSourceTests.js",
    "./CrossServerRequestTests.js",
    "./HTTPMethodsTests.js",
    "./MiddlewareTests.js",
    "./SessionTests.js",
    "./ConfigLoaderTests.js",
    "./SocketTests.js",
    "./ErrorTests.js"
];

fluid.each(testIncludes, function (path) {
    require(path);
});
