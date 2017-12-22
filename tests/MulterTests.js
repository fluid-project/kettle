/**
 * Kettle Multer Middleware Tests
 *
 * Copyright 2017 OCAD University
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    kettle = require("../kettle.js"),
    jqUnit = fluid.registerNamespace("jqUnit");

kettle.loadTestingSupport();

fluid.registerNamespace("kettle.tests.multer");

fluid.defaults("kettle.tests.multer.handler.single", {
    gradeNames: "kettle.request.http",
    requestMiddleware: {
        "multerSingle": {
            middleware: "{server}.infusionMulterSingle"
        }
    },
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.multerHandlerSingle"
        }
    }
});

// Sends the info about the uploaded file
kettle.tests.multerHandlerSingle = function (request) {
    request.events.onSuccess.fire(request.req.file);
};

fluid.defaults("kettle.tests.multer.handler.array", {
    gradeNames: "kettle.request.http",
    requestMiddleware: {
        "multerArray": {
            middleware: "{server}.infusionMulterArray"
        }
    },
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.multerHandlerArray"
        }
    }
});

// Sends the info about the uploaded files
kettle.tests.multerHandlerArray = function (request) {
    request.events.onSuccess.fire(request.req.files);
};

fluid.defaults("kettle.tests.multer.handler.fields", {
    gradeNames: "kettle.request.http",
    requestMiddleware: {
        "multerFields": {
            middleware: "{server}.infusionMulterFields"
        }
    },
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.multerHandlerField"
        }
    }
});

kettle.tests.multerHandlerField = function (request) {
    request.events.onSuccess.fire({body: request.req.body, files: request.req.files});
};


fluid.defaults("kettle.tests.multer.handler.imageOnly", {
    gradeNames: "kettle.request.http",
    requestMiddleware: {
        "multerImageOnly": {
            middleware: "{server}.infusionMulterImageOnly"
        }
    },
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.multerHandlerSingle"
        }
    }
});

// Filter function
kettle.tests.multer.getImageOnlyFilter = function () {
    return function (req, file, cb) {
        var acceptedMimeTypes = ["image/png", "image/jpg", "image/gif"];
        var isImage = fluid.contains(acceptedMimeTypes, file.mimetype);
        cb(null, isImage);
    }
};

kettle.tests["multer"].testDefs = [{
    name: "Multer tests",
    expect: 25,
    config: {
        configName: "kettle.tests.multer.config",
        configPath: "%kettle/tests/configs"
    },
    components: {
        singleFileUpload: {
            type: "kettle.test.request.formData",
            options: {
                path: "/multer-single",
                method: "POST",
                formData: {
                    files: {
                        "file": "./tests/data/multer/test.txt"
                    }
                }
            }
        },
        arrayFileUpload: {
            type: "kettle.test.request.formData",
            options: {
                path: "/multer-array",
                method: "POST",
                formData: {
                    files: {
                        "files": ["./tests/data/multer/test.txt", "./tests/data/multer/test.md"]
                    }
                }
            }
        },
        arrayFileUploadTooMany: {
            type: "kettle.test.request.formData",
            options: {
                path: "/multer-array",
                method: "POST",
                formData: {
                    files: {
                        "files": ["./tests/data/multer/test.txt", "./tests/data/multer/test.md", "./tests/data/multer/test.png"]
                    }
                }
            }
        },
        fieldFileUpload: {
            type: "kettle.test.request.formData",
            options: {
                path: "/multer-fields",
                method: "POST",
                formData: {
                    files: {
                        "textFiles": ["./tests/data/multer/test.txt", "./tests/data/multer/test.md"],
                        "binaryFile": "./tests/data/multer/test.png"
                    },
                    fields: {
                        "projectName": "kettle"
                    }
                }
            }
        },
        imageOnlySuccessfulUpload: {
            type: "kettle.test.request.formData",
            options: {
                path: "/multer-image-only",
                method: "POST",
                formData: {
                    files: {
                        "image": "./tests/data/multer/test.png"
                    }
                }
            }
        },
        imageOnlyFailedUpload: {
            type: "kettle.test.request.formData",
            options: {
                path: "/multer-image-only",
                method: "POST",
                formData: {
                    files: {
                        "image": "./tests/data/multer/test.txt"
                    }
                }
            }
        }
    },
    sequence: [{
        func: "{singleFileUpload}.send"
    }, {
        event: "{singleFileUpload}.events.onComplete",
        listener: "kettle.test.testMulterSingle"
    },{
        func: "{arrayFileUpload}.send"
    },{
        event: "{arrayFileUpload}.events.onComplete",
        listener: "kettle.test.testMulterArray"
    },{
        func: "{arrayFileUploadTooMany}.send"
    },{
        event: "{arrayFileUploadTooMany}.events.onComplete",
        listener: "kettle.test.testMulterArrayTooMany"
    }, {
        func: "{fieldFileUpload}.send"
    }, {
        event: "{fieldFileUpload}.events.onComplete",
        listener: "kettle.test.testMulterFields"
    }, {
        func: "{imageOnlySuccessfulUpload}.send"
    }, {
        event: "{imageOnlySuccessfulUpload}.events.onComplete",
        listener: "kettle.test.testMulterImageOnlyFilterSuccess"
    }, {
        func: "{imageOnlyFailedUpload}.send"
    }, {
        event: "{imageOnlyFailedUpload}.events.onComplete",
        listener: "kettle.test.testMulterImageOnlyFilterFailed"
    }]
}];

kettle.test.testMulterSingleSpec = {
    fieldname: "file",
    originalname: "test.txt",
    mimetype: "text/plain"
};

kettle.test.testMulterArraySpec = [
    {
        fieldname: "files",
        originalname: "test.txt",
        mimetype: "text/plain"
    },
    {
        fieldname: "files",
        originalname: "test.md",
        mimetype: "text/markdown"
    }
];

kettle.test.testMulterFieldSpec = {
    body: {
        projectName: "kettle"
    },
    files: {
        textFiles: [
            {
                fieldname: "textFiles",
                originalname: "test.txt",
                mimetype: "text/plain"
            },
            {
                fieldname: "textFiles",
                originalname: "test.md",
                mimetype: "text/markdown"
            }
        ],
        binaryFile: [
            {
                fieldname: "binaryFile",
                originalname: "test.png",
                mimetype: "image/png"
            }
        ]
    }
};

kettle.test.testMulterImageOnlyFilterSuccessSpec = {
    fieldname: "image",
    originalname: "test.png",
    mimetype: "image/png"
};

kettle.test.multerSingleFileTester = function (fileInfo, singleSpec) {
    fluid.each(singleSpec, function (specValue, specKey) {
        var message = fluid.stringTemplate("Expected value at %specKey of %specValue is present", {specKey: specKey, specValue: specValue});
        jqUnit.assertEquals(message, specValue, fileInfo[specKey]);
    });
};

kettle.test.multerArrayTester = function (filesInfo, arraySpec) {
    fluid.each(arraySpec, function (arraySpecItem, arraySpecItemIdx) {
        kettle.test.multerSingleFileTester(filesInfo[arraySpecItemIdx], arraySpecItem);
    });
};

kettle.test.multerFieldsTester = function (body, filesInfo, fieldsSpec) {
    jqUnit.assertDeepEq("Body of spec and body of multer request are identical", fieldsSpec.body, body);
    fluid.each(fieldsSpec.files, function (fieldsSpecItem, fieldsSpecItemKey) {
        kettle.test.multerArrayTester(filesInfo[fieldsSpecItemKey], fieldsSpecItem);
    });
};

kettle.test.testMulterSingle = function (fileInfo) {
    var parsedFileInfo = JSON.parse(fileInfo);
    kettle.test.multerSingleFileTester(parsedFileInfo, kettle.test.testMulterSingleSpec);
};

kettle.test.testMulterArray = function (filesInfo) {
    var parsedFilesInfo = JSON.parse(filesInfo);
    kettle.test.multerArrayTester(parsedFilesInfo, kettle.test.testMulterArraySpec);
};

kettle.test.testMulterArrayTooMany = function (filesInfo) {
    var parsedFilesInfo = JSON.parse(filesInfo);
    jqUnit.assertTrue("Trying to upload more files than the maxcount throws an error", parsedFilesInfo.isError);
    jqUnit.assertEquals("Error code is expected multer LIMIT_UNEXPECTED_FILE code", "LIMIT_UNEXPECTED_FILE", parsedFilesInfo.code)
};

kettle.test.testMulterFields = function (req) {
    var parsedReq = JSON.parse(req);
    var parsedBody = parsedReq.body;
    var parsedFilesInfo = parsedReq.files;
    kettle.test.multerFieldsTester(parsedBody, parsedFilesInfo, kettle.test.testMulterFieldSpec);

};

kettle.test.testMulterImageOnlyFilterSuccess = function (fileInfo) {
    var parsedFileInfo = JSON.parse(fileInfo);
    kettle.test.multerSingleFileTester(parsedFileInfo, kettle.test.testMulterImageOnlyFilterSuccessSpec);
};

kettle.test.testMulterImageOnlyFilterFailed = function (fileInfo) {
    jqUnit.assertEquals("File info is empty - non-image upload was rejected by filter", "", fileInfo);
};

kettle.test.bootstrapServer(kettle.tests["multer"].testDefs);
