/*!
Kettle wrapping for Multer Express Middleware

Copyright 2017-2018 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
*/

"use strict";

// Wraps the standard Express Multer middleware, for handling
// multipart/form-data (primarily for file uploads)

var fluid = require("infusion"),
    kettle = fluid.registerNamespace("kettle");

fluid.require("multer", require, "kettle.npm.multer");

fluid.defaults("kettle.middleware.multer", {
    gradeNames: "kettle.plainAsyncMiddleware",
    // See https://github.com/expressjs/multer#multeropts; because
    // Multer expects to receive functions for some of its options,
    // some of these are implemented using invokers that an implementer should
    // override to change the basic configuration
    middlewareOptions: {
        // These are the default limits multer uses
        // See https://github.com/expressjs/multer#limits
        // Recommended that these should be configured on a per-handler basis
        // to prevent possible DDOS attacks via form submission, or other
        // badness
        limits: {
            fieldNameSize: 100,
            fieldSize: "1MB",
            fields: Infinity,
            fileSize: Infinity,
            files: Infinity,
            parts: Infinity,
            headerPairs: 2000
        }
    },
    middleware: "@expand:kettle.middleware.multer.createMiddleware({that}, {that}.options.middlewareOptions, {that}.getStorage, {that}.getMiddlewareForFileStrategy, {that}.getFileFilter)",
    invokers: {
        // Change to getDiskStorage for diskStorage
        "getStorage": {
            "func": "{that}.getMemoryStorage"
        },
        //
        "getMiddlewareForFileStrategy": {
            "funcName": "kettle.middleware.multer.getMiddlewareForFileStrategy",
            "args": ["{that}", "single", "file"]
        },
        // Override this function for different behaviour in the file filter
        // function
        "getFileFilter": {
            "funcName": "kettle.middleware.multer.getAllowAllFileFilter"
        },
        "getMemoryStorage": {
            "funcName": "kettle.npm.multer.memoryStorage",
            "args": []
        },
        "getDiskStorage": {
            "funcName": "kettle.middleware.multer.getDiskStorage",
            "args": ["{that}.getDiskStorageDestinationFunc","{that}.getDiskStorageFilenameFunc"]
        },
        // Override this function for different behaviour in the destination
        // when using disk storage
        "getDiskStorageDestinationFunc": {
            "funcName": "kettle.middleware.multer.getDefaultDiskStorageDestinationFunc"
        },
        // Override this function for different behaviour in the file name
        // generation when using disk storage
        "getDiskStorageFilenameFunc": {
            "funcName": "kettle.middleware.multer.getDefaultDiskStorageFilenameFunc"
        }
    }
});

kettle.middleware.multer.getAllowAllFileFilter = function () {
    return kettle.npm.multer.allowAll;
};

kettle.middleware.multer.getMemoryStorage = function () {
    return kettle.npm.multer.memoryStorage;
};

// See https://github.com/expressjs/multer#diskstorage for
// the function style of multer's disk storage destination function
//
// If overriding, this should remain a zero-argument function
// and return an appropriate function for multer's use
kettle.middleware.multer.getDefaultDiskStorageDestinationFunc = function () {
    return function (req, file, cb) {
        cb(null, "./tests/data/uploads");
    };
};

// See https://github.com/expressjs/multer#diskstorage for
// the function style of multer's disk storage file name function
//
// If overriding, this should remain a zero-argument function
// and return an appropriate function for multer's use
kettle.middleware.multer.getDefaultDiskStorageFilenameFunc = function () {
    return function (req, file, cb) {
        cb(null, file.originalname);
    };
};

kettle.middleware.multer.getDiskStorage = function (destinationFunc, filenameFunc) {
    var diskStorage = kettle.npm.multer.diskStorage({
        destination: destinationFunc(),
        filename: filenameFunc()
    });
    return diskStorage;
};

// Convenience filter function for filtering by mimeType
// acceptedMimeTypes: an array of mimetypes to accept
// See https://github.com/expressjs/multer#filefilter
// for details of writing other filters
kettle.middleware.multer.getMimeTypeFileFilter = function (acceptedMimeTypes) {
    return function (req, file, cb) {
        var isAcceptableMimeType = fluid.contains(acceptedMimeTypes, file.mimetype);
        cb(null, isAcceptableMimeType);
    };
};

kettle.middleware.multer.getMiddlewareForFileStrategy = function (that, multerAcceptFuncName, multerAcceptFuncArgs) {
    var multer = that.multer;

    if (multerAcceptFuncName === "array") {
        return multer[multerAcceptFuncName].apply(multer, multerAcceptFuncArgs);
    } else {
        return multer[multerAcceptFuncName](multerAcceptFuncArgs);
    }
};

kettle.middleware.multer.createMiddleware = function (that, middlewareOptions, getStorage, getMiddlewareForFileStrategy, getFileFilter) {

    middlewareOptions.storage = getStorage();
    middlewareOptions.fileFilter = getFileFilter();

    that.multer = kettle.npm.multer(middlewareOptions);

    return getMiddlewareForFileStrategy();
};
