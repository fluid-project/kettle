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
    // Also see the storage and fileFilter components for
    // supplying configuration to Multer's
    // storage and fileFilter options
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
            type: "kettle.middleware.multer.storage.memory"
        },
        fileFilter: {
            type: "kettle.middleware.multer.filter.allowAll"
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
    middleware: "@expand:kettle.middleware.multer.createMiddleware({that}, {that}.options.middlewareOptions, {that}.storage, {that}.options.formFieldOptions, {that}.fileFilter)"
});

kettle.middleware.multer.createMiddleware = function (that, middlewareOptions, storage, formFieldOptions, fileFilter) {

    middlewareOptions.storage = storage.multerStorage();
    middlewareOptions.fileFilter = fileFilter.multerFileFilter;

    var multer = kettle.npm.multer(middlewareOptions);

    var multerMethod = formFieldOptions.method;

    var multerFields = multerMethod === "fields" ? formFieldOptions.fields : formFieldOptions.fieldName;

    return multerMethod === "array" ?  multer[multerMethod](multerFields, formFieldOptions.maxCount) : multer[multerMethod](multerFields);
};

fluid.defaults("kettle.middleware.multer.filter", {
    gradeNames: ["fluid.component"],
    // This must be a filter function in Multer's
    // expected style - see https://github.com/expressjs/multer#filefilter
    invokers: {
        multerFileFilter: {
            funcName: "fluid.notImplemented"
        }
    }
});

fluid.defaults("kettle.middleware.multer.filter.allowAll", {
    gradeNames: ["fluid.component"],
    invokers: {
        multerFileFilter: {
            funcName: "kettle.middleware.multer.filter.allowAll.filterFunc"
        }
    }
});

// Duplicate of Multer's internal allowAll function;
// Multer doesn't export, making it inaccessible
// to the kettle.npm.multer namespace

kettle.middleware.multer.filter.allowAll.filterFunc = function (req, file, cb) {
    cb(null, true);
};

fluid.defaults("kettle.middleware.multer.filter.mimeType", {
    gradeNames: ["fluid.component"],
    // an array of mimetypes to accept, FE:
    // acceptedMimeTypes: ["image/gif", "image/jpg", "image/gif"],
    acceptedMimeTypes: [],
    invokers: {
        multerFileFilter: {
            func: {
                expander: {
                    funcName: "kettle.middleware.multer.filter.mimeType.createMimeTypeFileFilterFunction",
                    args: ["{that}.options.acceptedMimeTypes"]
                }
            }
        }
    }
});

// Generates Multer-style filters by mimeType
// acceptedMimeTypes: an array of mimetypes to accept
// See https://github.com/expressjs/multer#filefilter
// for details of writing other filters
kettle.middleware.multer.filter.mimeType.createMimeTypeFileFilterFunction = function (acceptedMimeTypes) {
    return function (req, file, cb) {
        var isAcceptableMimeType = fluid.contains(acceptedMimeTypes, file.mimetype);
        cb(null, isAcceptableMimeType);
    };
};

fluid.defaults("kettle.middleware.multer.storage", {
    gradeNames: ["fluid.component"],
    // This must be one of the supported Multer
    // storage functions (memoryStorage or diskStorage,
    // unless using additional plug-ins for Multer);
    // see the concrete grades below
    invokers: {
        multerStorage: {
            funcName: "fluid.notImplemented"
        }
    }
});

// Storage grade using Multer's memoryStorage
// storage function - uploaded files are only
// stored in memory for the duration of the
// request, although a handler or other
// middleware can process them from
// request.req.file or request.req.files
fluid.defaults("kettle.middleware.multer.storage.memory", {
    gradeNames: ["kettle.middleware.multer.storage"],
    invokers: {
        multerStorage: {
            funcName: "kettle.npm.multer.memoryStorage",
            args: []
        }
    }
});

// Storage grade using Multer's diskStorage
// storage function, with destination and
// filename as configurable options
//
// This grade should be adequate for most
// common uses of disk storage - complex
// uses should derive from this grade and
// replace the destination and filename
// invokers as necessary to return
// appropriate functions in Multer's
// expected style
fluid.defaults("kettle.middleware.multer.storage.disk", {
    gradeNames: ["kettle.middleware.multer.storage"],
    // "destination" can be a plain string or a string using fluid.stringTemplate
    // syntax - the template will receive the "file information" key-values
    // described at https://github.com/expressjs/multer#file-information
    destination: "./tests/data/uploads",
    // "filename" should be a string using fluid.stringTemplate
    // syntax - the template will receive the "file information" key-values
    // described at https://github.com/expressjs/multer#file-information
    //
    // Note that simply using a plain string will result in every uploaded
    // file overwriting the previous one - this is unlikely to be desired
    // behaviour
    filename: "%originalname",
    members: {
        // TODO: is this the best way to be able to supply an
        // object to an invoker where the object uses IoC references
        // for the values of its keys?
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
        }
    },
    invokers: {
        destination: {
            funcName: "kettle.middleware.multer.storage.disk.destination",
            args: ["{that}.options.destination"]
        },
        filename: {
            funcName: "kettle.middleware.multer.storage.disk.filename",
            args: ["{that}.options.filename"]
        },
        multerStorage: {
            funcName: "kettle.npm.multer.diskStorage",
            "args": ["{that}.diskStorageConfigurationObject"]
        }
    }
});

// Returns a function in Multer's expected style for computing
// the destination directory of an uploaded file when using diskStorage
//
// If you wish to override the function returned,
// see https://github.com/expressjs/multer#diskstorage for
// the function style of multer's disk storage destination function
kettle.middleware.multer.storage.disk.destination = function (destinationTemplate) {
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
kettle.middleware.multer.storage.disk.filename = function (filenameTemplate) {
    return function (req, file, cb) {
        cb(null, fluid.stringTemplate(filenameTemplate, file));
    };
};
