/**
 * Kettle Static Request Handler Tests
 *
 * Copyright 2019 Raising The Floor - International
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    kettle = require("../kettle.js"),
    JSON5 = require("json5"),
    jqUnit = fluid.registerNamespace("jqUnit");

kettle.loadTestingSupport();

require("./shared/SingleRequestTestDefs.js");

fluid.registerNamespace("kettle.tests.staticHandler");

fluid.defaults("kettle.tests.staticHandler.server", {
    gradeNames: "kettle.server",
    port: 8081,
    components: {
        app: {
            type: "kettle.tests.staticHandler.app"
        }
    }
});

fluid.defaults("kettle.tests.staticHandler.app", {
    gradeNames: "kettle.app",
    components: {
        infusionStaticHandler: {
            type: "kettle.staticRequestHandlers.static",
            options: {
                root: "%infusion",
                prefix: "/infusion"
            }
        },
        kettleStaticHandler: {
            type: "kettle.staticRequestHandlers.static",
            options: {
                root: "%kettle/tests/configs",
                prefix: "/kettleConfigs"
            }
        },
        overrideHandler: {
            type: "kettle.staticRequestHandlers.static",
            options: {
                root: "%kettle/tests/data/static",
                prefix: "/kettleConfigs",
                priority: "before:kettleStaticHandler"
            }
        }
    }
});


fluid.defaults("kettle.tests.staticHandler.environment", {
    gradeNames: ["fluid.test.testEnvironment", "fluid.test.testCaseHolder"],
    components: {
        server: {
            type: "kettle.tests.staticHandler.server"
        }
    },
    modules: [{
        name: "Test staticHandler with static middleware",
        tests: [{
            expect: 4,
            name: "Test staticHandler with static middleware",
            sequenceGrade: "kettle.tests.staticHandler.sequence"
        }]
    }]
});

fluid.defaults("kettle.tests.staticHandler.oneRequest", {
    gradeNames: "fluid.test.sequenceElement",
    components: {
        testRequest: {
            type: "kettle.test.request.http",
            options: {
                path: "{sequenceElement}.options.path",
                method: "GET"
            }
        }
    },
    invokers: {
        checkResponse: null
    },
    sequence: [{
        task: "{sequenceElement}.testRequest.send",
        resolve: "{sequenceElement}.checkResponse"
    }]
});

kettle.tests.staticHandler.checkInfusionPackage = function (data) {
    var pkg = JSON.parse(data);
    jqUnit.assertTrue("Should have received JSON response", fluid.isPlainObject(pkg));
    jqUnit.assertEquals("Should have received package.json for Infusion", "infusion", pkg.name);
};

kettle.tests.staticHandler.checkOverride = function (data) {
    var config = JSON5.parse(data);
    jqUnit.assertTrue("Should have received JSON5 response", fluid.isPlainObject(config));
    jqUnit.assertDeepEq("Should have received overridden response", {overridden: true}, config);
};

fluid.defaults("kettle.tests.staticHandler.sequence", {
    gradeNames: "fluid.test.sequence",
    // TODO: We really need a core mergePolicy on sequenceElements
    sequenceElements: {
        checkSimple: {
            gradeNames: "kettle.tests.staticHandler.oneRequest",
            options: {
                path: "/infusion/package.json",
                invokers: {
                    checkResponse: {
                        funcName: "kettle.tests.staticHandler.checkInfusionPackage"
                    }
                }
            }
        },
        checkOverride: {
            gradeNames: "kettle.tests.staticHandler.oneRequest",
            options: {
                path: "/kettleConfigs/config1.json5",
                invokers: {
                    checkResponse: {
                        funcName: "kettle.tests.staticHandler.checkOverride"
                    }
                }
            }
        }
    }
});

fluid.test.runTests(["kettle.tests.staticHandler.environment"]);
