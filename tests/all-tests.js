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
    "./KettleUtilsTests.js",
    "./InitTests.js",
    "./DataSourceJSONTests.js",
    "./DataSourceJSON5Tests.js",
    "./DataSourceFileTests.js",
    "./DataSourceURLTests.js",
    "./DataSourceSimpleTests.js",
    "./CrossServerRequestTests.js",
    "./HTTPMethodsTests.js",
    "./CORSTests.js",
    "./ResolverTests.js",
    "./SessionTests.js",
    "./ConfigLoaderTests.js",
    "./WebSocketsTests.js",
    "./SessionWebSocketsTests.js",
    "./ErrorTests.js",
    "./BadConfigTests.js",
    "./BadRequestTests.js",
    "./GoodRequestTests.js",
    "./MultiConfigTests.js",
    "./StaticTests.js",
    "./MulterTests.js",
    "./AsyncRequestComponentTests.js",
    "./RequestAbortTests.js"
];

fluid.each(testIncludes, function (path) {
    require(path);
});
