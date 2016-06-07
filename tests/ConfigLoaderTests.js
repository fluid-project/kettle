/**
 * Kettle Config Loader Tests
 *
 * Copyright 2013 OCAD University
 * Copyright 2012-2015 Raising the Floor - International
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    kettle = require("../kettle.js"), // TODO: New module loader
    jqUnit = fluid.require("node-jqunit", require, "jqUnit");

kettle.loadTestingSupport();

fluid.defaults("kettle.tests.subcomponent1", {
    gradeNames: ["fluid.component"],
    option: "ORIGINAL"
});

fluid.defaults("kettle.tests.subcomponent2", {
    gradeNames: ["fluid.modelComponent"]
});

fluid.defaults("kettle.tests.subcomponent3", {
    gradeNames: ["fluid.component"],
    option: "OVERRIDE"
});

var expectedDefaults = {
    config1: {
        gradeNames: ["fluid.modelComponent", "config3", "kettle.config", "config4", "config2", "fluid.component", "config1"],
        components: {
            subcomponent1: {
                type: "kettle.tests.subcomponent1",
                options: {
                    gradeNames: ["kettle.tests.subcomponent3"]
                }
            }
        },
        option1: "OPTION1",
        option2: "OPTION2",
        option3: "OPTION3"
    },
    config2: {
        gradeNames: ["kettle.config", "config4", "fluid.component", "config2"],
        components: {
            subcomponent1: {
                type: "kettle.tests.subcomponent1",
                options: {
                    gradeNames: ["kettle.tests.subcomponent3"]
                }
            }
        },
        option2: "OPTION2"
    },
    config3: {
        gradeNames: ["kettle.config", "fluid.component", "fluid.modelComponent","config3"],
        components: {
            subcomponent1: {
                options: {
                    gradeNames: ["kettle.tests.subcomponent2"]
                }
            }
        },
        option3: "OPTION3"
    },
    config4: {
        gradeNames: ["fluid.component", "kettle.config", "config4"],
        components: {
            subcomponent1: {
                options: {
                    gradeNames: ["kettle.tests.subcomponent3"]
                }
            }
        }
    },
    config5: { // never becomes a top-level config and so does not acquire the kettle.config grade
        gradeNames: ["config5", "config6", "fluid.component"],
        option6: "OPTION6"
    },
    config6: {
        gradeNames: ["kettle.config", "fluid.component", "config6"],
        option6: "OPTION6"
    }
};

var expectedSubcomponentOptions = {
    gradeNames: ["kettle.tests.subcomponent1", "fluid.component", "kettle.tests.subcomponent3"],
    option: "OVERRIDE"
};

kettle.tests.testConfigToGrade = function (headName, configNames) {
    var componentName = kettle.config.createDefaults({
        configName: configNames[0],
        configPath: "%kettle/tests/configs"
    });
    var expectedParents = fluid.copy(configNames);

    if (headName) {
        jqUnit.assertEquals("Head component name is correct", headName, componentName);
    } else {
        jqUnit.assertTrue("Head component is named a nonce grade", componentName.indexOf("kettle.config.") === 0);
        expectedParents.shift(); // white box testing - in this case the system won't need to allocate a dedicated grade
    }
    jqUnit.assertValue("Head component defaults are allocated", fluid.defaults(componentName));

    fluid.each(expectedParents, function (configOrTypeName) {
        var defaults = fluid.defaults(configOrTypeName);
        jqUnit.assertValue("Grade is created for config " + configOrTypeName, defaults);
        jqUnit.assertLeftHand("Config " + configOrTypeName +
            " is correctly converted into a grade",
            expectedDefaults[configOrTypeName], defaults);
    });
};

jqUnit.test("Load config defaults with types", function () {
    jqUnit.expect(14);
    kettle.tests.testConfigToGrade("config1", ["config1", "config2", "config3", "config4"]);
    var config1 = fluid.invokeGlobalFunction("config1");
    jqUnit.assertLeftHand("Subcomponent options are correct",
        expectedSubcomponentOptions, config1.subcomponent1.options);
    jqUnit.assertValue("Module-based require has executed from config4", kettle.tests.testModule);
    jqUnit.assertValue("Bare file require has executed from config3", kettle.tests.testBareRequire);
    jqUnit.assertValue("Module-relative require has executed from config2", kettle.tests.testModuleRelativeRequire);
});

jqUnit.test("Load config defaults without type", function () {
    jqUnit.expect(4);
    kettle.tests.testConfigToGrade(null, ["config5", "config6"]);
});

jqUnit.test("Load config with \"loadConfig\" directive", function () {
    var that = kettle.config.loadConfig({
        configName: "kettle.tests.loadConfig.config",
        configPath: "%kettle/tests/configs"
    });
    jqUnit.assertTrue("Subcomponent has sub grade", fluid.componentHasGrade(that.subConfig, "kettle.tests.loadConfig.sub.config"));
    jqUnit.assertFalse("Top config does not have sub grade", fluid.componentHasGrade(that, "kettle.tests.loadConfig.sub.config"));
});
