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
    // See https://github.com/expressjs/multer#multeropts;
    // because Multer expects to receive functions for some
    // of its options, some of these are implemented using
    // invokers that an implementer should override to change
    // the basic configuration
    middlewareOptions: {
        // These are the default limits multer uses
        // See https://github.com/expressjs/multer#limits
        // Recommended that these should be configured on a per-handler basis
        // to prevent possible DDOS attacks via form submission,
        // or other badness
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
    // Configures the expected form fields
    // to be handled, and the multer method to handle
    // them; see https://github.com/expressjs/multer#usage
    // for more documentation
    formFieldOptions: {
        method: "single",
        // Relevant only for "single" and "array" methods
        fieldName: "file"
        // Relevant only for "array" method
        // maxCount: 10
        // Relevant only for "fields" method
        // fields: [
        //     {name: "avatar", maxCount: 1},
        //     {name: "gallery", maxCount: 8}
        // ]
    },
    members: {
       // TODO: is there a way to build this configuration object
       // in the "args" of an invoker/expander directly, or is
       // this the best approach?
        diskStorageConfigurationObject: {
            "filename": "{that}.diskStorageFilename",
            "destination": "{that}.diskStorageDestination"
        },
        "diskStorage": {
            expander: {
                funcName: "kettle.npm.multer.diskStorage",
                "args": ["{that}.diskStorageConfigurationObject"]
            }
        },
        "memoryStorage": {
            expander: {
                funcName: "kettle.npm.multer.memoryStorage",
                "args": []
            }
        },
        // Change to "{that}.diskStorage" to use disk storage
        "storage": "{that}.memoryStorage"
    },
    middleware: "@expand:kettle.middleware.multer.createMiddleware({that}, {that}.options.middlewareOptions, {that}.storage, {that}.getMulterMethod, {that}.fileFilter)",
    // TODO: this should be more configurable, or at least
    // better documented
    invokers: {
        "getMulterMethod": {
            "funcName": "kettle.middleware.multer.getMulterMethod",
            "args": ["{that}", "{that}.options.formFieldOptions"]
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

kettle.middleware.multer.getMulterMethod = function (that, formFieldOptions) {
    var multer = that.multer;
    var multerMethod = formFieldOptions.method;

    var multerFields = multerMethod === "fields" ? formFieldOptions.fields : formFieldOptions.fieldName;

    return multerMethod === "array" ?  multer[multerMethod](multerFields, formFieldOptions.maxCount) : multer[multerMethod](multerFields);
};

kettle.middleware.multer.createMiddleware = function (that, middlewareOptions, storage, getMulterMethod, fileFilter) {

    middlewareOptions.storage = storage;
    middlewareOptions.fileFilter = fileFilter;

    that.multer = kettle.npm.multer(middlewareOptions);

    return getMulterMethod();
};
