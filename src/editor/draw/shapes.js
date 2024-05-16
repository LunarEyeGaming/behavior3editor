this.b3editor = this.b3editor || {};
this.b3editor.draw = this.b3editor.draw || {};

(function() {
    "use strict";

var makeAnchor = function(shape, x, y, radius, bg_color, border_width, border_color) {
    shape.graphics.beginFill(bg_color);
    shape.graphics.setStrokeStyle(border_width, 'round');
    shape.graphics.beginStroke(border_color);
    shape.graphics.drawCircle(x, y, radius);
    shape.graphics.endStroke();
    shape.graphics.endFill();
}

var makeRect = function(shape, w, h, radius, bg_color, border_width, border_color) {
    shape.graphics.beginFill(bg_color);
    shape.graphics.setStrokeStyle(border_width, 'round');
    shape.graphics.beginStroke(border_color);
    shape.graphics.drawRoundRect(-w/2, -h/2, w, h, radius);
    shape.graphics.endStroke();
    shape.graphics.endFill();
}

var makeEllipse = function(shape, w, h, bg_color, border_width, border_color) {
    shape.graphics.beginFill(bg_color);
    shape.graphics.setStrokeStyle(border_width, 'round');
    shape.graphics.beginStroke(border_color);
    // shape.graphics.drawRoundRect(-w/2, -h/2, w, h, 75);
    shape.graphics.drawEllipse(-w/2, -h/2, w, h);
    shape.graphics.endStroke();
    shape.graphics.endFill();
}

var makeRhombus = function(shape, w, h, bg_color, border_width, border_color) {
    shape.graphics.beginFill(bg_color);
    shape.graphics.setStrokeStyle(border_width, 'round');
    shape.graphics.beginStroke(border_color);
    shape.graphics.moveTo(0, h/2);
    shape.graphics.lineTo(w/2, 0);
    shape.graphics.lineTo(0, -h/2);
    shape.graphics.lineTo(-w/2, 0);
    shape.graphics.lineTo(0, h/2);
    // shape.graphics.drawRoundRect(-w/2, -h/2, w, h, 75);
    // shape.graphics.drawEllipse(-w/2, -h/2, w, h);
    shape.graphics.endStroke();
    shape.graphics.endFill();
}

b3editor.draw.rootShape = function(block, settings, colorKind) {
    var colorKind = colorKind || 'registered';

    var w = block._width;
    var h = block._height;
    var anchorOffsetX = settings.get('anchor_offset_x');
    var shape = block._shapeObject;

    var blockColors = settings.get(colorKind + '_block_colors');
    var anchorColors = settings.get(colorKind + '_anchor_colors');

    makeAnchor(shape, w/2+anchorOffsetX, 0, 
        settings.get('anchor_radius'),
        anchorColors.background_color,
        settings.get('anchor_border_width'),
        anchorColors.border_color
    );
    makeRect(shape, w, h, 15,
        blockColors.background_color,
        settings.get('block_border_width'),
        blockColors.border_color
    );
}

b3editor.draw.compositeShape = function(block, settings, colorKind) {
    var colorKind = colorKind || 'registered';

    var bounds = block._symbolObject.getBounds();
    var _width = 0;

    if (bounds) { _width = bounds.width+20; }

    var w = Math.max(_width, block._width);
    var h = block._height;
    var anchorOffsetX = settings.get('anchor_offset_x');
    var shape = block._shapeObject;
    block._width = w;
    block._height = h;

    var blockColors = settings.get(colorKind + '_block_colors');
    var anchorColors = settings.get(colorKind + '_anchor_colors');

    makeAnchor(shape, -w/2-anchorOffsetX, 0, 
        settings.get('anchor_radius'),
        anchorColors.background_color,
        settings.get('anchor_border_width'),
        anchorColors.border_color
    )
    makeAnchor(shape, w/2+anchorOffsetX, 0, 
        settings.get('anchor_radius'),
        anchorColors.background_color,
        settings.get('anchor_border_width'),
        anchorColors.border_color
    )
    makeRect(shape, w, h, 15,
        blockColors.background_color,
        settings.get('block_border_width'),
        blockColors.border_color
    )
}

b3editor.draw.decoratorShape = function(block, settings, colorKind) {
    var colorKind = colorKind || 'registered';

    var bounds = block._symbolObject.getBounds();

    var w = Math.max(bounds.width+40, block._width);
    var h = Math.max(bounds.height+50, block._height);
    var anchorOffsetX = settings.get('anchor_offset_x');
    var shape = block._shapeObject;
    block._width = w;
    block._height = h;

    var blockColors = settings.get(colorKind + '_block_colors');
    var anchorColors = settings.get(colorKind + '_anchor_colors');

    makeAnchor(shape, -w/2-anchorOffsetX, 0, 
        settings.get('anchor_radius'),
        anchorColors.background_color,
        settings.get('anchor_border_width'),
        anchorColors.border_color
    )
    makeAnchor(shape, w/2+anchorOffsetX, 0, 
        settings.get('anchor_radius'),
        anchorColors.background_color,
        settings.get('anchor_border_width'),
        anchorColors.border_color
    )
    makeRhombus(shape, w, h, 15,
        blockColors.background_color,
        settings.get('block_border_width'),
        blockColors.border_color
    )
}

b3editor.draw.actionShape = function(block, settings, colorKind) {
    var colorKind = colorKind || 'registered';

    var bounds = block._symbolObject.getBounds();

    // var w = block._width;
    // var h = block._height;
    var w = Math.max(bounds.width+15, block._width);
    var h = Math.max(bounds.height+15, block._height);
    var anchorOffsetX = settings.get('anchor_offset_x');
    var shape = block._shapeObject;
    block._width = w;
    block._height = h;

    var blockColors = settings.get(colorKind + '_block_colors');
    var anchorColors = settings.get(colorKind + '_anchor_colors');

    makeAnchor(shape, -w/2-anchorOffsetX, 0, 
        settings.get('anchor_radius'),
        anchorColors.background_color,
        settings.get('anchor_border_width'),
        anchorColors.border_color
    )
    makeRect(shape, w, h, 15,
        blockColors.background_color,
        settings.get('block_border_width'),
        blockColors.border_color
    );
}

b3editor.draw.conditionShape = function(block, settings, colorKind) {
    var colorKind = colorKind || 'registered';

    var bounds = block._symbolObject.getBounds();

    var w = Math.max(bounds.width+15, block._width);
    var h = Math.max(bounds.height+15, block._height);
    var anchorOffsetX = settings.get('anchor_offset_x');
    var shape = block._shapeObject;
    block._width = w;
    block._height = h;

    var blockColors = settings.get(colorKind + '_block_colors');
    var anchorColors = settings.get(colorKind + '_anchor_colors');

    makeAnchor(shape, -w/2-anchorOffsetX, 0, 
        settings.get('anchor_radius'),
        anchorColors.background_color,
        settings.get('anchor_border_width'),
        anchorColors.border_color
    )
    makeEllipse(shape, w, h, 
        blockColors.background_color,
        settings.get('block_border_width'),
        blockColors.border_color
    );
}

}());
