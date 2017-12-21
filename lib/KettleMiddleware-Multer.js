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
        acceptFuncName: "single", // See https://github.com/expressjs/multer#singlefieldname and others
        acceptFuncArgs: ["file"]
        // This should be a function name to use when filtering
        // See https://github.com/expressjs/multer#filefilter for implementation details
        // fileFilterFuncName: {}
    },
    middleware: "@expand:kettle.middleware.multer.createMiddleware({that}.options.middlewareOptions, {that}.options.multerConfig, {that}.getMemoryStorage)",
    invokers: {
        "getMemoryStorage": {
            "funcName": "kettle.npm.multer.memoryStorage",
            "args": []
        }
    }
});

kettle.middleware.multer.createMiddleware = function (middlewareOptions, multerConfig, storage) {
    // var diskStorage = kettle.npm.multer.diskStorage({
    //     destination: "./images",
    //     filename: function (req, file, cb) {
    //         cb(null, file.originalname);
    //     }
    // });

    middlewareOptions.storage = storage();

    if(multerConfig.fileFilterFuncName) {
        var fileFilterFunc = fluid.getGlobalValue(multerConfig.fileFilterFuncName);
        middlewareOptions.fileFilter = fluid.getGlobalValue(multerConfig.fileFilterFuncName);
    }

    var multer = kettle.npm.multer(middlewareOptions);
    return multer[multerConfig.acceptFuncName].apply(multer, multerConfig.acceptFuncArgs);
};
