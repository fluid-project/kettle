/**
 * Kettle Config Loader Tests
 *
 * Copyright 2012 Raising the Floor - International
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/GPII/kettle/LICENSE.txt
 */

/*global require, __dirname*/

var fluid = require("infusion"),
    path = require("path"),
    kettle = fluid.require(path.resolve(__dirname, "../kettle.js"));
    fs = require("fs"),
    jqUnit = fluid.require("jqUnit"),
    configPath = path.resolve(__dirname, "./configs");

fluid.require(path.resolve(__dirname, "./utils/js/KettleTestUtils.js"));

fluid.defaults("kettle.tests.configLoader", {
    gradeNames: ["fluid.test.testEnvironment", "autoInit"],
    components: {
        configLoaderTester: {
            type: "kettle.tests.configLoaderTester"
        }
    }
});

fluid.defaults("kettle.tests.subcomponent1", {
    gradeNames: ["autoInit", "fluid.littleComponent"],
    option: "ORIGINAL"
});

fluid.defaults("kettle.tests.subcomponent2", {
    gradeNames: ["autoInit", "fluid.modelComponent"]
});

fluid.defaults("kettle.tests.subcomponent3", {
    gradeNames: ["autoInit", "fluid.littleComponent"],
    option: "OVERRIDE"
});

var expectedDefaults = {
    config1: {
        gradeNames: ["config1", "fluid.littleComponent", "config2",
            "fluid.eventedComponent", "config4", "config3",
            "fluid.modelComponent", "autoInit"],
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
        gradeNames: ["config2", "fluid.eventedComponent",
            "fluid.littleComponent", "config4"],
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
        gradeNames: ["config3", "fluid.modelComponent", "fluid.littleComponent"],
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
        gradeNames: ["config4"],
        components: {
            subcomponent1: {
                options: {
                    gradeNames: ["kettle.tests.subcomponent3"]
                }
            }
        }
    },
    config5: {
        gradeNames: ["config5", "config6", "fluid.littleComponent"],
        option6: "OPTION6"
    },
    config6: {
        gradeNames: ["config6", "fluid.littleComponent", "autoInit"],
        option6: "OPTION6"
    }
};

var expectedSubcomponentOptions = {
    gradeNames: ["kettle.tests.subcomponent3", "fluid.littleComponent",
        "kettle.tests.subcomponent1", "autoInit"],
    option: "OVERRIDE"
};

function testConfigToGrade () {
    var head = arguments[0],
        componentName = kettle.config.createDefaults({
            nodeEnv: head,
            configPath: configPath
        });

    jqUnit.assertEquals("Head component name is correct: ", head,
        componentName);
    fluid.each(arguments, function (configOrTypeName) {
        var defaults = fluid.defaults(configOrTypeName);
        jqUnit.assertValue("Grade is created for config " + configOrTypeName,
            defaults);
        jqUnit.assertLeftHand("Config " + configOrTypeName +
            " is correctly converted into a grade",
            expectedDefaults[configOrTypeName], defaults);
    });
};

kettle.tests.testCreateDefaults = function () {
    testConfigToGrade("config1", "config2", "config3", "config4");
    var config1 = fluid.invokeGlobalFunction("config1");
    jqUnit.assertLeftHand("Subcomponent options are correct",
        expectedSubcomponentOptions, config1.subcomponent1.options);
};

kettle.tests.testCreateNoTypeNameDefaults = function () {
    testConfigToGrade("config5", "config6");
};

fluid.defaults("kettle.tests.configLoaderTester", {
    gradeNames: ["fluid.test.testCaseHolder", "autoInit"],
    modules: [{
        name: "Config Loader",
        tests: [{
            expect: 10,
            name: "kettle.config.createDefaults",
            func: "kettle.tests.testCreateDefaults"
        }, {
            expect: 5,
            name: "kettle.config.createDefaults no typeName",
            func: "kettle.tests.testCreateNoTypeNameDefaults"
        }]
    }]
});

if (kettle.tests.allTests) {
    module.exports = "kettle.tests.configLoader";
} else {
    fluid.test.runTests(["kettle.tests.configLoader"]);
}
