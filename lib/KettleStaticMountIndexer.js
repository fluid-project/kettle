/*
Kettle Static Mount Indexer

Copyright 2019 Raising the Floor - International

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/fluid-project/kettle/blob/master/LICENSE.txt
*/

"use strict";

// Adapted from fluid-authoring "Visible Nexus" instance of IncludeRewriting.js
// makes use of staticRequestHandler info only to avoid blind introspection into request-scope components
var fluid = require("infusion"),
    kettle = fluid.registerNamespace("kettle");

fluid.defaults("kettle.staticMountIndexer", {
    gradeNames: "fluid.component",
    members: {
        mountTable: []
    },
    invokers: {
        indexMount: {
            funcName: "kettle.staticMountIndexer.indexMount",
            args: ["{that}", "{arguments}.0"]
        }
    }
});

kettle.staticMountIndexer.splitModulePath = function (modulePath) {
    if (modulePath.charAt(0) !== "%") {
        return null;
    }
    var slashPos = modulePath.indexOf("/");
    if (slashPos === -1) {
        slashPos = modulePath.length;
    }
    return {
        moduleName: modulePath.substring(1, slashPos),
        suffix: modulePath.substring(slashPos + 1, modulePath.length)
    };
};

/** Index any static middleware attached to the requestHolder, imputed to be a staticRequestHandler, referenced in
 * the supplied requestHandler which has presumably just been registered into the server's routing table.
 * @param {kettle.staticMountIndexer} that - The staticMountIndexer in which the index is to be registered
 * @param {internalHandlerRecord} requestHandler - The record which has just been registered
 */
kettle.staticMountIndexer.indexMount = function (that, requestHandler) {
    var staticRequestHandler = requestHandler.requestHolder;
    fluid.each(staticRequestHandler.options.requestMiddleware, function (oneMiddleware) {
        var middleware = oneMiddleware.middleware;
        if (fluid.componentHasGrade(middleware, "kettle.middleware.static")) {
            var root = middleware.options.root;
            var parsedRoot = kettle.staticMountIndexer.splitModulePath(root);
            var prefix = requestHandler.prefix || "/";
            that.mountTable.push({
                moduleName: parsedRoot.moduleName,
                suffix: parsedRoot.suffix,
                prefix: prefix
            });
        };
    });
};


fluid.registerNamespace("kettle.includeRewriter");

/** Rewrites a module-relative URL of the form %module-name/some/suffix so that it takes the form of an actual
 * URL hosted by some static middleware hosting that module's content in a server's URL space.
 * @param {kettle.staticMountIndexer} staticMountIndexer - The `kettle.staticMountIndexer` component holding the mount table to be inspected
 * @param {String} url - A URL to be rewritten, perhaps beginning with a %-qualified module prefix
 * @return {String|Null} If the supplied URL was module-qualified, and it could be resolved, the resolved value is
 * returned, or else null if it could not. If the supplied URl was not module-qualified, it is returned unchanged.
 */
kettle.staticMountIndexer.rewriteUrl = function (staticMountIndexer, url) {
    var mountTable = staticMountIndexer.mountTable;
    var parsed = kettle.staticMountIndexer.splitModulePath(url);
    if (parsed) {
        for (var i = 0; i < mountTable.length; ++i) {
            var mount = mountTable[i];
            if (mount.moduleName === parsed.moduleName && parsed.suffix.startsWith(mount.suffix)) {
                var endSuffix = parsed.suffix.substring(mount.suffix.length);
                return mount.prefix + (endSuffix.startsWith("/") ? "" : "/") + endSuffix;
            }
        }
        return null;
    }
    return url;
};
