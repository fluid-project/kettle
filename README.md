Kettle
===

Kettle is an integration technology which promotes the expression of servers handling HTTP and WebSockets endpoints. 
With a few exceptions, Kettle implements no primary functionality of its own, but aggregates the facilities of
[express](http://expressjs.com/) and [ws](http://einaros.github.io/ws/), as well as middleware held in the wider [pillarjs](https://github.com/pillarjs)
ecosystem. Kettle applications can easily incorporate any express-standard middleware, as well as coexisting with standard express apps targeted at the same
node.js HTTP server. Since Kettle applications are expressed 
declaratively, in the JSON format encoding [Infusion](https://github.com/fluid-project/infusion)'s component trees, it is possible to adapt existing
applications easily, as well as inserting middleware and new handlers anywhere in the pipeline without modifying the original application's code. This makes
Kettle suitable for uses where application functionality needs to be deployed flexibly in a variety of different configurations.

In fact, Kettle's dependency on express itself is minimal, since the entirety of the Kettle request handling pipeline is packaged
as a single piece of express-compatible middleware - Kettle could be deployed against any other consumer of middleware or even a raw node.js HTTP server.

Testing
===
As well as the integration technology implementing Kettle itself, this repository also contains functionality helpful for testing HTTP and WebSockets
servers written in arbitrary node.js technologies. This is accessed by, after calling `require("kettle")`, then running `kettle.loadTestingSupport`. Kettle testing 
support allows HTTP and WebSockets client requests to be packaged as [Infusion](https://github.com/fluid-project/infusion) components, suitable for use with 


Kettle runs on [node.js](https://nodejs.org) version 4.x (see package.json for current dependency profile)

Issue tracking at http://issues.fluidproject.org/browse/KETTLE .

Installation instructions:
-

Firstly, install node and npm by running a standard installer from [node.js](https://nodejs.org). Clone this repository and then run `npm install`.

Kettle apps
-

Kettle applications are configured in units of "modules" described by a "config" file in JSON format. These can
describe the configuration of a number of "Kettle apps" as a Fluid IoC component tree, together with a set of node modules that they depend on.
More documentation will be forthcoming - in the meantime please join us in #fluid-tech on irc.freenode.net .
