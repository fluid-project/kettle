/*
Kettle config loader.

Copyright 2012-2013 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/gpii/kettle/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
    path = require("path"),
    kettle = fluid.registerNamespace("kettle");
    
fluid.defaults("kettle.config", {
    gradeNames: ["fluid.component"]
});

/** Returns a suitable environment value {String} by considering, in the following order i) The environment variable
 * NODE_ENV, ii) the supplied argument {String} if any, iii) the final fallback value "development". This value
 * is suitable for appearing as the configName field in the options to <code>kettle.config.createDefaults</code> etc.
 */
kettle.config.getNodeEnv = function (outerDefault) {
    return process.env.NODE_ENV || outerDefault || "development";
};

kettle.config.getConfigPath = function () {
    return fluid.get(process.argv, "2");
};

kettle.config.createDefaultsImpl = function (prefix, filePath) {
    var fullPath;
    if (filePath.charAt(0) === "%") {
        fullPath = kettle.resolveModulePath(filePath);
        prefix = path.dirname(fullPath);
    } else {
        var fileName = path.basename(filePath),
            dirName = path.dirname(filePath);
        prefix = path.resolve(prefix, dirName);
        fullPath = path.resolve(prefix, fileName);
    }
    var configFile;
    var parser = kettle.JSON.readFileSync(fullPath, "reading config file at " + fullPath);
    parser.then(function (parsed) {
        configFile = parsed;
    }, function (rejection) {
        fluid.fail(rejection.message);
    });
    var includes = configFile.includes,
        gradeNames = ["kettle.config"];
    fluid.each(includes, function loadConfigFromPath(importPath) {
        var includedDefaults;
        try {
            includedDefaults = kettle.config.createDefaultsImpl(prefix, importPath);
        } catch (e) {
            e.message += " while loading include for config at path " + fullPath;
            throw(e);
        }
        gradeNames.push(includedDefaults);
    });
    configFile.type = configFile.type || "kettle.config." + fluid.allocateGuid();
    configFile.options = configFile.options || {};
    configFile.options.gradeNames = gradeNames.concat(fluid.makeArray(
        configFile.options.gradeNames));
    fluid.defaults(configFile.type, configFile.options);
    fluid.log("Created defaults for config type " + configFile.type + ": " + fluid.prettyPrintJSON(configFile.options) + " for type ");
    return configFile.type;
};

/** Convert a Kettle "config" as specified by a base path and configName value into a set of component defaults
 * constituting a runnable Kettle application. This will recursively load any "includes" specified in the root
 * config file and merge their configuration into the root config.
 * @param options {Object} Contains fields: configName {String} a value that will be looked up to a "config" file in the supplied
 * directory by appending the <code>.json</code> suffix
 * configPath {String} A fully qualified directory name holding config files, or one prefixed with a ${module} base path reference
 * @return {String} the global name of a Fluid component which can be invoked to instantiate the Kettle application
 */

kettle.config.createDefaults = function (options) {
    return kettle.config.createDefaultsImpl(kettle.resolveModulePath(options.configPath), options.configName + ".json");
};

/** Arguments as for <code>kettle.config.createDefaults</code> only the corresponding Kettle application will be run immediately 
 */
kettle.config.makeConfigLoader = function (options) {
    var componentName = kettle.config.createDefaults(options);
    return fluid.invokeGlobalFunction(componentName);
};

