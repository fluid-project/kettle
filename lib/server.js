/*
Kettle Server.

Copyright 2012-2013 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/gpii/kettle/LICENSE.txt
*/

/*global require, __dirname */

(function () {

    "use strict";

    var fluid = require("infusion"),
        path = require("path"),
        express = require("express"),
        $ = fluid.registerNamespace("jQuery"),
        kettle = fluid.registerNamespace("kettle");

    fluid.defaults("kettle.server", {
        gradeNames: [
            "fluid.eventedComponent",
            "autoInit",
            "kettle.use.bodyParser",
            "kettle.use.session"],
        components: {
            requests: {
                type: "kettle.requests"
            },
            requestProxy: {
                type: "kettle.requestProxy"
            },
            callbackWrapper: {
                type: "kettle.requestContextCallbackWrapper"
            },
            configurations: {
                type: "kettle.server.configurations"
            }
        },
        invokers: {
            listen: {
                funcName: "kettle.server.listen",
                args: "{that}"
            },
            setLogging: {
                funcName: "fluid.setLogging",
                args: "{that}.options.logging"
            },
            amalgamateHandlers: {
                funcName: "kettle.server.amalgamateHandlers",
                args: ["{that}.options.handlers", "{arguments}.0"]
            },
            registerHandlers: {
                funcName: "kettle.server.registerHandlers",
                args: "{that}"
            },
            stop: {
                funcName: "kettle.server.stop",
                args: "{that}"
            }
        },
        members: {
            server: {
                expander: {
                    func: "kettle.server.express"
                }
            }
        },
        root: path.join(__dirname, "../../.."),
        events: {
            onMiddleware: null,
            onHandlers: null,
            onListen: null
        },
        listeners: {
            onCreate: [
                "{that}.setLogging",
                "{that}.events.onMiddleware.fire",
                "{that}.events.onHandlers.fire",
                "{that}.listen"
            ],
            onHandlers: "{that}.registerHandlers",
            onDestroy: "{that}.stop"
        },
        handlers: {},
        port: 8080,
        logging: true
    });

    kettle.server.amalgamateHandlers = function (target, source) {
        $.extend(true, target, source);
    };

    kettle.server.registerHandler = function (that, handler, context) {
        that.server[handler.type](handler.route, function (req) {
            var request = req.fluidRequest;
            request.handlerContext = fluid.model.composeSegments(
                "kettle.requests.request.handler", context);
            request.events.handle.fire();
        });
    };

    kettle.server.validateHandler = function (handler, that) {
        if (!handler.needSession) {
            return true;
        }
        if (!that.cookieParser) {
            fluid.log("FAIL", "Sessions requires cookieParser middleware.");
            return false;
        }
        if (!that.session) {
            fluid.log("FAIL", "Sessions requires session middleware.");
            return false;
        }
        return true;
    };

    kettle.server.registerHandlers = function (that) {
        fluid.each(that.options.handlers, function (handler, context) {
            if (!handler) {
                return;
            }
            if (!kettle.server.validateHandler(handler, that)) {
                return;
            }
            kettle.server.registerHandler(that, handler, context);
        });
    };

    kettle.server.stop = function (that) {
        var port = that.options.port;
        fluid.log("Stopping Kettle Server on port: ", port);
        that.instance.close(function () {
            delete that.instance;
            delete that.server;
            fluid.log("Kettle Server on port: ", port, " is stopped.");
        });
    };

    kettle.server.express = function () {
        fluid.log("Initializing the Express server.");
        return express();
    };

    kettle.server.listen = function (that) {
        var port = that.options.port;
        that.instance = that.server.listen(port, function () {
            fluid.log("Kettle Server is running on port: ", port);
            that.events.onListen.fire();
        });
    };

    fluid.defaults("kettle.server.configurations", {
        gradeNames: ["autoInit", "fluid.littleComponent"],
        components: {
            createRequest: {
                type: "kettle.server.config.createRequest"
            }
        }
    });

    fluid.defaults("kettle.server.config", {
        gradeNames: ["fluid.eventedComponent", "autoInit"],
        events: {
            configure: null
        },
        listeners: {
            configure: "{that}.configure",
            onCreate: "{that}.events.configure.fire"
        },
        invokers: {
            configure: "kettle.server.config.configure"
        }
    });

    fluid.defaults("kettle.server.config.createRequest", {
        gradeNames: ["autoInit", "kettle.server.config"],
        invokers: {
            configure: {
                funcName: "kettle.server.config.configureCreateRequest",
                args: ["{kettle.server}.server", "{requests}"]
            }
        }
    });

    kettle.server.config.configureCreateRequest = function (server, requests) {
        server.configure(function () {
            server.use(requests.create);
        });
    };

})();
