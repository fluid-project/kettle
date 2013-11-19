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
    configPath = path.resolve(__dirname, "./configs"),
    nodeEnv = "config1";

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
    }
};

var expectedSubcomponentOptions = {
    gradeNames: ["kettle.tests.subcomponent3", "fluid.littleComponent",
        "kettle.tests.subcomponent1", "autoInit"],
    option: "OVERRIDE"
};

kettle.tests.testCreateDefaults = function () {
    var componentName = kettle.config.createDefaults({
        nodeEnv: nodeEnv,
        configPath: configPath
    }),
        defaults = {};
    jqUnit.assertEquals("Head component name is correct: ", nodeEnv,
        componentName);
    fluid.each(["config1", "config2", "config3", "config4"], function (name) {
        defaults[name] = fluid.defaults(name);
        jqUnit.assertValue("Grade is created for config " + name,
            defaults[name]);
        jqUnit.assertLeftHand("Config " + name +
            " is correctly converted into a grade", expectedDefaults[name],
            defaults[name]);
    });
    var config1 = fluid.invokeGlobalFunction("config1");
    jqUnit.assertLeftHand("Subcomponent options are correct",
        expectedSubcomponentOptions, config1.subcomponent1.options);
};

fluid.defaults("kettle.tests.configLoaderTester", {
    gradeNames: ["fluid.test.testCaseHolder", "autoInit"],
    modules: [{
        name: "Config Loader",
        tests: [{
            expect: 10,
            name: "kettle.config.createDefaults",
            func: "kettle.tests.testCreateDefaults"
        }]
    }]
});

if (kettle.tests.allTests) {
    module.exports = "kettle.tests.configLoader";
} else {
    fluid.test.runTests(["kettle.tests.configLoader"]);
}
