/*
Kettle config loader.

Copyright 2012-2013 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/gpii/kettle/LICENSE.txt
*/

(function () {

    "use strict";

    var fluid = require("infusion"),
        fs = require("fs"),
        path = require("path"),
        kettle = fluid.registerNamespace("kettle");

    fluid.registerNamespace("kettle.config");

    kettle.config.getNodeEnv = function (outerDefault) {
        return process.env.NODE_ENV || outerDefault || "development";
    };

    kettle.config.getConfigPath = function () {
        return fluid.get(process.argv, "2");
    };

    kettle.config.mergeDemands = function (target, source) {
        target = fluid.makeArray(target);
        source = fluid.makeArray(source);
        return target.concat(source);
    };

    kettle.config.loadModules = function (modules, prefix) {
        if (!modules || modules.length < 1) {
            return;
        }
        var moduleLoaderFullPath = path.resolve(prefix, "kettleModuleLoader.js");
        var moduleLoader;
        try {
            moduleLoader = require(moduleLoaderFullPath);
        } catch (x) {
            fluid.log("No module loader at path " + moduleLoaderFullPath + " found.");
            return;
        }
        fluid.each(modules, function loadModule(module) {
            fluid.require(module, moduleLoader);
        });
    };

    var loadConfigImpl = function (config, prefix, filePath) {
        var fileName = path.basename(filePath),
            filePathPrefix = filePath.slice(0, filePath.indexOf(fileName));
        prefix = path.resolve(prefix, filePathPrefix);
        var fullPath = path.resolve(prefix, fileName),
            configFile = JSON.parse(fs.readFileSync(fullPath)),
            includes = configFile.includes;
        kettle.config.loadModules(configFile.modules, prefix);
        fluid.each(includes, function loadConfigFromPath(importPath) {
            config = loadConfigImpl(config, prefix, importPath);
        });
        config = fluid.merge({
            demands: kettle.config.mergeDemands
        }, config, {
            typeName: configFile.typeName,
            options: configFile.options,
            demands: configFile.demands
        });
        return config;
    };

    kettle.config.loadAllConfigs = function (options) {
        var config = loadConfigImpl({}, options.configPath,
            fluid.path(options.nodeEnv, "json"));
        return config;
    };

    kettle.config.createDefaults = function (options) {
        var config = kettle.config.loadAllConfigs(options),
            componentName = config.typeName,
            demands = config.demands;
        fluid.each(demands, function generateDemandsBlock(demand) {
            fluid.demands(demand.demandingName, demand.contextNames,
                demand.demandSpec);
        });
        fluid.defaults(componentName, config.options);
        return componentName;
    };

    kettle.config.makeConfigLoader = function (options) {
        var componentName = kettle.config.createDefaults(options);
        return fluid.invokeGlobalFunction(componentName);
    };

})();
