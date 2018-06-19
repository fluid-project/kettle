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
    middleware: "@expand:kettle.middleware.multer.createMiddleware({that}, {that}.options.middlewareOptions, {that}.getStorage, {that}.getMiddlewareForFileStrategy, {that}.fileFilter)",
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
        // Override this function for different behaviour in the
        // file filter function; must match the expected signature
        // of Multer's fileFilter function as documented at
        // https://github.com/expressjs/multer#filefilter
        //
        // See kettle.tests.multer.config.json5 for an
        // example of using expanders to return an
        // appropriate function with
        // kettle.middleware.multer.createMimeTypeFileFilterFunction
        "fileFilter": {
            "funcName": "kettle.middleware.multer.allowAllFileFilter"
        },
        "getMemoryStorage": {
            "funcName": "kettle.npm.multer.memoryStorage",
            "args": []
        },
        "getDiskStorage": {
            "funcName": "kettle.middleware.multer.getDiskStorage",
            "args": ["{that}.diskStorageDestination","{that}.diskStorageFilename"]
        },
        // Override this function for different behaviour in the destination
        // when using disk storage
        "diskStorageDestination": {
            "funcName": "kettle.middleware.multer.defaultDiskStorageDestination"
        },
        // Override this function for different behaviour in the file name
        // generation when using disk storage
        "diskStorageFilename": {
            "funcName": "kettle.middleware.multer.defaultDiskStorageFilename"
        }
    }
});

// Duplicate of Multer's internal allowAll function;
// Multer doesn't export, making it inaccessible
// to the kettle.npm.multer namespace

kettle.middleware.multer.allowAllFileFilter = function (req, file, cb) {
    cb(null, true);
};

kettle.middleware.multer.getMemoryStorage = function () {
    return kettle.npm.multer.memoryStorage;
};

// See https://github.com/expressjs/multer#diskstorage for
// the function style of multer's disk storage destination function
kettle.middleware.multer.defaultDiskStorageDestination = function (req, file, cb) {
    cb(null, "./tests/data/uploads");
};

// See https://github.com/expressjs/multer#diskstorage for
// the function style of multer's disk storage file name function
kettle.middleware.multer.defaultDiskStorageFilename = function (req, file, cb) {
    cb(null, file.originalname);
};

kettle.middleware.multer.getDiskStorage = function (destinationFunc, filenameFunc) {
    var diskStorage = kettle.npm.multer.diskStorage({
        destination: destinationFunc,
        filename: filenameFunc
    });
    return diskStorage;
};

// Convenience function for generating filters by mimeType
// acceptedMimeTypes: an array of mimetypes to accept
// See https://github.com/expressjs/multer#filefilter
// for details of writing other filters
kettle.middleware.multer.createMimeTypeFileFilterFunction = function (acceptedMimeTypes) {
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

kettle.middleware.multer.createMiddleware = function (that, middlewareOptions, getStorage, getMiddlewareForFileStrategy, fileFilter) {

    middlewareOptions.storage = getStorage();
    middlewareOptions.fileFilter = fileFilter;

    that.multer = kettle.npm.multer(middlewareOptions);

    return getMiddlewareForFileStrategy();
};
