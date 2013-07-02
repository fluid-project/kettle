var fluid = require("infusion"),
    kettle = fluid.registerNamespace("kettle");

var loader = fluid.getLoader(__dirname);

loader.require("./lib/dataSource.js");
loader.require("./lib/utils.js");
loader.require("./lib/middleware.js");
loader.require("./lib/request.js");
loader.require("./lib/server.js");
loader.require("./lib/app.js");
loader.require("./lib/configLoader.js");

module.exports = kettle;
