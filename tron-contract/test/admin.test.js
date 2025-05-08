const Admin = artifacts.require("Admin");

contract("Admin", (accounts) => {
  let admin;

  beforeEach(async () => {
    admin = await Admin.new();
    await admin.initialize(); // If using upgradeable pattern with `initialize`
  });

  it("should be initialized correctly", async () => {
    const isInitialized = await admin.isInitialized(); // Example function
    assert.equal(isInitialized, true, "Admin contract was not initialized");
  });

  // Add more tests here...
});
