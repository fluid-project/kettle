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

"use strict";

var fluid = require("infusion"),
    path = require("path"),
    kettle = require("../kettle.js"),
    jqUnit = fluid.require("jqUnit"),
    configPath = path.resolve(__dirname, "./configs");

fluid.defaults("kettle.tests.sessionServer", {
    gradeNames: ["fluid.littleComponent", "autoInit"],
    distributeOptions: {
        source: "{that}.options.validateToken",
        target: "{that > sessionManager}.options.invokers.validate"
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
            args: ["{requestProxy}", "{request}"],
            dynamic: true
        }
    }
});

fluid.defaults("kettle.requests.request.handler.testSessionRequest", {
    gradeNames: ["fluid.littleComponent", "autoInit"],
    invokers: {
        handle: {
            funcName: "kettle.tests.testSessionRequest",
            args: ["{requestProxy}", "{request}.session.session"],
            dynamic: true
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
                "{request}.session.session"
            ],
            dynamic: true
        }
    }
});

fluid.defaults("kettle.requests.request.handler.testSessionEnd", {
    gradeNames: ["fluid.eventedComponent", "autoInit"],
    listeners: {
        "{request}.session.events.afterDestroySession": [
            "{that}.clearCookie",
            "{that}.testSessionClear"
        ]
    },
    invokers: {
        clearCookie: {
            funcName: "kettle.tests.clearCookie",
            args: "{request}.res",
            dynamic: true
        },
        testSessionClear: {
            funcName: "kettle.tests.testSessionClear",
            args: ["{request}.req", "{request}.res"],
            dynamic: true
        },
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

fluid.defaults("kettle.requests.request.handler.testNoneSessionRequest", {
    gradeNames: ["fluid.littleComponent", "autoInit"],
    invokers: {
        handle: {
            funcName: "kettle.tests.testNoneNoSessionRequest",
            args: "{requestProxy}"
        }
    }
});

fluid.defaults("kettle.requests.request.handler.testNoSessionRequest", {
    gradeNames: ["fluid.littleComponent", "autoInit"],
    invokers: {
        handle: {
            funcName: "kettle.tests.testNoneNoSessionRequest",
            args: "{requestProxy}"
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
    return !!request.session && !!request.session.session.token;
};

kettle.tests.testSessionEnd = function (requestProxy, token, request) {
    jqUnit.assertTrue("The session end request was received.", true);
    jqUnit.assertEquals("Token matches the session token.", request.session.session.token, token);
    request.session.events.onDestroySession.fire();
};

kettle.tests.testSessionClear = function (req, res) {
    jqUnit.assertUndefined("Session is destroyed", req.session);
    res.send(200, kettle.tests.testSessionSuccessResponse);
};

kettle.tests.clearCookie = function (res) {
    res.clearCookie("kettle.sid");
};

kettle.tests.testSessionStart = function (requestProxy, token, session) {
    jqUnit.assertTrue("The session start request was received.", true);
    session.token = token;
    requestProxy.events.onSuccess.fire(kettle.tests.testSessionSuccessResponse);
};

kettle.tests.testSessionRequest = function (requestProxy, session) {
    jqUnit.assertTrue("The request was received.", true);
    jqUnit.assertValue("Session exists.", session);
    jqUnit.assertEquals("Session is correct and has a current token.",
        kettle.tests.token, session.token);
    requestProxy.events.onSuccess.fire(kettle.tests.testSessionSuccessResponse);
};

kettle.tests.testNoneNoSessionRequest = function (requestProxy) {
    jqUnit.assertTrue("The request was received.", true);
    requestProxy.events.onSuccess.fire(kettle.tests.testSessionSuccessResponse);
};

kettle.tests.testSessionSocket = function (requestProxy, request) {
    jqUnit.assertValue("Session exists.", request.session);
    jqUnit.assertEquals("Session is correct and has a current token.",
        kettle.tests.token, request.session.session.token);
    jqUnit.assertDeepEq("Socket message data is correct",
        kettle.tests.testSessionSocketModel, request.data);
    requestProxy.events.onSuccess.fire(kettle.tests.testSessionSuccessResponse);
};

kettle.tests.testSessionStartSuccessResponse = function (data, headers, cookies, signedCookies) {
    kettle.tests.testSuccessResponse(data);
    jqUnit.assertValue("Cookie is set", headers["set-cookie"]);
    jqUnit.assertTrue("kettle session cookie is set", !!signedCookies["kettle.sid"]);
};

kettle.tests.testSessionEndSuccessResponse = function (data, headers, cookies) {
    kettle.tests.testSuccessResponse(data);
    jqUnit.assertEquals("kettle session cookie is unset", "", cookies["kettle.sid"]);
};

function testResponse (expected, data) {
    data = typeof data === "string" ? JSON.parse(data) : data;
    jqUnit.assertDeepEq("Request response is correct", expected, data);
}

kettle.tests.testFailureResponse = function (data) {
    testResponse(kettle.tests.testSessionFailureResponse, data);
};

kettle.tests.testInvalidIoRequest = function (/*reason*/) {
    jqUnit.assertTrue("Authorization failed as expected", true);
};

kettle.tests.testSuccessResponse = function (data) {
    testResponse(kettle.tests.testSessionSuccessResponse, data);
};

var testDefs = [{
    name: "Session tests.",
    expect: 27,
    config: {
        nodeEnv: "session",
        configPath: configPath
    },
    components: {
        invalidIoRequest: {
            type: "kettle.test.request.ioCookie",
            options: {
                requestOptions: {
                    path: "/testSessionSocket"
                }
            }
        },
        ioRequest: {
            type: "kettle.test.request.ioCookie",
            options: {
                requestOptions: {
                    path: "/testSessionSocket"
                }
            }
        },
        httpTestSessionStart: {
            type: "kettle.test.request.httpCookie",
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
            type: "kettle.test.request.httpCookie",
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
            type: "kettle.test.request.httpCookie",
            options: {
                requestOptions: {
                    path: "/testSessionRequest"
                }
            }
        },
        httpTestNoneSessionRequest: {
            type: "kettle.test.request.httpCookie",
            options: {
                requestOptions: {
                    path: "/testNoneSessionRequest"
                }
            }
        },
        httpTestNoSessionRequest: {
            type: "kettle.test.request.httpCookie",
            options: {
                requestOptions: {
                    path: "/testNoSessionRequest"
                }
            }
        }
    },
    sequence: [{
        func: "{httpTestNoneSessionRequest}.send"
    }, {
        event: "{httpTestNoneSessionRequest}.events.onComplete",
        listener: "kettle.tests.testSuccessResponse"
    }, {
        func: "{httpTestNoSessionRequest}.send"
    }, {
        event: "{httpTestNoSessionRequest}.events.onComplete",
        listener: "kettle.tests.testSuccessResponse"
    }, {
        func: "{invalidIoRequest}.send",
        args: "You shall not pass!!"
    }, {
        event: "{invalidIoRequest}.events.onError",
        listener: "kettle.tests.testInvalidIoRequest"
    }, {
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
        func: "{ioRequest}.send",
        args: kettle.tests.testSessionSocketModel
    }, {
        event: "{ioRequest}.events.onComplete",
        listener: "kettle.tests.testSuccessResponse"
    }, {
        func: "{httpTestNoneSessionRequest}.send"
    }, {
        event: "{httpTestNoneSessionRequest}.events.onComplete",
        listener: "kettle.tests.testSuccessResponse"
    }, {
        func: "{httpTestNoSessionRequest}.send"
    }, {
        event: "{httpTestNoSessionRequest}.events.onComplete",
        listener: "kettle.tests.testSuccessResponse"
    }, {
        func: "{httpTestSessionEnd}.send"
    }, {
        event: "{httpTestSessionEnd}.events.onComplete",
        listener: "kettle.tests.testSessionEndSuccessResponse"
    }]
}];

module.exports = kettle.test.bootstrapServer(testDefs);
