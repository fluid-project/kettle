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

    var createDefaultsImpl = function (prefix, filePath) {
        var fileName = path.basename(filePath),
            filePathPrefix = filePath.slice(0, filePath.indexOf(fileName));
        prefix = path.resolve(prefix, filePathPrefix);
        var fullPath = path.resolve(prefix, fileName),
            configFile = JSON.parse(fs.readFileSync(fullPath)),
            includes = configFile.includes,
            gradeNames = [];
        kettle.config.loadModules(configFile.modules, prefix);
        fluid.each(includes, function loadConfigFromPath(importPath) {
            gradeNames.push(createDefaultsImpl(prefix, importPath));
        });
        configFile.options = configFile.options || {};
        configFile.options.gradeNames = configFile.options.gradeNames || [];
        configFile.options.gradeNames = configFile.options.gradeNames.concat(
            gradeNames);
        fluid.defaults(configFile.typeName, configFile.options);
        return configFile.typeName;
    };

    kettle.config.createDefaults = function (options) {
        return createDefaultsImpl(options.configPath,
            fluid.path(options.nodeEnv, "json"));
    };

    kettle.config.makeConfigLoader = function (options) {
        var componentName = kettle.config.createDefaults(options);
        return fluid.invokeGlobalFunction(componentName);
    };

})();
