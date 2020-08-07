/*!
Kettle Data Source Tests

Copyright 2017-2018 OCAD University
Copyright 2012-2015 Raising the Floor - International

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
*/

"use strict";

var fluid = require("infusion"),
    kettle = require("../kettle.js"),
    fs = require("fs"),
    querystring = require("querystring"),
    jqUnit = fluid.require("node-jqunit", require, "jqUnit");

require("./shared/DataSourceTestUtils.js");

kettle.tests.dataSource.ensureDirectoryEmpty("%kettle/tests/data/writeable");

/** KETTLE-34 options resolution and merging test **/

fluid.defaults("kettle.tests.KETTLE34dataSource", {
    gradeNames: "kettle.dataSource.URL",
    url: "https://user:password@thing.available:997/path",
    headers: {
        "x-custom-header": "x-custom-value"
    },
    censorRequestOptionsLog: {
        auth: false
    }
});

fluid.defaults("kettle.tests.KETTLE34dataSource2", {
    gradeNames: "kettle.dataSource.URL",
    url: "http://127.0.0.1/device",
    port: 998
});


kettle.tests.dataSource.resolutionTests = [ {
    gradeName: "kettle.tests.KETTLE34dataSource",
    expectedOptions: {
        protocol: "https:",
        port: 999,
        auth: "user:password",
        path: "/path",
        method: "GET",
        host: "thing.available:997", // appears to be a parsing fault in url module
        family: 4,
        headers: {
            "x-custom-header": "x-custom-value",
            "x-custom-header2": "x-custom-value2"
        }
    },
    creatorArgs: {
        port: 998,
        family: 4
    },
    directOptions: {
        headers: {
            "x-custom-header2": "x-custom-value2"
        },
        port: 999
    }
}, {
    gradeName: "kettle.tests.KETTLE34dataSource2",
    expectedOptions: {
        protocol: "http:",
        port: 998,
        path: "/device",
        host: "127.0.0.1"
    }
}
];

kettle.tests.capturedHttpOptions = {};

kettle.tests.withMockHttp = function (toapply) {
    return function () {
        var httpRequest = kettle.npm.http.request;
        var httpsRequest = kettle.npm.https.request;
        kettle.tests.capturedHttpOptions = {};
        kettle.npm.http.request = kettle.npm.https.request = function (requestOptions) {
            kettle.tests.capturedHttpOptions = requestOptions;
            return {
                on: fluid.identity,
                end: fluid.identity
            };
        };
        try {
            toapply();
        } finally {
            kettle.npm.http.request = httpRequest;
            kettle.npm.https.request = httpsRequest;
        }
    };
};

kettle.tests.dataSource.resolutionTest = function (fixture) {
    jqUnit.test("KETTLE-34 request option resolution test", kettle.tests.withMockHttp(function () {
        var dataSource = fluid.invokeGlobalFunction(fixture.gradeName, [fixture.creatorArgs]);
        dataSource.get(null, fixture.directOptions);
        jqUnit.assertLeftHand("Resolved expected requestOptions", fixture.expectedOptions, kettle.tests.capturedHttpOptions);
    }));
};

fluid.each(kettle.tests.dataSource.resolutionTests, function (fixture) {
    kettle.tests.dataSource.resolutionTest(fixture);
});

/** KETTLE-73 censoring sensitive options test **/

fluid.defaults("kettle.tests.KETTLE73dataSource", {
    gradeNames: "kettle.dataSource.URL"
});

kettle.tests.censoringTests = [{
    url: "https://secret-user:secret-password@thing.available:997/path",
    headers: {
        Authorization: "secret-authorization",
        "X-unrelated-header": "998"
    },
    shouldNotApper: "secret",
    shouldAppear: ["997", "998"]
}, {
    url: "https://secret-user:secret-%25-password@thing.available:997/path",
    headers: {
        Authorization: "secret-%25-authorization",
        "X-unrelated-header": "998"
    },
    shouldNotAppear: "secret",
    shouldAppear: ["997", "998"]
}];

jqUnit.test("KETTLE-73 censoring test", kettle.tests.withMockHttp(function () {
    var memoryLog;
    var memoryLogger = function (args) {
        memoryLog.push(JSON.stringify(args.slice(1)));
    };
    fluid.loggingEvent.addListener(memoryLogger, "memoryLogger", "before:log");
    kettle.tests.censoringTests.forEach(function (fixture) {
        memoryLog = [];
        var that = kettle.tests.KETTLE73dataSource({url: fixture.url});
        that.get(null, {headers: fixture.headers});
        jqUnit.assertTrue("Secret information should not have been logged", memoryLog[0].indexOf(fixture.shouldNotAppear) === -1);
        fixture.shouldAppear.forEach(function (shouldAppear) {
            jqUnit.assertTrue("URL port and header should have been logged", memoryLog[0].indexOf(shouldAppear) !== -1);
        });
    });
    fluid.loggingEvent.removeListener("memoryLogger");
}));

/** KETTLE-38 writeable grade resolution test **/

fluid.defaults("kettle.tests.KETTLE38base", {
    gradeNames: "kettle.dataSource.URL",
    writable: true
});

fluid.defaults("kettle.tests.KETTLE38derived", {
    gradeNames: "kettle.tests.KETTLE38base"
});

jqUnit.test("KETTLE-38 derived writable dataSource test", function () {
    var dataSource = kettle.tests.KETTLE38derived();
    jqUnit.assertValue("Resolved writable grade via base grade", dataSource.set);
});

/** Form encoding test **/

kettle.tests.formencData = {
    "text1": "text default",
    "text2": "aωb"
};

fluid.defaults("kettle.tests.formencSource", {
    gradeNames: "kettle.dataSource.file.moduleTerms",
    path: "%kettle/tests/data/formenc.txt",
    components: {
        encoding: {
            type: "kettle.dataSource.encoding.formenc"
        }
    }
});

jqUnit.asyncTest("Reading file in formenc encoding", function () {
    var that = kettle.tests.formencSource();
    jqUnit.expect(1);
    that.get().then(function (result) {
        jqUnit.assertDeepEq("Received decoded result", kettle.tests.formencData, result);
        jqUnit.start();
    }, function (err) {
        jqUnit.fail("Got error " + JSON.stringify(err));
    });
});

fluid.defaults("kettle.tests.formencSourceWrite", {
    gradeNames: "kettle.dataSource.file.moduleTerms",
    path: "%kettle/tests/data/writeable/formenc.txt",
    writable: true,
    components: {
        encoding: {
            type: "kettle.dataSource.encoding.formenc"
        }
    }
});

jqUnit.asyncTest("Writing file in formenc encoding", function () {
    var that = kettle.tests.formencSourceWrite();
    jqUnit.expect(1);
    that.set(null, kettle.tests.formencData).then(function () {
        var written = fs.readFileSync(fluid.module.resolvePath("%kettle/tests/data/writeable/formenc.txt"), "utf8");
        var decoded = querystring.parse(written);
        jqUnit.assertDeepEq("Written decoded result", kettle.tests.formencData, decoded);
        jqUnit.start();
    }, function (err) {
        jqUnit.fail("Got error " + JSON.stringify(err));
    });
});


// Basic initialisation tests

kettle.tests.dataSource.testInit = function (dataSource) {
    jqUnit.expect(4);
    jqUnit.assertValue("Data source is initialized", dataSource);
    jqUnit.assertValue("Data source should have a get method", dataSource.get);
    jqUnit.assertUndefined("Data source should not have a set method by default", dataSource.set);
    jqUnit.assertDeepEq("Data source should have a termMap", {}, dataSource.options.termMap);
};


fluid.defaults("kettle.tests.dataSource.initTester", {
    gradeNames: "fluid.component",
    components: {
        urlDataSource: {
            type: "kettle.dataSource.URL"
        },
        couchDBDataSource: {
            type: "kettle.dataSource.URL",
            options: {
                gradeNames: "kettle.dataSource.CouchDB"
            }
        }
    }
});

jqUnit.test("DataSource basic init tests", function () {
    var initTester = kettle.tests.dataSource.initTester();
    kettle.tests.dataSource.testInit(initTester.urlDataSource);
    kettle.tests.dataSource.testInit(initTester.couchDBDataSource);
});


fluid.defaults("kettle.tests.dataSource.fileWithoutPath", {
    gradeNames: "kettle.dataSource.file"
});

jqUnit.test("DataSource without path", function () {
    jqUnit.expectFrameworkDiagnostic("DataSource without path", function () {
        var source = kettle.tests.dataSource.fileWithoutPath();
        source.get();
    }, ["without an option", "path"]);
});

// Attached URL resolver tests

kettle.tests.testUrlResolver = function (gradeName) {
    var dataSource = fluid.invokeGlobalFunction(gradeName);
    var resolved = dataSource.resolveUrl(dataSource.options.url, dataSource.options.termMap, dataSource.options.directModel);
    jqUnit.assertEquals(dataSource.options.message, resolved, dataSource.options.expected, resolved);
};

fluid.defaults("kettle.tests.dataSource.dynamicURL", {
    gradeNames: "kettle.dataSource.URL",
    url: "http://%expand/test.json",
    termMap: {
        expand: "%expand"
    },
    message: "URL resolver with URI escaping",
    directModel: {
        expand: "test with space"
    },
    expected: "http://test%20with%20space/test.json"
});

fluid.defaults("kettle.tests.dataSource.unescapedUrl", {
    gradeNames: "kettle.dataSource.URL",
    url: "http://%expand/test.json",
    termMap: {
        expand: "noencode:%expand"
    },
    message: "URL resolver with URI escaping",
    directModel: {
        expand: "test/with/slash"
    },
    expected: "http://test/with/slash/test.json"
});

jqUnit.test("Attached URLResolver tests", function () {
    kettle.tests.testUrlResolver("kettle.tests.dataSource.dynamicURL");
    kettle.tests.testUrlResolver("kettle.tests.dataSource.unescapedUrl");
});

jqUnit.onAllTestsDone.addListener(function () {
    kettle.tests.dataSource.ensureDirectoryEmpty("%kettle/tests/data/writeable");
});
