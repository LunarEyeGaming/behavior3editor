this.b3editor = this.b3editor || {};

(function() {
  "use strict";

  /**
   * A class for a node of a doubly-linked list. The node has a next node and a previous node with some data in it. The
   * class has only one constructor to instantiate a node. By default, the next and previous nodes are null. null
   * signifies an end of a list, so if the next node is null, that means that the node before it is the last element of 
   * the list. Likewise, if the previous node is null, the node after it is the first element of the list.
   * This class was not intended for use outside of the UndoStack script, so it uses the native class system instead of
   * b3's class system.
   */
  class ListNode {
    /**
     * Instantiates a `ListNode` with some data, a next node, and a previous node. It is up to the programmer to ensure
     * that `next` and `prev` are valid `ListNode`s.
     * 
     * @param {*} data the data to insert into the node
     * @param {ListNode} next (optional) the next `ListNode` in the sequence. Defaults to `null`
     * @param {ListNode} prev (optional) the previous `ListNode` in the sequence. Defaults to `null`
     */
    constructor(data, next, prev) {
      this.data = data;
      this.next = next || null;  // Default to null
      this.prev = prev || null;  // Default to null
    }
  }

  b3editor.ListNode = ListNode;
}());