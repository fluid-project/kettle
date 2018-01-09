/*!
Kettle Recursive File DataSource

This datasource looks up files in the filesystem, but unlike datasource-file, it does a deep recursive scan of the
folder from which kettle was starting looking for the filename in question.
On startup startup folder is scanned and all files are indexed. This means that changes to the filesystem are _not_
detected. This datasource has been created for testing and development purposes.

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
    members: {
        fileIndex: {}
    },
    listeners: {
        "onCreate.indexFiles": {
            listener: "kettle.dataSource.recursiveFile.indexFiles",
            args: [ "{that}", "{that}.fileIndex" ]
        }
    },
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
 * Sequentially indexes all the files in subfolders of the one from which the kettle app was launched. These
 * are kept indexed in the components `fileIndex` member for later use when searching for a file.
 * The indexing is done synchronously and should generally only be used for testing and development
 * purposes.
 */
kettle.dataSource.recursiveFile.indexFiles = function (that, fileIndex) {
    var rootFolder = process.cwd();
    kettle.dataSource.recursiveFile.indexInFolder(fileIndex, rootFolder);
};

kettle.dataSource.recursiveFile.indexInFolder = function (fileIndex, folder) {
    var files = fs.readdirSync(folder);
    fluid.each(files, function (file) {
        var fullPath = path.join(folder, file);
        var stat = fs.lstatSync(fullPath);
        if (stat && stat.isDirectory()) {
            kettle.dataSource.recursiveFile.indexInFolder(fileIndex, fullPath);
        } else if (stat && stat.isFile(fullPath)) {
            if (fileIndex[file] === undefined) {
                fileIndex[file] = [fullPath];
            } else {
                fileIndex[file].push(fullPath);
            }
        }
    });
};

/**
 * Looks up the given filename in the fileIndex. If found, the file will be read asynchronously and the content
 * returned via a resolved promise. If the file is not found (or there is an error reading it), the promise will
 * be rejected.
 *
 * @param filename {String} filename of the file to find
 * @param fileIndex {Object} A map of filenames (keys) each with an array of paths where that filename is located.
 * @param encoding {String} The encoding in which to read the file
 * @param promise {Promise} A fluid.promise. If an error occurs or no file is found, it will be rejected, else
 *     it will be resolved with the content of the (first instance of) the found file
 * @return {Promise} the promise given as parameter is be returned.
 */
kettle.dataSource.recursiveFile.findAndReadFile = function (filename, fileIndex, encoding, promise) {
    var hits = fileIndex[filename];
    if (!hits) {
        kettle.dataSource.recursiveFile.rejectPromise(promise, "File " + filename + " was not found when searching from path " + process.cwd(), 404);
    } else {
        fs.readFile(hits[0], encoding, function (err, data) { // read the first file found
            fluid.log(fluid.logLevel.INFO, "Kettle recursive file search found match: ", hits[0]);
            if (err) {
                kettle.dataSource.recursiveFile.rejectPromise(promise, "Error while reading file... " + err);
            } else {
                promise.resolve(data);
            }
        });
    }
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
    if (!that.options.filename) {
        fluid.fail("Cannot operate recursiveFile dataSource ", that, " without an option named \"filename\"");
    }

    // resolve filename
    var filename = fluid.stringTemplate(that.options.filename, directModel);
    var promise = fluid.promise();

    promise.accumulateRejectionReason = function (originError) {
        return kettle.upgradeError(originError, " while reading file " + filename + " recursively searched for from path " + process.cwd());
    };

    kettle.dataSource.recursiveFile.findAndReadFile(filename, that.fileIndex, that.options.charEncoding, promise);

    return promise;
};
