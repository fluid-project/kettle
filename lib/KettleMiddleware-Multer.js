/*!
Kettle wrapping for Express Middleware

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
    middlewareOptions: {}, // See https://github.com/expressjs/multer#multeropts,
    multerConfig: {
        storageFuncName: "kettle.npm.multer.memoryStorage",
        storageArgs: [],
        acceptFuncName: "single",
        acceptFuncArgs: ["file"]
    },
    middleware: "@expand:kettle.middleware.multer.createMiddleware({that}.options.middlewareOptions, {that}.options.multerConfig)"
});

kettle.middleware.multer.createMiddleware = function (middlewareOptions, multerConfig) {
    // var diskStorage = kettle.npm.multer.diskStorage({
    //     destination: "./images",
    //     filename: function (req, file, cb) {
    //         cb(null, file.originalname);
    //     }
    // });

    var storage = fluid.invokeGlobalFunction(multerConfig.storageFuncName, multerConfig.storageArgs);
    middlewareOptions.storage = storage;

    var multer = kettle.npm.multer(middlewareOptions);
    return multer[multerConfig.acceptFuncName].apply(multer, multerConfig.acceptFuncArgs);
};
