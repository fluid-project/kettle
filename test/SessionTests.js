/**
 * Kettle Session Support Tests
 *
 * Copyright 2013 OCAD University
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/GPII/kettle/LICENSE.txt
 */

/*global require, __dirname*/

var fluid = require("infusion"),
    path = require("path"),
    kettle = fluid.require(path.resolve(__dirname, "../kettle.js")),
    jqUnit = fluid.require("jqUnit"),
    configPath = path.resolve(__dirname, "./configs");

fluid.require(path.resolve(__dirname, "./utils/js/KettleTestUtils.js"));

fluid.defaults("kettle.tests.sessionServer", {
    gradeNames: ["fluid.littleComponent", "autoInit"],
    distributeOptions: {
        source: "{that}.options.validateToken",
        target: "{that sessionValidator}.options.invokers.validate"
    },
    validateToken: {
        funcName: "kettle.tests.validateToken"
    }
});

fluid.defaults("kettle.requests.request.handler.testSessionSocket", {
    gradeNames: ["fluid.littleComponent", "autoInit"],
    invokers: {
        handle: {
            funcName: "kettle.tests.testSessionSocket",
            args: ["{requestProxy}", "{request}.data"]
        }
    }
});

fluid.defaults("kettle.requests.request.handler.testSessionRequest", {
    gradeNames: ["fluid.littleComponent", "autoInit"],
    invokers: {
        handle: {
            funcName: "kettle.tests.testSessionRequest",
            args: ["{requestProxy}", "{request}.req.session"]
        }
    }
});

fluid.defaults("kettle.requests.request.handler.testSessionStart", {
    gradeNames: ["fluid.littleComponent", "autoInit"],
    invokers: {
        handle: {
            funcName: "kettle.tests.testSessionStart",
            args: [
                "{requestProxy}",
                "{request}.req.params.token",
                "{request}.req.session"
            ],
            dynamic: true
        }
    }
});

fluid.defaults("kettle.requests.request.handler.testSessionEnd", {
    gradeNames: ["fluid.littleComponent", "autoInit"],
    invokers: {
        handle: {
            funcName: "kettle.tests.testSessionEnd",
            args: [
                "{requestProxy}",
                "{request}.req.params.token",
                "{request}"
            ],
            dynamic: true
        }
    }
});

kettle.tests.token = 123;

kettle.tests.testSessionSocketModel = {
    test: true
};

kettle.tests.testSessionSuccessResponse = {
    success: true
};

kettle.tests.testSessionFailureResponse = {
    isError: true,
    message: "Session is invalid"
};

kettle.tests.validateToken = function (request) {
    return request.req.session && !!request.req.session.token;
};

kettle.tests.testSessionEnd = function (requestProxy, token, request) {
    var req = request.req;
    var res = request.res;
    jqUnit.assertTrue("The session end request was received.", true);
    jqUnit.assertEquals("Token matches the session token.",
        req.session.token, token);
    req.session.destroy(function () {
        res.clearCookie("kettle.sid");
        jqUnit.assertUndefined("Session is destroyed", req.session);
        res.send(200, kettle.tests.testSessionSuccessResponse);
    });
};

kettle.tests.testSessionStart = function (requestProxy, token, session) {
    jqUnit.assertTrue("The session start request was received.", true);
    session.token = token;
    requestProxy.events.onSuccess.fire(kettle.tests.testSessionSuccessResponse);
};

kettle.tests.testSessionRequest = function (requestProxy, session) {
    jqUnit.assertTrue("The request was received.", true);
    jqUnit.assertValue("Session is started.", session);
    jqUnit.assertEquals("Session is correct and has a current token.",
        kettle.tests.token, session.token);
    requestProxy.events.onSuccess.fire(kettle.tests.testSessionSuccessResponse);
};

kettle.tests.testSessionSocket = function (requestProxy, data) {
    jqUnit.assertDeepEq("Socket message data is correct",
        kettle.tests.testSessionSocketModel, data);
    requestProxy.events.onSuccess.fire(kettle.tests.testSessionSuccessResponse);
};


kettle.tests.testSessionStartSuccessResponse = function (data, headers) {
    kettle.tests.testSuccessResponse(data);
    jqUnit.assertValue("Cookie is set", headers["set-cookie"]);
};

kettle.tests.testSessionEndSuccessResponse = function (data, headers) {
    kettle.tests.testSuccessResponse(data);
};

function testResponse (expected, data) {
    data = typeof data === "string" ? JSON.parse(data) : data;
    jqUnit.assertDeepEq("Request response is correct",
        expected, data);
}

kettle.tests.testFailureResponse = function (data) {
    testResponse(kettle.tests.testSessionFailureResponse, data);
};

kettle.tests.testSuccessResponse = function (data) {
    testResponse(kettle.tests.testSessionSuccessResponse, data);
};

var testDefs = [{
    name: "Session tests.",
    expect: 12,
    config: {
        nodeEnv: "session",
        configPath: configPath
    },
    components: {
        // ioRequest: {
        //     type: "kettle.tests.request.io",
        //     options: {
        //         requestOptions: {
        //             path: "/testSessionSocket"
        //         }
        //     }
        // },
        httpTestSessionStart: {
            type: "kettle.tests.request.http",
            options: {
                requestOptions: {
                    path: "/testSessionStart/%token"
                },
                termMap: {
                    token: kettle.tests.token
                }
            }
        },
        httpTestSessionEnd: {
            type: "kettle.tests.request.http",
            options: {
                requestOptions: {
                    path: "/testSessionEnd/%token"
                },
                termMap: {
                    token: kettle.tests.token
                }
            }
        },
        httpTestSessionRequest: {
            type: "kettle.tests.request.http",
            options: {
                requestOptions: {
                    path: "/testSessionRequest"
                }
            }
        }
    },
    sequence: [{
        func: "{httpTestSessionRequest}.send"
    }, {
        event: "{httpTestSessionRequest}.events.onComplete",
        listener: "kettle.tests.testFailureResponse"
    }, {
        func: "{httpTestSessionStart}.send"
    }, {
        event: "{httpTestSessionStart}.events.onComplete",
        listener: "kettle.tests.testSessionStartSuccessResponse"
    }, {
        func: "{httpTestSessionRequest}.send"
    }, {
        event: "{httpTestSessionRequest}.events.onComplete",
        listener: "kettle.tests.testSuccessResponse"
    }, {
        func: "{httpTestSessionEnd}.send"
    }, {
        event: "{httpTestSessionEnd}.events.onComplete",
        listener: "kettle.tests.testSessionEndSuccessResponse"
    // }, {
    //     func: "{ioRequest}.send",
    //     args: kettle.tests.testSessionSocketModel
    // }, {
    //     event: "{ioRequest}.events.onComplete",
    //     listener: "kettle.tests.testSuccessResponse"
    }]
}];

kettle.tests.runTests(testDefs);
