/*!
Kettle wrapping for Multer Express Middleware

Copyright 2017 OCAD University

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
    // See https://github.com/expressjs/multer#multeropts, but note that because
    // Multer expects to receive functions for some of these, some of these are
    // implemented in the multerConfig block below
    middlewareOptions: {},
    multerConfig: {
        // This should be a function name to use when filtering
        // See https://github.com/expressjs/multer#filefilter for implementation details
        // fileFilterFuncName: {}
    },
    middleware: "@expand:kettle.middleware.multer.createMiddleware({that}, {that}.options.middlewareOptions, {that}.options.multerConfig, {that}.getStorage, {that}.getFileStrategy, {that}.getFileFilter)",
    invokers: {
        "getStorage": {
            "func": "{that}.getDefaultStorage"
        },
        "getFileStrategy": {
            "func": "{that}.getDefaultFileStrategy"
        },
        "getFileFilter": {
            "func": "{that}.getDefaultFileFilter"
        },
        "getDefaultStorage": {
            "funcName": "kettle.npm.multer.memoryStorage",
            "args": []
        },
        "getDefaultFileStrategy": {
            "funcName": "kettle.middleware.multer.getFileStrategy",
            "args": ["{that}", "single", "file"]
        },
        "getDefaultFileFilter": {
            "funcName": "kettle.middleware.multer.getAllowAllFileFilter"
        }
    }
});

kettle.middleware.multer.getAllowAllFileFilter = function () {
    return kettle.npm.multer.allowAll;
};

kettle.middleware.multer.getFileStrategy = function (that, multerAcceptFuncName, multerAcceptFuncArgs) {
    var multer = that.multer;

    if(multerAcceptFuncName === "array") {
        return multer[multerAcceptFuncName].apply(multer, multerAcceptFuncArgs);
    } else {
        return multer[multerAcceptFuncName](multerAcceptFuncArgs);
    }
};

kettle.middleware.multer.createMiddleware = function (that, middlewareOptions, multerConfig, getStorage, getFileStrategy, getFileFilter) {
    // var diskStorage = kettle.npm.multer.diskStorage({
    //     destination: "./images",
    //     filename: function (req, file, cb) {
    //         cb(null, file.originalname);
    //     }
    // });

    middlewareOptions.storage = getStorage();
    middlewareOptions.fileFilter = getFileFilter();

    that.multer = kettle.npm.multer(middlewareOptions);

    return getFileStrategy();
};
