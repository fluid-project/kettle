/*
Copyright 2013-2014 OCAD University

Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.

You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/
"use strict";
module.exports = function (grunt) {

    grunt.initConfig({
        eslint: {
            src: ["./lib/**/*.js", "./tests/**/*.js", "./*.js"]
        },
        jsonlint: {
            src: ["lib/**/*.json", "tests/data/*.json", "tests/configs/*.json", "examples/**/*.json", "./*.json"]
        },
        json5lint: {
            src: ["lib/**/*.json5", "tests/data/*.json5", "tests/configs/*.json5", "examples/**/*.json5"]
        },
        markdownlint: {
            full: {
                options: {
                    config: {
                        "no-inline-html": false,
                        "line-length": false,
                        "ol-prefix": { style: "ordered" }
                    }
                },
                src: ["./*.md", "docs/**/*.md", "examples/**/*.md"]
            }
        }
    });

    grunt.loadNpmTasks("grunt-jsonlint");
    grunt.loadNpmTasks("fluid-grunt-json5lint");
    grunt.loadNpmTasks("grunt-shell");
    grunt.loadNpmTasks("fluid-grunt-eslint");
    grunt.loadNpmTasks("grunt-markdownlint");

    grunt.registerTask("lint", "Apply eslint, jsonlint, json5lint, and markdownlint", ["eslint", "jsonlint", "json5lint", "markdownlint"]);
};
