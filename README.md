Kettle.
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

    express: ~3.1.0
    infusion: git://github.com/fluid-project/infusion.git#c0ee40396fe44407d374915262e753b8bdc6d457
    node-uuid: ~1.4.0
    when": ~1.8.1

Kettle apps
-

Kettle applications are configured in units of "modules" described by a "config" file in JSON format. These can 
describe the configuration of a number of "Kettle apps" as a Fluid IoC component tree, together with a set of node modules that they depend on.
More documentation will be forthcoming - in the meantime please join us in #fluid-tech on irc.freenode.net .    