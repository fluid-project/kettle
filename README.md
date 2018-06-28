# Kettle

[![Build status](https://badge.buildkite.com/8715d7bc790b1c2702109d3ce2b777fe5322c858465e587478.svg)](https://buildkite.com/fluid-project/kettle)

Kettle is an integration technology which promotes the expression of servers handling HTTP and WebSockets endpoints.
With a few exceptions, Kettle implements no primary functionality of its own, but aggregates the facilities of
[express](http://expressjs.com/) and [ws](https://github.com/websockets/ws), as well as middleware held in the wider [pillarjs](https://github.com/pillarjs)
"Bring your own HTTP Framework Framework" ecosystem. Kettle applications can easily incorporate any express-standard middleware, as well as coexisting with standard express apps targeted at the same
node.js <a href="https://nodejs.org/api/http.html#http_class_http_server"><code>http.Server</code></a>. Since Kettle applications are expressed declaratively, in the JSON format encoding [Infusion](https://github.com/fluid-project/infusion)'s component trees, it is possible to adapt existing
applications easily, as well as inserting middleware and new handlers anywhere in the pipeline without modifying the original application's code. This makes
Kettle suitable for uses where application functionality needs to be deployed flexibly in a variety of different configurations.

In fact, Kettle's dependency on express itself is minimal, since the entirety of the Kettle request handling pipeline is packaged
as a single piece of express-compatible middleware – Kettle could be deployed against any other consumer of middleware or even a raw node.js HTTP server.

## Contents of this repository

### Core Kettle implementation

This is packaged as Infusion [grades](http://docs.fluidproject.org/infusion/development/ComponentGrades.html) derived from [`kettle.server`](./docs/Servers.md#kettle.server),
[`kettle.request`](./docs/RequestHandlersAndApps.md#kettle.request) and [`kettle.app`](./docs/RequestHandlersAndApps.md#kettle.app). The first two of these exist in variants specialized both for plain
HTTP (with the `.http` suffix) and for WebSockets (with the `.ws` suffix) – `kettle.app` does not specialize.

### Contents - Testing

As well as the integration technology implementing Kettle itself, this repository also contains functionality helpful for testing HTTP and WebSockets
servers written in arbitrary technologies. This is accessed by running `kettle.loadTestingSupport()` after having called `require("kettle")`. Kettle testing
support allows HTTP and WebSockets client requests to be packaged as [Infusion](https://github.com/fluid-project/infusion) components, suitable for use with Infusion's
[IoC Testing Framework](http://docs.fluidproject.org/infusion/development/IoCTestingFramework.html). Any user of Kettle's testing support needs to have [node-jqunit](https://github.com/fluid-project/node-jqunit)
registered as a member of their own project's `devDependencies` in their own package.json.

Kettle runs on [node.js](https://nodejs.org) version 4.x (see [package.json](package.json) for current dependency profile).

### Contents - DataSources

The Kettle repository also contains a few implementations of the simple `DataSource` contract for read/write access to data with a simple semantic (broadly the same as that
encoded in [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete) although the current DataSource semantic does not provide explicitly for deletion). See the documentation section
on [DataSources](./docs/DataSources.md) for details of this contract, the available implementations and how to use them.

This repository contains DataSource implementations suitable for HTTP endpoints (with a particular variety specialised for accessing CouchDB databases with CRUDlike semantics) as well as the filesystem, with
an emphasis on JSON payloads.

## Getting Started and Community

### Installation instructions

Firstly, install node and npm by running a standard installer from [node.js](https://nodejs.org). Clone this repository and then run `npm install`.

### Issue Tracking

Issue tracking is at [http://issues.fluidproject.org/browse/KETTLE](http://issues.fluidproject.org/browse/KETTLE).

### IRC

Visit `#fluid-work` on Freenode – community resources are linked at [Fluid's IRC Channels](https://wiki.fluidproject.org/display/fluid/IRC+Channel).

### Mailing list

Contact us on the [fluid-work](https://wiki.fluidproject.org/display/fluid/Mailing+Lists) mailing list with any problems or comments.

### Uses of Kettle and related projects

The primary user of Kettle is the [GPII](http://gpii.net/)'s autopersonalisation infrastructure, held at [GPII/universal](https://github.com/GPII/universal). Kettle is used
to provide a flexible means of deploying the GPII's "Flow Manager" and related components distributed across multiple local and remote installations.

A closely related project to Kettle is [gpii-express](https://github.com/GPII/gpii-express) which is used in other GPII projects such as the [terms registry](https://github.com/GPII/common-terms-registry) and
[unified listing](https://github.com/GPII/ul-api). This is similar in architecture to Kettle (wrapping express primitives such as servers and requests into dynamically constructed Infusion components)
but slightly different in emphasis –

* gpii-express allows independently mounted application units with nested routing, in the Express 4.x style – whereas Kettle is currently limited to flat Express 3.x-style routing
* Kettle incorporates support for WebSockets endpoints, whereas gpii-express does not
* Kettle incorporates support for DataSources (see [DataSources](./docs/DataSources.md) )

The request handling architecture for gpii-express and Kettle is quite similar and the projects will probably converge over time. gpii-express currently already depends on Kettle to get access to its
HTTP [testing](./docs/KettleTestingFramework.md) support.

## Documentation

Documentation and sample code for working with Kettle is contained in the [docs](./docs) directory. Kettle is based on Fluid [Infusion](http://fluidproject.org/infusion.html)'s
[component model](http://docs.fluidproject.org/infusion/development/HowToUseInfusionIoC.html). If you aren't familiar
with the syntax and meaning of Infusion component trees, it is a good idea to browse the documentation, tutorials and examples at the
Infusion [documentation site](http://docs.fluidproject.org/infusion/development/).

It contains the following topics:

1. Defining top-level [Kettle applications using "config" files](docs/ConfigsAndApplications.md).
2. Defining HTTP and Websockets servers using the grades [`kettle.server`](./docs/Servers.md#kettle.server) and [`kettle.server.ws`](./docs/Servers.md#kettle.server.ws).
3. Defining Kettle request handlers derived from grades [`kettle.request`](./docs/RequestHandlersAndApps.md#kettle.request) grouped into app units derived from [`kettle.app`](./docs/RequestHandlersAndApps.md#kettle.app)
4. Working with standard express [middleware](./docs/Middleware.md) –  incorporating any standard middleware from the express community and registering it into a Kettle application
5. Working with [DataSources](./docs/DataSources.md) to abstract over asynchronous access to (primarily JSON-formatted) data stored locally or remotely
6. Defining conversational, asynchronous test fixtures against HTTP and WebSockets servers using the [Kettle testing framework](./docs/KettleTestingFramework.md)

Of these elements of this module, those described in topics 1, 5 and 6 (configs, DataSources and the testing framework) are portable and do not depend specifically on the
Kettle server and request handling infrastructure –   they can be used together with any technologies defining node.js HTTP and WebSockets servers (or in the case of configs,
any node.js enabled [Infusion](http://fluidproject.org/infusion.html) application).
