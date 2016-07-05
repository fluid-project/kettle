/*!
Kettle DataSource

Copyright 2012-2013 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
    kettle = fluid.registerNamespace("kettle"),
    fs = require("fs");

fluid.require("querystring", require, "node.querystring");

fluid.registerNamespace("kettle.dataSource");

/**** FILE DATASOURCE SUPPORT ****/

fluid.defaults("kettle.dataSource.file", {
    gradeNames: ["kettle.dataSource"],
    readOnlyGrade: "kettle.dataSource.file",
    invokers: {
        getImpl: {
            funcName: "kettle.dataSource.file.handle",
            args: ["{that}", "{arguments}.0", "{arguments}.1"] // options, directModel
        }
    }
});

fluid.defaults("kettle.dataSource.file.writable", {
    gradeNames: ["kettle.dataSource.writable"],
    invokers: {
        setImpl: {
            funcName: "kettle.dataSource.file.handle",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // options, directModel, model
        }
    }
});

/** Central strategy point for all file-system backed DataSource operations (both read and write).
 * Accumulates options to be sent to the underlying node.js `readFile` or `writeFile` primitives, collects and interprets the
 * results back into promise resolutions.
 * @param that {Component} The DataSource itself
 * @param requestOptions {Object} A merged form of the options sent to the top-level `dataSource.get` method together with relevant
 * static options configured on the component
 * @param directModel {Object} The `directModel` argument sent to top-level `dataSource.get/set`
 * @param model {String} The `model` argument sent to top-level `dataSource.get/set` after it has been pushed through the transform chain
 */

kettle.dataSource.file.handle = function (that, requestOptions, directModel, model) {
    if (!that.options.path) {
        fluid.fail("Cannot operate file dataSource ", that, " without an option named \"path\"");
    }
    var fileName = kettle.dataSource.URL.resolveUrl(that.options.path, that.options.termMap, directModel, true);
    var promise = fluid.promise(),
        method = "readFile",
        operation = requestOptions.operation,
        fsCallback = function (error, readData) {
            /* istanbul ignore if - don't know how to reliably and portably trigger file error that is not "not found" */
            if (error) {
                promise.reject({
                    message: error.message
                });
            } else {
                promise.resolve(requestOptions.operation === "set" ? undefined : readData);
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
            if (requestOptions.notFoundIsEmpty) {
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

/** A mixin grade for `kettle.dataSource.file` which automatically expands any %terms corresponding to module names registered in Infusion's module database */

fluid.defaults("kettle.dataSource.file.moduleTerms", {
    gradeNames: "kettle.dataSource.file",
    termMap: "@expand:fluid.module.terms()"
});


require("./dataSource-url");
