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
    kettle = fluid.require("%kettle"),
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

kettle.tests.expectedDefaultsOld = {
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

// The post FLUID-6148 framework performs options merging differently. Not only are subcomponent options broken out
// into an array, we also have a fix for FLUID-5614 so there is an actual change of meaning - e.g. in config1,
// subcomponent1 acquires grades for both subcomponent2 and subcomponent3

kettle.tests.expectedDefaultsNew = {
    config1: {
        gradeNames: ["fluid.modelComponent", "config3", "kettle.config", "config4", "config2", "fluid.component", "config1"],
        components: {
            subcomponent1: {
                type: "kettle.tests.subcomponent1",
                options: {
                    gradeNames: ["kettle.tests.subcomponent2", "kettle.tests.subcomponent3"]
                }
            }
        },
        option1: "OPTION1",
        option2: "OPTION2",
        option3: "OPTION3"
    }
};

kettle.tests.expectedSubcomponentOptionsOld = {
    gradeNames: ["kettle.tests.subcomponent1", "fluid.component", "kettle.tests.subcomponent3"],
    option: "OVERRIDE"
};

// The post-6148 framework is very different here. All contributed subcomponent grades, including through the hierarchy,
// are accumulated
kettle.tests.expectedSubcomponentOptionsNew = {
    gradeNames: [
        "kettle.tests.subcomponent1",
        "fluid.modelComponent",
        "kettle.tests.subcomponent2",
        "fluid.component",
        "kettle.tests.subcomponent3"
    ],
    option: "OVERRIDE"
};

kettle.tests.flattenSubcomponentsImpl = function (options) {
    var togo = fluid.copy(options);
    fluid.each(togo.components, function (options, key) {
        var type, gradeNames = [];
        options.forEach(function (oneOptions) {
            type = type || oneOptions.type;
            gradeNames = gradeNames.concat(fluid.makeArray(fluid.get(oneOptions, ["options", "gradeNames"])));
        });
        var record = {
            options: {
                gradeNames: gradeNames
            }
        };
        if (type) {
            record.type = type;
        }
        togo.components[key] = record;
    });
    return togo;
};

kettle.tests.flattenSubcomponents = fluid.registerPotentia ? kettle.tests.flattenSubcomponentsImpl : fluid.identity;

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
    var expectedDefaults = fluid.registerPotentia ? fluid.extend({}, kettle.tests.expectedDefaultsOld, kettle.tests.expectedDefaultsNew)
        : kettle.test.expectedDefaultsOld;

    fluid.each(expectedParents, function (configOrTypeName) {
        var defaults = kettle.tests.flattenSubcomponents(fluid.defaults(configOrTypeName));
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
    var expectedSubcomponentOptions = fluid.registerPotentia ?
        kettle.tests.expectedSubcomponentOptionsNew : kettle.tests.expectedSubcomponentOptionsOld;
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

kettle.tests.parseArgsFixtures = [{
    argv: ["node.exe", "thing.js", "--extra"],
    expected: 1
}, {
    argv: ["node.exe", "--inspect-brk", "thing.js"],
    expected: 2
}, {
    argv: ["node.exe", "--inspect-brk", "-e", "thing.js", "--extra"],
    expected: 3
}, {
    argv: ["node.exe", "-first", "-second", "-third"],
    expected: 4
}];

jqUnit.test("Test parsing command line arguments", function () {
    kettle.tests.parseArgsFixtures.forEach(function (record, index) {
        var result = kettle.config.CLI.findScriptArgument(record.argv);
        jqUnit.assertEquals("Expected position of script argument index " + index, record.expected, result);
    });
});
