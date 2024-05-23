this.b3editor = this.b3editor || {};

(function() {
    "use strict";

var THEME_DARK = {
    // CANVAS
    background_color        : '#171717',
    
    // SELECTION
    selection_color         : '#4bb2fd',
    
    // BLOCK
    registered_block_colors : {
        background_color : '#EFEFEF',
        border_color     : '#6d6d6d',
        symbol_color     : '#333',
    },

    unregistered_block_colors : {
        background_color  : '#E26E64',
        border_color      : '#4B1C18',
        symbol_color      : '#322',
    },
    
    // ANCHOR
    registered_anchor_colors : {
        background_color : '#EFEFEF',
        border_color     : '#6d6d6d',
    },

    unregistered_anchor_colors : {
        background_color : '#E26E64',
        border_color     : '#4B1C18',
    },

    invalid_overlay_color : "#FF0000",
    invalid_overlay_stroke_thickness : 5,
    
    // CONNECTION
    connection_color        : '#6d6d6d',
}

b3editor.THEME_DARK = THEME_DARK;
}());
