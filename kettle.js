/*
Kettle.

Copyright 2012-2013 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/gpii/kettle/LICENSE.txt
*/

var fluid = require("infusion"),
    kettle = fluid.registerNamespace("kettle");

require("./lib/KettleUtils.js");

fluid.module.register("kettle", __dirname, require);

require("./lib/dataSource.js");
require("./lib/KettleApp.js");
require("./lib/KettleConfigLoader.js");
require("./lib/KettleMiddleware.js");
require("./lib/KettleRouter.js");
require("./lib/KettleRequest.js");
require("./lib/KettleRequest.ws.js");
require("./lib/KettleServer.js");
require("./lib/KettleServer.ws.js");
require("./lib/KettleSession.js");

kettle.loadTestingSupport = function () {
    require("./lib/test/KettleTestUtils.js");
    require("./lib/test/KettleTestUtils.http.js");
    require("./lib/test/KettleTestUtils.ws.js");
};

module.exports = kettle;
