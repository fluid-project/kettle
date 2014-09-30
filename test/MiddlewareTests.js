/**
 * Kettle Middleware Tests
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

kettle.loadTestingSupport();

fluid.defaults("kettle.requests.request.handler.testGet", {
    gradeNames: ["fluid.littleComponent", "autoInit"],
    invokers: {
        handle: {
            funcName: "kettle.tests.testGetCORS",
            args: "{requestProxy}"
        }
    }
});

fluid.defaults("kettle.tests.CORS_noCred", {
    gradeNames: ["autoInit", "kettle.use.CORS"],
    distributeOptions: {
        source: "{that}.options.credentials",
        target: "{that > CORS}.options.credentials"
    },
    credentials: "false"
});

kettle.tests.testCORSOrigin = "localhost:8080";

fluid.defaults("kettle.tests.CORS_origin", {
    gradeNames: ["autoInit", "kettle.use.CORS"],
    distributeOptions: {
        source: "{that}.options.origin",
        target: "{that > CORS}.options.origin"
    },
    origin: [kettle.tests.testCORSOrigin]
});

kettle.tests.testGetCORS = function (requestProxy) {
    jqUnit.assertTrue("The request was received.", true);
    requestProxy.events.onSuccess.fire({
        success: true
    });
};

kettle.tests.testCORSResponse = function (data, headers) {
    kettle.tests.testResponseData(data, headers);
    kettle.tests.testCORSResponseHeaders(data, headers);
};

kettle.tests.testCORSResponse_NoCred = function (data, headers) {
    kettle.tests.testResponseData(data, headers);
    kettle.tests.testCORSResponseHeaders(data, headers, "false");
};

kettle.tests.testCORSResponse_Origin = function (data, headers) {
    kettle.tests.testResponseData(data, headers);
    kettle.tests.testCORSResponseHeaders(data, headers, "true", "null");
};

kettle.tests.testResponseData = function (data) {
    jqUnit.assertDeepEq("The response is correct.", {
        success: true
    }, JSON.parse(data));
};

kettle.tests.testCORSResponseHeaders = function (data, headers, credentials, origin) {
    jqUnit.assertEquals("CORS origin is correct",
        origin || kettle.tests.testCORSOrigin,
        headers["access-control-allow-origin"]);
    jqUnit.assertEquals("CORS headers are correct", credentials || "true",
        headers["access-control-allow-credentials"]);
    jqUnit.assertEquals("CORS headers are correct", "X-Requested-With,Content-Type",
        headers["access-control-allow-headers"]);
    jqUnit.assertEquals("CORS methods are correct", "GET,OPTIONS",
        headers["access-control-allow-methods"]);
};

kettle.tests.testNoCORSResponse = function (data, headers) {
    kettle.tests.testResponseData(data, headers);
    jqUnit.assertUndefined("CORS origin is correct",
        headers["access-control-allow-origin"]);
    jqUnit.assertUndefined("CORS headers are correct",
        headers["access-control-allow-headers"]);
    jqUnit.assertUndefined("CORS methods are correct",
        headers["access-control-allow-methods"]);
};

var testDefs = [{
    name: "CORS middleware tests",
    expect: 10,
    config: {
        nodeEnv: "CORS",
        configPath: configPath
    },
    components: {
        corsRequest: {
            type: "kettle.test.request.http",
            options: {
                requestOptions: {
                    headers: {
                        "Origin": kettle.tests.testCORSOrigin
                    }
                }
            }
        },
        optionsCorsRequest: {
            type: "kettle.test.request.http",
            options: {
                requestOptions: {
                    method: "OPTIONS",
                    headers: {
                        "Origin": kettle.tests.testCORSOrigin
                    }
                }
            }
        }
    },
    sequence: [{
        func: "{corsRequest}.send"
    }, {
        event: "{corsRequest}.events.onComplete",
        listener: "kettle.tests.testCORSResponse"
    }, {
        func: "{optionsCorsRequest}.send"
    }, {
        event: "{optionsCorsRequest}.events.onComplete",
        listener: "kettle.tests.testCORSResponseHeaders"
    }]
}, {
    name: "CORS middleware no credential tests",
    expect: 6,
    config: {
        nodeEnv: "CORS_noCred",
        configPath: configPath
    },
    components: {
        corsRequest: {
            type: "kettle.test.request.http",
            options: {
                requestOptions: {
                    headers: {
                        "Origin": kettle.tests.testCORSOrigin
                    }
                }
            }
        }
    },
    sequence: [{
        func: "{corsRequest}.send"
    }, {
        event: "{corsRequest}.events.onComplete",
        listener: "kettle.tests.testCORSResponse_NoCred"
    }]
}, {
    name: "CORS middleware custom origin tests",
    expect: 12,
    config: {
        nodeEnv: "CORS_origin",
        configPath: configPath
    },
    components: {
        corsRequest: {
            type: "kettle.test.request.http",
            options: {
                requestOptions: {
                    headers: {
                        "Origin": kettle.tests.testCORSOrigin
                    }
                }
            }
        },
        invalidCorsRequest: {
            type: "kettle.test.request.http",
            options: {
                requestOptions: {
                    headers: {
                        "Origin": "invaliddomain.com"
                    }
                }
            }
        }
    },
    sequence: [{
        func: "{corsRequest}.send"
    }, {
        event: "{corsRequest}.events.onComplete",
        listener: "kettle.tests.testCORSResponse"
    }, {
        func: "{invalidCorsRequest}.send"
    }, {
        event: "{invalidCorsRequest}.events.onComplete",
        listener: "kettle.tests.testCORSResponse_Origin"
    }]
}, {
    name: "No CORS middleware tests",
    expect: 5,
    config: {
        nodeEnv: "noCORS",
        configPath: configPath
    },
    components: {
        request: {
            type: "kettle.test.request.http"
        }
    },
    sequence: [{
        func: "{request}.send"
    }, {
        event: "{request}.events.onComplete",
        listener: "kettle.tests.testNoCORSResponse"
    }]
}];

module.exports = kettle.test.bootstrapServer(testDefs);
