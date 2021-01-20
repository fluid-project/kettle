/*!
Kettle File DataSource

Copyright 2012-2013 OCAD University
Copyright 2016 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/main/LICENSE.txt
*/

"use strict";

var fluid = fluid || require("infusion"),
    kettle = fluid.registerNamespace("kettle"),
    fs = require("fs");

fluid.registerNamespace("kettle.dataSource");

/**** FILE DATASOURCE SUPPORT ****/

fluid.defaults("kettle.dataSource.file", {
    gradeNames: ["fluid.dataSource"],
    writableGrade: "kettle.dataSource.file.writable",
    charEncoding: "utf-8",
    listeners: {
        "onRead.impl": {
            funcName: "kettle.dataSource.file.handle",
            args: ["{that}", "{arguments}.0", "{arguments}.1"] // [model], options
        }
    }
});

fluid.defaults("kettle.dataSource.file.writable", {
    gradeNames: ["fluid.dataSource.writable"],
    listeners: {
        "onWrite.impl": {
            funcName: "kettle.dataSource.file.handle",
            args: ["{that}", "{arguments}.0", "{arguments}.1"] // model, options
        }
    }
});

/** Central strategy point for all file-system backed DataSource operations (both read and write).
 * Accumulates options to be sent to the underlying node.js `readFile` or `writeFile` primitives, collects and interprets the
 * results back into promise resolutions.
 * @param {Component} that - The DataSource itself
 * @param {String} model - The `model` argument sent to top-level `dataSource.get/set` after it has been pushed through the transform chain
 * @param {Object} userOptions - A merged form of the options sent to the top-level `dataSource.get/set` method together with relevant
 * static options configured on the component
 * @return {Promise} A promise for the resolved file contents
 */
kettle.dataSource.file.handle = function (that, model, userOptions) {
    if (!that.options.path) {
        fluid.fail("Cannot operate file dataSource ", that, " without an option named \"path\"");
    }
    var directModel = userOptions.directModel;
    var fileName = fluid.dataSource.URL.resolveUrl(that.options.path, that.options.termMap, directModel, true).replace("//", "/");
    var promise = fluid.promise(),
        method = "readFile",
        operation = userOptions.operation,
        fsCallback = function (error, readData) {
            /* istanbul ignore if - don't know how to reliably and portably trigger file error that is not "not found" */
            if (error) {
                promise.reject({
                    message: error.message
                });
            } else {
                promise.resolve(userOptions.operation === "set" ? undefined : readData);
            }
        },
        args = [fileName, that.options.charEncoding];
    promise.accumulateRejectionReason = function (originError) {
        return kettle.upgradeError(originError, " while " + (operation === "set" ? "writing" : "reading") + " file " + fileName);
    };
    if (operation === "set") {
        method = "writeFile";
        args.splice(1, 0, model);
    } else {
        if (!fs.existsSync(fileName)) {
            if (userOptions.notFoundIsEmpty) {
                promise.resolve(undefined);
            } else {
                promise.reject({
                    isError: true,
                    message: "File " + fileName + " was not found",
                    statusCode: 404
                });
            }
            return promise;
        }
    }
    args.push(kettle.wrapCallback(fsCallback));
    fs[method].apply(null, args);
    return promise;
};
