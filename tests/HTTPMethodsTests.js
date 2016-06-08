/**
 * Kettle HTTP Methods Tests
 *
 * Copyright 2014-2015 Raising The Floor - International
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
 */

"use strict";

var kettle = require("../kettle.js");

require("./shared/HTTPMethodsTestDefs.js");

kettle.test.bootstrapServer(kettle.tests.HTTPMethods.testDefs);
