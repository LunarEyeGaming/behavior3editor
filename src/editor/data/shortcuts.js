
this.b3editor = this.b3editor || {};

(function() {
    "use strict";

var SHORTCUTS = {
    key_select_all       : 'ctrl+a',
    key_deselect_all     : 'ctrl+shift+a',
    key_invert_selection : 'ctrl+i',

    key_undo             : 'ctrl+z',
    key_redo             : 'ctrl+y',

    key_copy             : 'ctrl+c',
    key_cut              : 'ctrl+x',
    key_paste            : 'ctrl+v',
    key_duplicate        : 'ctrl+d',
    key_remove           : 'delete',

    key_organize         : 'a',
    key_zoom_in          : 'ctrl+up',
    key_zoom_out         : 'ctrl+down',
    key_new_project      : '',
    key_open_project     : '',
    key_new_tree         : 'ctrl+t',
    key_new_node         : 'ctrl+n',
    key_open_tree      : 'ctrl+o',
    key_save_tree      : 'ctrl+s',
    key_save_as      : 'ctrl+alt+s'
}

b3editor.SHORTCUTS = SHORTCUTS;
}());
