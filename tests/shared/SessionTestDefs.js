/**
 * Kettle Session Support Test Definitions
 *
 * Copyright 2013 OCAD University
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 *
 * You may obtain a copy of the License at
 * https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
 */

"use strict";

var fluid = require("infusion"),
    kettle = require("../../kettle.js"),
    jqUnit = fluid.registerNamespace("jqUnit");

kettle.loadTestingSupport();

fluid.defaults("kettle.tests.session.none.handler", {
    gradeNames: ["kettle.request.http"],
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.session.none.handleRequest"
        }
    }
});

kettle.tests.session.none.handleRequest = function (request) {
    jqUnit.assertTrue("The request was received", true);
    request.events.onSuccess.fire(kettle.tests.session.response.success);
};


fluid.defaults("kettle.tests.middleware.validateSession", {
    gradeNames: "kettle.middleware",
    invokers: {
        handle: "kettle.tests.session.validate"
    }
});

kettle.tests.session.validate = function (request) {
    var token = fluid.get(request, ["req", "session", "token"]);
    var togo = fluid.promise();
    if (token === undefined) {
        request.events.onDestroySession.fire();
        togo.reject({
            statusCode: 403,
            message: "Session is invalid"
        });
    } else {
        togo.resolve();
    }
    return togo;
};

fluid.defaults("kettle.tests.session.handler.validating", {
    components: {
        validator: {
            type: "kettle.tests.middleware.validateSession"
        }
    },
    requestMiddleware: {
        validate: {
            middleware: "{handler}.validator",
            priority: "after:session"
        }
    }
});

fluid.defaults("kettle.tests.session.existing.handler", {
    gradeNames: ["kettle.request.http", "kettle.request.sessionAware", "kettle.tests.session.handler.validating"],

    invokers: {
        handleRequest: {
            funcName: "kettle.tests.session.existing.handleRequest",
            args: ["{request}", "{request}.req.session"]
        }
    }
});

kettle.tests.session.existing.handleRequest = function (request, session) {
    jqUnit.assertTrue("The request was received", true);
    jqUnit.assertValue("Session exists", session);
    jqUnit.assertEquals("Session is correct and has a current token", kettle.tests.session.token, session.token);
    var response = fluid.extend(true, {
        token: session.token
    }, kettle.tests.session.response.success);
    request.events.onSuccess.fire(response);
};

fluid.defaults("kettle.tests.session.start.handler", {
    gradeNames: ["kettle.request.http", "kettle.request.sessionAware"],
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.session.start.handleRequest"
        }
    }
});

kettle.tests.session.start.handleRequest = function (request) {
    var token = request.req.params.token;
    jqUnit.assertEquals("The session start request was received with token", kettle.tests.session.token, token);
    request.req.session.token = token;
    request.events.onSuccess.fire(kettle.tests.session.response.success);
};


fluid.defaults("kettle.tests.session.end.handler", {
    gradeNames: ["kettle.request.http", "kettle.request.sessionAware"],
    listeners: {
        "onDestroySession.clearCookie": {
            priority: "after:destroy",
            listener: "kettle.tests.session.clearCookie",
            args: "{request}.res"
        },
        "onDestroySession.testClear": {
            priority: "after:clearCookie",
            funcName: "kettle.tests.session.testSessionClear",
            args: "{request}"
        }
    },
    invokers: {
        handleRequest: {
            funcName: "kettle.tests.session.end.handleRequest"
        }
    }
});

kettle.tests.session.clearCookie = function (res) {
    res.clearCookie("kettle.sid");
};


kettle.tests.session.testSessionClear = function (request) {
    jqUnit.assertUndefined("Session is destroyed", request.req.session);
    request.events.onSuccess.fire(kettle.tests.session.response.success);
};


kettle.tests.session.end.handleRequest = function (request) {
    var token = request.req.params.token;
    jqUnit.assertEquals("The session end request was received with token", kettle.tests.session.token, token);
    jqUnit.assertEquals("Token matches the session token", request.req.session.token, token);
    request.events.onDestroySession.fire();
};


kettle.tests.session.token = "123";

fluid.registerNamespace("kettle.tests.session.response");

kettle.tests.session.response.success = {
    success: true
};

kettle.tests.session.response.midSuccess = {
    success: true,
    token: kettle.tests.session.token
};

kettle.tests.session.response.failure = {
    isError: true,
    message: "Session is invalid"
};



kettle.tests.session.testStartSuccessResponse = function (data, request, parsed) {
    kettle.test.assertJSONResponse({
        message: "Successful session start response",
        expected: kettle.tests.session.response.success,
        string: data,
        request: request
    });
    jqUnit.assertValue("Cookie is set", request.nativeResponse.headers["set-cookie"]);
    jqUnit.assertValue("kettle session cookie is set", parsed.signedCookies["kettle.sid"]);
};

kettle.tests.session.testEndSuccessResponse = function (data, request, parsed) {
    kettle.test.assertJSONResponse({
        message: "Successful session end response",
        expected: kettle.tests.session.response.success,
        string: data,
        request: request
    });
    jqUnit.assertEquals("kettle session cookie is unset", "", parsed.cookies["kettle.sid"]);
};


kettle.tests.session.testDefs = {
    name: "Session tests",
    expect: 24,
    config: {
        configName: "kettle.tests.session.config",
        configPath: "%kettle/tests/configs"
    },
    components: {
        httpTestNoSessionRequest: {
            type: "kettle.test.request.httpCookie",
            options: {
                path: "/testNoSessionRequest"
            }
        },
        httpTestExistingSessionRequest: {
            type: "kettle.test.request.httpCookie",
            options: {
                path: "/testExistingSessionRequest"
            }
        },
        httpTestSessionStart: {
            type: "kettle.test.request.httpCookie",
            options: { // Test supplying URL templating via dynamic arguments
                path: "/testSessionStart/%token"
            }
        },
        httpTestExistingSessionRequest2: {
            type: "kettle.test.request.httpCookie",
            options: {
                path: "/testExistingSessionRequest"
            }
        },
        httpTestNoSessionRequest2: {
            type: "kettle.test.request.httpCookie",
            options: {
                path: "/testNoSessionRequest"
            }
        },
        httpTestSessionEnd: {
            type: "kettle.test.request.httpCookie",
            options: {
                path: "/testSessionEnd/%token",
                termMap: {
                    token: kettle.tests.session.token
                }
            }
        }
    },
    sequence: [{
        func: "{httpTestNoSessionRequest}.send"
    }, {
        event: "{httpTestNoSessionRequest}.events.onComplete",
        listener: "kettle.test.assertJSONResponse",
        args: {
            message: "Standard response from request requiring no session",
            expected: kettle.tests.session.response.success,
            string: "{arguments}.0",
            request: "{httpTestNoSessionRequest}"
        }
    }, {
        func: "{httpTestExistingSessionRequest}.send"
    }, {
        event: "{httpTestExistingSessionRequest}.events.onComplete",
        listener: "kettle.test.assertJSONResponse",
        args: {
            message: "Error response from request requiring session without one",
            expected: kettle.tests.session.response.failure,
            statusCode: 403,
            string: "{arguments}.0",
            request: "{httpTestExistingSessionRequest}"
        }
    }, {
        func: "{httpTestSessionStart}.send",
        args: [null, {
            termMap: {
                token: kettle.tests.session.token
            }
        }]
    }, {
        event: "{httpTestSessionStart}.events.onComplete",
        listener: "kettle.tests.session.testStartSuccessResponse"
    }, {
        func: "{httpTestExistingSessionRequest2}.send"
    }, {
        event: "{httpTestExistingSessionRequest2}.events.onComplete",
        listener: "kettle.test.assertJSONResponse",
        args: {
            message: "Successful mid-session response with state captured from former URL",
            expected: kettle.tests.session.response.midSuccess,
            string: "{arguments}.0",
            request: "{httpTestExistingSessionRequest2}"
        }
    }, {
        func: "{httpTestNoSessionRequest2}.send"
    }, {
        event: "{httpTestNoSessionRequest2}.events.onComplete",
        listener: "kettle.test.assertJSONResponse",
        args: {
            message: "Standard response from request requiring no session when one is allocated",
            expected: kettle.tests.session.response.success,
            string: "{arguments}.0",
            request: "{httpTestNoSessionRequest2}"
        }
    }, {
        func: "{httpTestSessionEnd}.send"
    }, {
        event: "{httpTestSessionEnd}.events.onComplete",
        listener: "kettle.tests.session.testEndSuccessResponse"
    }]
};
