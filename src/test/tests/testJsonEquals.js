var {makeTest} = require("../tester");
var {assert} = require("../assert");

var suite = [
  makeTest("jsonEquals, non-aggregate", () => {
    assert(b3editor.jsonEquals("asdf", "asdf"), "not equal");
    assert(!b3editor.jsonEquals("asdf", ""), "equal");
    assert(!b3editor.jsonEquals("asdf", 1), "equal");
    assert(!b3editor.jsonEquals(2, 1), "equal");
  }),
  makeTest("jsonEquals, array", () => {
    assert(b3editor.jsonEquals([1, 2, 3], [1, 2, 3]), "not equal");

    assert(!b3editor.jsonEquals([1, 4, 3], [1, 2, 3]), "equal");
    assert(!b3editor.jsonEquals([1, 2, 3], [1, 2, 4]), "equal");
    assert(!b3editor.jsonEquals([4, 2, 3], [1, 2, 3]), "equal");
    assert(!b3editor.jsonEquals([4, 5, 6], [1, 2, 3]), "equal");

    assert(!b3editor.jsonEquals([1, 2, 3], [1, 2]), "equal");
    assert(!b3editor.jsonEquals([1, 2], [1, 2, 3]), "equal");

    assert(b3editor.jsonEquals([], []), "not equal");
    assert(b3editor.jsonEquals([1], [1]), "not equal");

    assert(!b3editor.jsonEquals([], [1, 2, 3]), "equal");
    assert(!b3editor.jsonEquals([], [1]), "equal");
    assert(!b3editor.jsonEquals([2], [1]), "equal");
  }),
  makeTest("jsonEquals, object", () => {
    assert(b3editor.jsonEquals({foo: "1", bar: "2", baz: "3"}, {foo: "1", bar: "2", baz: "3"}), "not equal");

    assert(!b3editor.jsonEquals({foo: "1", bee: "2", baz: "3"}, {foo: "1", bar: "2", baz: "3"}), "equal");
    assert(!b3editor.jsonEquals({foo: "1", bar: "3", baz: "3"}, {foo: "1", bar: "2", baz: "3"}), "equal");
    assert(!b3editor.jsonEquals({foo: "1", bee: "3", baz: "3"}, {foo: "1", bar: "2", baz: "3"}), "equal");
    assert(!b3editor.jsonEquals({foo: "1", bar: "2", baz: "3"}, {a: "4", bee: "5", sea: "6"}), "equal");

    assert(!b3editor.jsonEquals({foo: "1", bar: "2"}, {foo: "1", bar: "2", baz: "3"}), "equal");
    assert(!b3editor.jsonEquals({foo: "1", bar: "2", baz: "3"}, {foo: "1", bar: "2"}), "equal");

    assert(b3editor.jsonEquals({}, {}), "not equal");
    assert(b3editor.jsonEquals({foo: 1}, {foo: 1}), "not equal");

    assert(!b3editor.jsonEquals({}, {foo: "1", bar: "2", baz: "3"}), "equal");
    assert(!b3editor.jsonEquals({foo: 1}, {bar: 1}), "equal");
    assert(!b3editor.jsonEquals({foo: 1}, {foo: 2}), "equal");
  }),
  makeTest("jsonEquals, recursive", () => {
    assert(b3editor.jsonEquals({foo: [1, {bar: "2"}, true]}, {foo: [1, {bar: "2"}, true]}), "not equal");
    assert(b3editor.jsonEquals([[[[[[[4]]]]]]], [[[[[[[4]]]]]]]), "not equal");

    assert(!b3editor.jsonEquals({foo: [1, {bar: "2"}, true]}, {foo: [1, {bar: "3"}, true]}), "equal");
    assert(!b3editor.jsonEquals({foo: [1, {bar: "2"}, true]}, {foo: [1, {bar: "2"}, false]}), "equal");
    assert(!b3editor.jsonEquals({foo: [1, {bar: "2"}, true]}, {foo: [false, {bar: "2"}, true]}), "equal");
    assert(!b3editor.jsonEquals([[[[[[[4]]]]]]], [[[[[[[5]]]]]]]), "equal");
    assert(!b3editor.jsonEquals([[[[[[[4]]]]]]], [[[[[[[4]]]], 2]]]), "equal");
  })
]

module.exports = {testJsonEquals: suite}