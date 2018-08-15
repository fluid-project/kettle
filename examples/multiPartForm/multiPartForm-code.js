/**
 * Kettle Sample app - multipartForm using code
 *
 * Copyright 2018 OCAD University
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/gpii/universal/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    examples = fluid.registerNamespace("examples");

require("../../kettle.js");

fluid.defaults("examples.uploadConfig", {
    "gradeNames": ["fluid.component"],
    "components": {
        "server": {
            "type": "kettle.server",
            "options": {
                "port": 8081,
                "components": {
                    "imageUpload": {
                        "type": "kettle.middleware.multer",
                        "options": {
                            "formFieldOptions": {
                                "method": "single",
                                "fieldName": "image"
                            },
                            "components": {
                                "storage": {
                                    "type": "kettle.middleware.multer.storage.disk",
                                    "options": {
                                        "destination": "./examples/multipartForm/uploads"
                                    }
                                },
                                "fileFilter": {
                                    "type": "kettle.middleware.multer.filter.mimeType",
                                    "options": {
                                        "acceptedMimeTypes": ["image/png", "image/jpg", "image/gif"]
                                    }
                                }
                            }
                        }
                    },
                    "app": {
                        "type": "kettle.app",
                        "options": {
                            "requestHandlers": {
                                "imageUploadHandler": {
                                    "type": "examples.uploadConfig.handler",
                                    "route": "/upload",
                                    "method": "post"
                                }
                            }
                        }
                    }
                }
            }
        }
    }
});

fluid.defaults("examples.uploadConfig.handler", {
    gradeNames: "kettle.request.http",
    requestMiddleware: {
        imageUpload: {
            middleware: "{server}.imageUpload"
        }
    },
    invokers: {
        handleRequest: "examples.uploadConfig.handleRequest"
    }
});

examples.uploadConfig.handleRequest = function (request) {
    var uploadedFileDetails = request.req.file;
    request.events.onSuccess.fire({
        message: fluid.stringTemplate("POST request received on path /upload; file %originalName uploaded to %uploadedPath", {originalName: uploadedFileDetails.originalname, uploadedPath: uploadedFileDetails.path})
    });
};

// Construct the server using the above config
examples.uploadConfig();

// Load the client to make a test request
require("./multipartForm-client.js");
