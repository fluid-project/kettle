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
    components: {
        storage: {
            type: "kettle.middleware.multer.memoryStorage"
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
    middleware: "@expand:kettle.middleware.multer.createMiddleware({that}, {that}.options.middlewareOptions, {that}.storage, {that}.options.formFieldOptions, {that}.fileFilter)",
    invokers: {
        // Override this function for different behaviour in the
        // file filter function; must match the expected signature
        // of Multer's fileFilter function as documented at
        // https://github.com/expressjs/multer#filefilter
        "fileFilter": {
            "funcName": "kettle.middleware.multer.allowAllFileFilter"
        }
    }
});

// Duplicate of Multer's internal allowAll function;
// Multer doesn't export, making it inaccessible
// to the kettle.npm.multer namespace

kettle.middleware.multer.allowAllFileFilter = function (req, file, cb) {
    cb(null, true);
};

// Convenience function for generating filters by mimeType
// acceptedMimeTypes: an array of mimetypes to accept
// See https://github.com/expressjs/multer#filefilter
// for details of writing other filters and see
// kettle.tests.multer.config.json5 for an
// example of using an expander with this function to
// override the fileFilter invoker
kettle.middleware.multer.createMimeTypeFileFilterFunction = function (acceptedMimeTypes) {
    return function (req, file, cb) {
        var isAcceptableMimeType = fluid.contains(acceptedMimeTypes, file.mimetype);
        cb(null, isAcceptableMimeType);
    };
};

kettle.middleware.multer.createMiddleware = function (that, middlewareOptions, storage, formFieldOptions, fileFilter) {

    middlewareOptions.storage = storage.storage;
    console.log(middlewareOptions.storage);
    middlewareOptions.fileFilter = fileFilter;

    var multer = kettle.npm.multer(middlewareOptions);

    var multerMethod = formFieldOptions.method;

    var multerFields = multerMethod === "fields" ? formFieldOptions.fields : formFieldOptions.fieldName;

    return multerMethod === "array" ?  multer[multerMethod](multerFields, formFieldOptions.maxCount) : multer[multerMethod](multerFields);
};

fluid.defaults("kettle.middleware.multer.memoryStorage", {
    gradeNames: ["fluid.component"],
    members: {
        storage: {
            expander: {
                funcName: "kettle.npm.multer.memoryStorage",
                args: []
            }
        }
    }
});

fluid.defaults("kettle.middleware.multer.diskStorage", {
    gradeNames: ["fluid.component"],
    // destination can be a plain string or a string using fluid.stringTemplate
    // syntax - the template will receive the "file information" key-values
    // described at https://github.com/expressjs/multer#file-information
    destination: "./tests/data/uploads",
    // filename can be a plain string or a string using fluid.stringTemplate
    // syntax - the template will receive the "file information" key-values
    // described at https://github.com/expressjs/multer#file-information
    filename: "%originalname",
    members: {
        diskStorageConfigurationObject: {
            destination: {
                expander: {
                    func: "{that}.destination"
                }
            },
            filename: {
                expander: {
                    func: "{that}.filename"
                }
            }
        },
        storage: {
            expander: {
                funcName: "kettle.npm.multer.diskStorage",
                "args": ["{that}.diskStorageConfigurationObject"]
            }
        }
    },
    invokers: {
        destination: {
            funcName: "kettle.middleware.multer.diskStorage.destination",
            args: ["{that}.options.destination"]
        },
        filename: {
            funcName: "kettle.middleware.multer.diskStorage.filename",
            args: ["{that}.options.filename"]
        }
    }
});

// Returns a function in Multer's expected style for computing
// the destination directory of an uploaded file when using diskStorage
//
// If you wish to override the function returned,
// see https://github.com/expressjs/multer#diskstorage for
// the function style of multer's disk storage destination function
kettle.middleware.multer.diskStorage.destination = function (destinationTemplate) {
    return function (req, file, cb) {
        cb(null, fluid.stringTemplate(destinationTemplate, file));
    };
};

// Returns a function in Multer's expected style for computing
// the filename of an uploaded file when using diskStorage
//
// If you wish to override the function returned,
// see https://github.com/expressjs/multer#diskstorage for
// the function style of multer's disk storage filename function
kettle.middleware.multer.diskStorage.filename = function (filenameTemplate) {
    return function (req, file, cb) {
        cb(null, fluid.stringTemplate(filenameTemplate, file));
    };
};
