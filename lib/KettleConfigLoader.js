/*
Kettle Config Loader

Copyright 2012-2013 OCAD University
Copyright 2015 Raising the Floor - International

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
    path = require("path"),
    resolve = require("resolve"),
    kettle = fluid.registerNamespace("kettle");

fluid.defaults("kettle.config", {
    gradeNames: ["fluid.component"]
});

/** Returns a suitable environment value {String} by considering, in the following order
 * i) the 3rd command line argument, ii) The environment variable
 * NODE_ENV, iii) the supplied argument {String} if any, This value
 * is suitable for appearing as the configName field in the options to <code>kettle.config.createDefaults</code> etc.
 */
kettle.config.getConfigName = function (outerDefault) {
    var nodeEnv = process.argv[3] || process.env.NODE_ENV || outerDefault;
    if (nodeEnv) {
        fluid.log("Loader running configuration name " + nodeEnv);
    } else {
        fluid.fail("No configuration specified in either 1st command line argument, NODE_ENV or internal default");
    }
    return nodeEnv;
};

/** Returns a suitable config base path {String} by considering, in the following order
 * i) the 2nd command line argument (if it is nonempty and not the string "-") , ii) the supplied argument {String} if any. This value
 * is suitable for appearing as the configPath field in the options to <code>kettle.config.createDefaults</code> etc.
 */

kettle.config.getConfigPath = function (outerDefault) {
    var arg2 = process.argv[2];
    if (arg2 === "-") {
        arg2 = null;
    }
    var configPath = arg2 || outerDefault;
    if (!configPath) {
        fluid.fail("Config path must be specified as 1st command line argument");
    }
    return configPath;
};

kettle.config.initCLI = function (defaultConfigPath, defaultConfigName) {
    return kettle.config.loadConfig({
        configPath: kettle.config.getConfigPath(defaultConfigPath),
        configName: kettle.config.getConfigName(defaultConfigName)
    });
};

kettle.config.expectedTopLevel = fluid.arrayToHash(["type", "options", "loadConfigs", "mergeConfigs", "require"]);

kettle.config.checkConfig = function (config, fullPath) {
    fluid.each(config, function (value, key) {
        if (!kettle.config.expectedTopLevel[key]) {
            fluid.fail("Error in config file at path " + fullPath + " - key \"" + key +
                "\" found, where the only legal options are " +
                fluid.keys(kettle.config.expectedTopLevel).join(", "));
        }
    });
};

kettle.config.loadSubConfigs = function (prefix, fullPath, configPaths, gradeNames) {
    configPaths = fluid.makeArray(configPaths);
    fluid.each(configPaths, function loadConfigFromPath(configPath) {
        var loadedDefaults;
        try {
            loadedDefaults = kettle.config.createDefaultsImpl(prefix, configPath);
        } catch (e) {
            e.message += " while loading included configs for config at path " + fullPath;
            throw e;
        }
        if (gradeNames) {
            gradeNames.push(loadedDefaults);
        }
    });
};

kettle.config.createDefaultsImpl = function (prefix, filePath) {
    var fullPath;
    if (filePath.charAt(0) === "%") {
        fullPath = fluid.module.resolvePath(filePath);
        prefix = path.dirname(fullPath);
    } else {
        var fileName = path.basename(filePath),
            dirName = path.dirname(filePath);
        prefix = path.resolve(prefix, dirName);
        fullPath = path.resolve(prefix, fileName);
    }
    var configFile;
    var testFiles = [fullPath, fullPath + ".json", fullPath + ".json5"];
    var firstExisting = kettle.firstExistingFile(testFiles);
    if (!firstExisting) {
        fluid.fail("Could not find a config file at any of the paths ", testFiles.join(", "));
    }
    var parser = kettle.JSON.readFileSync(firstExisting, "reading config file at " + firstExisting);
    parser.then(function (parsed) {
        configFile = parsed;
    }, function (rejection) {
        fluid.fail(rejection.message);
    });

    kettle.config.checkConfig(configFile);
    var gradeNames = ["kettle.config"];

    kettle.config.loadSubConfigs(prefix, firstExisting, configFile.mergeConfigs, gradeNames);
    kettle.config.loadSubConfigs(prefix, firstExisting, configFile.loadConfigs);

    var requires = fluid.makeArray(configFile.require);
    fluid.each(requires, function loadRequire(requireId) {
        if (requireId.charAt(0) === "%") {
            requireId = fluid.module.resolvePath(requireId);
        }
        try {
            var resolved = resolve.sync(requireId, {
                basedir: prefix
            });
            require(resolved);
        } catch (e) {
            e.message += " while trying to resolve require directive for " + requireId + " in config at path " + firstExisting;
            throw (e);
        }
    });
    configFile.type = configFile.type || "kettle.config." + fluid.allocateGuid();
    configFile.options = configFile.options || {};
    configFile.options.gradeNames = gradeNames.concat(fluid.makeArray(
        configFile.options.gradeNames));
    fluid.defaults(configFile.type, configFile.options);
    fluid.log(fluid.logLevel.TRACE, "Created defaults for config type " + configFile.type + ": " + fluid.prettyPrintJSON(configFile.options));
    return configFile.type;
};

/** Convert a Kettle "config" as specified by a base path and configName value into a set of component defaults
 * constituting a runnable Kettle application. This will recursively load as grades any "loadConfigs" and "mergeConfigs" specified in the root
 * config file, for mergeConfigs, merge their configuration into the root config.
 * @param options {Object} Contains fields:
 *     configName {String} a value that will be looked up to a "config" file in the supplied
 * directory by appending the <code>.json</code> suffix
 *     configPath {String} A fully qualified directory name holding config files, or one prefixed with a %module base path reference
 * @return {String} the global name of a Fluid component which can be invoked to instantiate the Kettle application
 */

kettle.config.createDefaults = function (options) {
    return kettle.config.createDefaultsImpl(fluid.module.resolvePath(options.configPath), options.configName);
};

/** Arguments as for <code>kettle.config.createDefaults</code> only the corresponding Kettle application will be run immediately
 */
kettle.config.loadConfig = function (options) {
    var componentName = kettle.config.createDefaults(options);
    return fluid.invokeGlobalFunction(componentName);
};

