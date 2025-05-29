const chai = require("chai");
// Register Waffle matchers for .to.emit and .revertedWith
chai.use(require("ethereum-waffle"));
// Register chai-as-promised for promise rejections
chai.use(require("chai-as-promised"));
module.exports = chai;