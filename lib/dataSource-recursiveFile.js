/*!
Kettle Recursive File DataSource

This datasource looks up files in the filesystem, but unlike datasource-file, it does a deep recursive scan of the given
folder looking for the filename in question. The search for the filename will happen in the following way:
(1) the top most level dir is read
(2) the content of the dir is searched sequentially in the order returned by fs.readDir (generally alphabetically)
(3) when a folder is encountered, it is searched in the order defined above (i.e. step 1-3 repeated with this new folder as root)
(4) The first file that matches the given filename is returned

Copyright 2017 Raising the Floor - International

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
*/

"use strict";

var fluid = fluid || require("infusion"),
    kettle = fluid.registerNamespace("kettle"),
    fs = require("fs"),
    path = require("path");

fluid.require("querystring", require, "node.querystring");

fluid.registerNamespace("kettle.dataSource");

/**** RECURSIVE FILE DATASOURCE SUPPORT ****/

fluid.defaults("kettle.dataSource.recursiveFile", {
    gradeNames: ["kettle.dataSource"],
    readOnlyGrade: "kettle.dataSource.recursiveFile",
    invokers: {
        getImpl: {
            funcName: "kettle.dataSource.recursiveFile.handle",
            args: ["{that}", "{arguments}.0", "{arguments}.1"] // options, directModel
        }
    }
});

kettle.dataSource.recursiveFile.rejectPromise = function (promise, errorMsg, statusCode) {
    promise.reject({
        isError: true,
        message: errorMsg || "Unknown error occured attempting to handle recursiveFile dataSource",
        statusCode: statusCode || 500
    });
};

/**
 * Asynchronously searches the filesystem recursively from the given `rootPath` for a file names `toFind`. Any file
 * matching the filename is add to the `found` array. When the entire rootPath has been searched or if an
 * error has occured, the callback function is called.
 * @param rootPath {String} the root to search from. This should be  a valid folder.
 * @param toFind {String} filename of the file to find
 * @param found {Array} An array that will contain the results after the function is done
 * @param callback {function} A function that has one parameter "error". The callback will be triggered when the
 *    filesystem search has finished. If an error occured, it will be passed as a parameter to the function, else
 *    nothing will be passed.
 */
kettle.dataSource.recursiveFile.findAll = function (rootPath, toFind, found, callback) {
    fs.readdir(rootPath, function (err, files) {
        if (err) {
            callback(err.message, toFind);
            return;
        }

        // set the number of pending async calls to the number of files, since we need to lstat each one
        var pending = files.length;
        if (pending === 0) { // empty folder
            callback();
            return;
        }
        var i = 0;

        (function next() {
            var cf = files[i];
            // console.log("PATH: ", rootPath, " >>>> CF: ", cf);
            var cfp = path.join(rootPath, cf);

            i++;

            fs.lstat(cfp, function (err, stats) {
                if (err) {
                    callback(err.message, toFind);
                } else if (stats && stats.isDirectory()) { // get stats
                    kettle.dataSource.recursiveFile.findAll(cfp, toFind, found, function () {
                        pending--;
                        (pending === 0) ? callback() : next();
                    });
                } else {
                    if (cf === toFind && stats && stats.isFile()) { // if this is the file we're looking for push to list
                        found.push(cfp);
                    }
                    pending--;
                    (pending === 0) ? callback() : next();
                }
            });
        })();
    });
};

/**
 * Do an asynchronous recursive search of the `rootPath` looking for the `filename`. If the file is found,
 * the first hit is read and returned via the resolved promise. If no file is found, the promise is rejected.
 *
 * @param rootPath {String} the root to search from. This should be  a valid folder.
 * @param filename {String} filename of the file to find
 * @param encoding {String} The encoding in which to read the file
 * @param promise {Promise} A fluid.promise. If an error occurs or no file is found, it will be rejected, else
 *     it will be resolved with the content of the (first instance of) the found file
 */
kettle.dataSource.recursiveFile.readFile = function (rootPath, filename, encoding, promise) {
    var foundList = [];
    kettle.dataSource.recursiveFile.findAll(rootPath, filename, foundList, function (err) {
        if (err) {
            kettle.dataSource.recursiveFile.rejectPromise(promise, "Error while searching for file... " + err);
        } else if (foundList.length === 0) {
            kettle.dataSource.recursiveFile.rejectPromise(promise, "File " + filename + " was not found when searching from path " + rootPath, 404);
        } else {
            fs.readFile(foundList[0], encoding, function (err, data) { // read the first file found
                if (err) {
                    kettle.dataSource.recursiveFile.rejectPromise("Error while reading file... " + err);
                } else {
                    promise.resolve(data);
                }
            });
        }
    });
};

/** Central strategy point for all file-system backed DataSource operations (both read and write).
 * Accumulates options to be sent to the underlying node.js `readFile` or `writeFile` primitives, collects and interprets the
 * results back into promise resolutions.
 * @param that {Component} The DataSource itself
 * @param requestOptions {Object} A merged form of the options sent to the top-level `dataSource.get` method together with relevant
 * static options configured on the component
 * @param directModel {Object} The `directModel` argument sent to top-level `dataSource.get/set`
 */
kettle.dataSource.recursiveFile.handle = function (that, requestOptions, directModel) {
    if (!that.options.path) {
        fluid.fail("Cannot operate recursiveFile dataSource ", that, " without an option named \"path\"");
    } else if (!that.options.filename) {
        fluid.fail("Cannot operate recursiveFile dataSource ", that, " without an option named \"filename\"");
    }

    // resolve path and filename
    var resolvedPath = kettle.dataSource.URL.resolveUrl(that.options.path, that.options.termMap, directModel, true).replace("//", "/");
    var filename = fluid.stringTemplate(that.options.filename, directModel);

    var promise = fluid.promise();

    promise.accumulateRejectionReason = function (originError) {
        return kettle.upgradeError(originError, " while reading file " + filename + " recursively searched for from path " + resolvedPath);
    };

    kettle.dataSource.recursiveFile.readFile(resolvedPath, filename, that.options.charEncoding, promise);
    return promise;
};

/** A mixin grade for `kettle.dataSource.recursiveFile` which automatically expands any %terms corresponding to module names registered in Infusion's module database */
fluid.defaults("kettle.dataSource.recursiveFile.moduleTerms", {
    gradeNames: "kettle.dataSource.recursiveFile",
    termMap: "@expand:fluid.module.terms()"
});
