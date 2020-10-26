/*
Kettle Multi-Configuration support

Copyright 2015 OCAD University
Copyright 2015 Raising the Floor - International

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/main/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
    kettle = fluid.registerNamespace("kettle");

fluid.defaults("kettle.multiConfig.config", {
    gradeNames: ["fluid.component", "{that}.buildMultiKettleConfig"],
    invokers: {
        buildMultiKettleConfig: {
            funcName: "kettle.multiConfig.build",
            args: "{that}.options.configs"
        }
    }
});

kettle.multiConfig.template = {
    components: {
        server: {
            type: "fluid.component",
            options: {
                components: null, // To be filled in
                events: {
                    onListen: {
                        events: null // To be filled in
                    },
                    onStopped: {
                        events: null // To be filled in
                    }
                },
                invokers: {
                    stop: {
                        funcName: "kettle.multiConfig.stopServers",
                        args: null // To be filled in
                    }
                }
            }
        }
    }
};

kettle.multiConfig.build = function (servers) {
    // Build multi-server config parts
    var components = {};
    var onListenEvents = {};
    var onStoppedEvents = {};
    var serverPaths = [];
    fluid.each(servers, function (server, configKey) {
        components[configKey] = kettle.multiConfig.buildComponentForConfig(server.configName, server.configPath);
        onListenEvents["onListen" + configKey] = "{" + configKey + "}.server.events.onListen";
        onStoppedEvents["onStopped" + configKey] = "{" + configKey + "}.server.events.onStopped";
        serverPaths.push("{" + configKey + "}.server");
    });

    // Make new grade
    var newGradeDef = fluid.copy(kettle.multiConfig.template);
    fluid.set(newGradeDef, "components.server.options.components", components);
    fluid.set(newGradeDef, "components.server.options.events.onListen.events", onListenEvents);
    fluid.set(newGradeDef, "components.server.options.events.onStopped.events", onStoppedEvents);
    fluid.set(newGradeDef, "components.server.options.invokers.stop.args", [serverPaths]);

    var newGradeName = "kettle.multiConfig.config." + fluid.allocateGuid();
    fluid.defaults(newGradeName, newGradeDef);

    return newGradeName;
};

kettle.multiConfig.buildComponentForConfig = function (configName, configPath) {
    var type = kettle.config.createDefaults({
        configName: configName,
        configPath: configPath
    });
    return {
        type: type
    };
};

kettle.multiConfig.stopServers = function (servers) {
    fluid.each(servers, function (server) {
        server.stop();
    });
};
