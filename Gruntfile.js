/*
Copyright 2013-2018 OCAD University

Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.

You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/main/Infusion-LICENSE.txt
*/
"use strict";
module.exports = function (grunt) {

    grunt.initConfig({
        lintAll: {
            sources: {
                js: ["./lib/**/*.js", "./tests/**/*.js", "./*.js"],
                json: ["lib/**/*.json", "tests/data/*.json", "tests/configs/*.json", "examples/**/*.json", "./*.json"],
                json5: ["lib/**/*.json5", "tests/data/*.json5", "tests/configs/*.json5", "examples/**/*.json5"],
                md: ["./*.md", "docs/**/*.md", "examples/**/*.md"],
                other: ["./.*"]
            },
            ignores: ["!./node_modules", "!./package-lock.json"]
        },
        markdownlint: {
            options: {
                config: {
                    "single-h1": false
                }
            }
        },
        eslint: {
            "md": {
                "options": {
                    "rules": {
                        "no-redeclare": 0
                    }
                }
            }
        }
    });

    grunt.loadNpmTasks("fluid-grunt-lint-all");
    grunt.registerTask("lint", "Perform all standard lint checks.", ["lint-all"]);
};
