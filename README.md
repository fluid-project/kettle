Kettle
===

Kettle is the Fluid Project's experimental server-side platform, based on node.js and [express](http://expressjs.com/)

The homepage for Kettle is at http://wiki.fluidproject.org/display/fluid/Kettle, with issue tracking at http://issues.fluidproject.org/browse/KETTLE .

Kettle operates by executing [Fluid Infusion](http://www.fluidproject.org/products/infusion/) and a very minimal profile of jQuery on the server-side.

Installation instructions:
-

Firstly, install node and npm.

Run the following command in your newly checked out Kettle repository. This
will install all dependencies that are required by Kettle.

    npm install

Dependencies:
-

    express: ~3.4.3
    infusion: git://github.com/fluid-project/infusion.git#xxxxxx
    node-uuid: ~1.4.0
    socket.io: ~0.9.16
    xmlhttprequest: ~1.6.0 **NOTE**
    socket.io-client: ~0.9.16 **NOTE**

**NOTE**: the final two listed dependencies are strictly speaking dev dependencies. However, when Kettle is loaded
as a submodule for the purpose of running test cases, this fact cannot be propagated through the npm system. We must
advertise them as 1st-class dependencies so that they can be available for 3rd party tests.
    

Kettle apps
-

Kettle applications are configured in units of "modules" described by a "config" file in JSON format. These can
describe the configuration of a number of "Kettle apps" as a Fluid IoC component tree, together with a set of node modules that they depend on.
More documentation will be forthcoming - in the meantime please join us in #fluid-tech on irc.freenode.net .
