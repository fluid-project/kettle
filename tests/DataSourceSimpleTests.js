/*!
Kettle Data Source Tests

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
     http = require("http"),
     jqUnit = fluid.require("node-jqunit", require, "jqUnit");
     
require("./shared/DataSourceTestUtils.js");

kettle.tests.dataSource.ensureWriteableEmpty();

fluid.defaults("kettle.tests.KETTLE34dataSource", {
    gradeNames: "kettle.dataSource.URL",
    url: "https://user:password@thing.available:997/path",
    headers: {
        "x-custom-header": "x-custom-value"
    }
});

fluid.defaults("kettle.tests.KETTLE34dataSource2", {
    gradeNames: "kettle.dataSource.URL",
    url: "http://localhost/device",
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
        host: "localhost"
    }
}
];

kettle.tests.dataSource.resolutionTest = function (fixture) {
    jqUnit.test("KETTLE-34 request option resolution test", function () {
        var httpRequest = http.request,
            capturedOptions;
        http.request = function (requestOptions) {
            capturedOptions = requestOptions;
            return {
                on: fluid.identity,
                end: fluid.identity
            };
        };
        try {
            var dataSource = fluid.invokeGlobalFunction(fixture.gradeName, [fixture.creatorArgs]);
            dataSource.get(null, fixture.directOptions);
            jqUnit.assertLeftHand("Resolved expected requestOptions", fixture.expectedOptions, capturedOptions);
        } finally {
            http.request = httpRequest;
        }
    });
};

fluid.each(kettle.tests.dataSource.resolutionTests, function (fixture) {
    kettle.tests.dataSource.resolutionTest(fixture);
});




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
    jqUnit.assertValue("Data source is initialized", dataSource);
    jqUnit.assertValue("Data source should have a get method", dataSource.get);
    jqUnit.assertUndefined("Data source should not have a set method by default", dataSource.set);
    jqUnit.assertDeepEq("Data source should have a termMap", {}, dataSource.options.termMap);
};


fluid.defaults("kettle.tests.dataSource.initTester", {
    gradeNames: ["fluid.test.testEnvironment"],
    components: {
        urlDataSource: {
            type: "kettle.dataSource.URL"
        },
        couchDBDataSource: {
            type: "kettle.dataSource.URL",
            options: {
                gradeNames: "kettle.dataSource.CouchDB"
            }
        },
        testCases: {
            type: "kettle.tests.dataSource.initCases"
        }
    }
});


fluid.defaults("kettle.tests.dataSource.initCases", {
    gradeNames: ["fluid.test.testCaseHolder"],
    modules: [{
        name: "Kettle Data Source Init Tester",
        tests: [{
            expect: 4,
            name: "URL Data source initialization",
            func: "kettle.tests.dataSource.testInit",
            args: ["{urlDataSource}"]
        }, {
            expect: 4,
            name: "CouchDB Data source initialization",
            func: "kettle.tests.dataSource.testInit",
            args: ["{couchDBDataSource}"]
        }]
    }]
});

// Attached URL resolver tests

kettle.tests.testUrlResolver = function (dataSource, directModel) {
    var resolved = dataSource.resolveUrl(dataSource.options.url, dataSource.options.termMap, directModel);
    jqUnit.assertEquals("Data source should should expand urls based on termMap with URIEncoding",
        "http://test%20with%20space/test.json", resolved);
};

fluid.defaults("kettle.tests.dataSource.resolverTester", {
    gradeNames: ["fluid.test.testEnvironment"],
    components: {
        urlDataSourceDynamic: {
            type: "kettle.dataSource.URL",
            options: {
                url: "http://%expand/test.json",
                termMap: {
                    expand: "%expand"
                }
            }
        },
        testCases: {
            type: "kettle.tests.urlResolverTester"
        }
    }
});


fluid.defaults("kettle.tests.urlResolverTester", {
    gradeNames: ["fluid.test.testCaseHolder"],
    modules: [{
        name: "Kettle UrlResolver Tests",
        tests: [{
            expect: 1,
            name: "URL resolver with URI escaping",
            func: "kettle.tests.testUrlResolver",
            args: ["{urlDataSourceDynamic}", {
                expand: "test with space"
            }]
        }]
    }]
});

jqUnit.onAllTestsDone.addListener(kettle.tests.dataSource.ensureWriteableEmpty);

fluid.test.runTests(["kettle.tests.dataSource.initTester", "kettle.tests.dataSource.resolverTester"]);
