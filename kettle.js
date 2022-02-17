/*
Kettle Main Module Loader

Copyright 2012-2018 OCAD University
Copyright 2015 Raising the Floor (International)

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/main/LICENSE.txt
*/
"use strict";
var fluid = require("infusion"),
    kettle = fluid.registerNamespace("kettle");

require("./lib/KettleUtils.js");

fluid.module.register("kettle", __dirname, require);

require("./lib/dataSource-core.js");
require("./lib/dataSource-file.js");
require("./lib/dataSource-recursiveFile.js");
require("./lib/dataSource-url.js");
require("./lib/KettleApp.js");
require("./lib/KettleConfigLoader.js");
require("./lib/KettleResolvers.js");
require("./lib/KettleMiddleware.js");
require("./lib/KettleMiddleware-Multer.js");
require("./lib/KettleMultiConfig.js");
require("./lib/KettleRouter.js");
require("./lib/KettleRequest.js");
require("./lib/KettleRequest.ws.js");
require("./lib/KettleServer.js");
require("./lib/KettleServer.ws.js");
require("./lib/KettleSession.js");

kettle.loadTestingSupport = function () {
    require("./lib/test/KettleTestUtils.js");
    require("./lib/test/KettleTestUtils.http.js");
    require("./lib/test/KettleTestUtils.form.js");
    require("./lib/test/KettleTestUtils.ws.js");
};

// A variant of loadTestingSupport that does not complain if no tests are queued - for examples and samples
/* istanbul ignore next */
kettle.loadTestingSupportQuiet = function () {
    kettle.loadTestingSupport();
    var jqUnit = fluid.registerNamespace("jqUnit");
    jqUnit.allTestsDone = fluid.identity;
};

module.exports = kettle;
