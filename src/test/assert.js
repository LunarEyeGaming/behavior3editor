/**
 * A module for asserting various things. All assert functions should be called inside of a function to be used in 
 * generating a test.
 */

/**
 * Thrown when an assertion fails. Not to be used directly.
 */
class AssertFailure extends Error {
  constructor(msg) {
    super(msg);
    this.name = "AssertFailure";
  }
}

/**
 * Asserts that a given boolean value is true.
 * 
 * @param {bool} boolean the boolean to assert
 * @param {string} msg the message to print if assertion fails
 * @throws AssertFailure if assertion fails.
 */
function assert(boolean, msg) {
  if (!boolean) {
    throw new AssertFailure(msg);
  }
}

/**
 * Asserts that `expected` loosely equals `actual`.
 * 
 * @param {*} expected the value expected to be returned
 * @param {*} actual the actual value returned
 * @throws AssertFailure if `expected` does not equal `actual`
 */
function assertEqual(expected, actual) {
  assert(expected == actual, "not equal");
}

/**
 * Asserts that `expected` strictly equals `actual`.
 * 
 * @param {*} expected the value expected to be returned
 * @param {*} actual the actual value returned
 * @throws AssertFailure if `expected` does not strictly equal `actual`
 */
function assertStrictEqual(expected, actual) {
  assert(expected === actual, "not equal");
}

/**
 * Executes a block of code embedded in a no-args function `func` and asserts that this results in an error with name
 * `expected`.
 * 
 * @param {string} expected the expected name of the error thrown
 * @param {() => void} func the block of code to execute
 */
function assertThrows(expected, func) {
  var noErrorThrown = false;

  try {
    func();
    noErrorThrown = true;  // Executed if func() does not throw an error.
  } catch (err) {
    assert(err.name === expected, "Expected error of type '" + expected + "'. Got error of type '" + err.name + "'");
  }

  // Placing the code to execute when no error is thrown here is necessary since otherwise, the newly thrown 
  // AssertFailure will be caught. The AssertFailure thrown when no error occurs should not be handled at all in this 
  // function.
  if (noErrorThrown) {
    throw new AssertFailure("Expected error of type '" + expected + "', but no error was thrown.");
  }
}

module.exports = {
  AssertFailure,
  assert,
  assertEqual,
  assertStrictEqual,
  assertThrows
}