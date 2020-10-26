/**
 * Kettle Session Support Tests
 *
 * Copyright 2013 OCAD University
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/kettle/blob/main/LICENSE.txt
 */

"use strict";

var kettle = require("../kettle.js");

require("./shared/SessionTestDefs.js");

kettle.test.bootstrapServer(kettle.tests.session.testDefs);
