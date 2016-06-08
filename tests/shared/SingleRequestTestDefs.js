/**
 * Kettle Single Request Tests common definitions
 *
 * Copyright 2016 Raising The Floor - International
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    kettle = fluid.require("%kettle");

kettle.loadTestingSupport();

// A template server config for all "single request" tests
// TODO: this should never work if the server constructs asynchronously - need to merge with
// kettle.test.serverEnvironment infrastructure
fluid.defaults("kettle.tests.singleRequest.config", {
    gradeNames: "fluid.component",
    components: {
        server: {
            type: "kettle.server",
            options: {
                port: 8081,
                components: {
                    app: {
                        type: "kettle.app",
                        options: {
                            requestHandlers: {
                                testHandler: {
                                    type: "kettle.request.http",
                                    route: "/",
                                    method: "get"
                                }
                            }
                        }
                    }
                }
            }
        }
    }
});

/** Merge the config testDefs, generate their grades derived from "kettle.tests.singleRequest.config" and execute them **/

/**
 * @param testDefs {Array of String} An array of the grade names holding "hollow grades" to be merged into full fixtures
 * @param testDefTemplateGrade {String} The grade holding the "test def template" including the actual test sequence and assertion defaults to be merged into the hollow grades
 * @param errorExpect {Boolean} `true` If the `expect` count for the fixtures is to be derived based on the `errorTexts` option.
 */

kettle.tests.singleRequest.executeTests = function (testDefs, testDefTemplateGrade, errorExpect) {
    fluid.each(testDefs, function (testDefGrade) {
        var testDefDefaults = fluid.defaults(testDefGrade);
        var mergedConfigName = testDefGrade + ".mergedConfig";
        fluid.defaults(mergedConfigName, {
            gradeNames: "kettle.tests.singleRequest.config",
            distributeOptions: {
                target: "{that kettle.app}.options.requestHandlers.testHandler",
                record: testDefDefaults.handler
            }
        });
        var mergedTestDefName = testDefGrade + ".mergedTestDef";
        fluid.defaults(mergedTestDefName, {
            gradeNames: [testDefTemplateGrade, testDefGrade]
        });
        var fullTestDef = fluid.copy(fluid.defaults(mergedTestDefName));
        fullTestDef.configType = mergedConfigName;
        if (errorExpect) {
            fullTestDef.expect = 2 + fluid.makeArray(fullTestDef.errorTexts).length;
        } else {
            fullTestDef.expect = 2;
        }
        kettle.test.bootstrapServer(fullTestDef);
    });
};
