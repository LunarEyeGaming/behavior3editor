this.b3editor = this.b3editor || {};
this.b3editor.draw = this.b3editor.draw || {};

(function() {
    "use strict";

b3editor.draw.rootSymbol = function(block, settings, colorKind) {
    var colorKind = colorKind || 'registered';
    // var shape = block.displayObject;
    var shape = new createjs.Shape();

    var w = block._width;
    var h = block._height;
    var swidth = h/20;
    var ssize = h/5;
    var scolor = settings.get(colorKind + '_block_colors').symbol_color;

    shape.graphics.setStrokeStyle(swidth, 'round');
    shape.graphics.beginStroke(scolor);
    shape.graphics.drawCircle(0, 0, ssize);
    shape.graphics.moveTo(-ssize, ssize);
    shape.graphics.lineTo(ssize, -ssize);
    shape.graphics.endStroke();

    return shape;
};

b3editor.draw.sequenceSymbol = function(block, settings, colorKind) {
    var colorKind = colorKind || 'registered';

    // var shape = block.displayObject;
    // var shape = block._shapeObject;
    var shape = new createjs.Shape();

    var w = block._width;
    var h = block._height;
    var swidth = h/20;
    var ssize = h/4;
    var scolor = settings.get(colorKind + '_block_colors').symbol_color;

    shape.graphics.setStrokeStyle(swidth, 'round');
    shape.graphics.beginStroke(scolor);
    shape.graphics.beginFill(scolor);
    shape.graphics.moveTo(-ssize, 0);
    shape.graphics.lineTo(ssize, 0);
    shape.graphics.drawPolyStar(ssize/2, 0, ssize/2, 3, 0, 0);
    shape.graphics.endFill();
    shape.graphics.endStroke();

    return shape;
};

b3editor.draw.memsequenceSymbol = function(block, settings, colorKind) {
    var colorKind = colorKind || 'registered';

    var shape = new createjs.Shape();

    var w = block._width;
    var h = block._height;
    var swidth = h/20;
    var ssize = h/4;
    var scolor = settings.get(colorKind + '_block_colors').symbol_color;

    shape.graphics.setStrokeStyle(swidth, 'round');
    shape.graphics.beginStroke(scolor);
    shape.graphics.beginFill(scolor);
    shape.graphics.drawPolyStar(0, -ssize*0.75, ssize/2, 6, ssize/10, 0);

    shape.graphics.setStrokeStyle(swidth, 'round');
    shape.graphics.beginStroke(scolor);
    shape.graphics.beginFill(scolor);
    shape.graphics.moveTo(-ssize, ssize/2);
    shape.graphics.lineTo(ssize, ssize/2);
    shape.graphics.drawPolyStar(ssize/2, ssize/2, ssize/2, 3, 0, 0);
    shape.graphics.endFill();
    shape.graphics.endStroke();

    return shape;
};

b3editor.draw.prioritySymbol = function(block, settings, colorKind) {
    var colorKind = colorKind || 'registered';

    // var shape = block.displayObject;
    // var shape = block._shapeObject;
    var shape = new createjs.Shape();

    var w = block._width;
    var h = block._height;
    var swidth = h/20;
    var ssize = h/8;
    var scolor = settings.get(colorKind + '_block_colors').symbol_color;

    shape.graphics.setStrokeStyle(swidth, 'round');
    shape.graphics.beginStroke(scolor);
    shape.graphics.arc(0, -ssize, ssize, 3.141561, 1.570796, false);
    shape.graphics.lineTo(0, ssize);
    shape.graphics.beginFill(scolor);
    shape.graphics.drawCircle(0, ssize*2, swidth/2);

    shape.graphics.endFill();
    shape.graphics.endStroke();

    return shape;
};

b3editor.draw.memprioritySymbol = function(block, settings, colorKind) {
    var colorKind = colorKind || 'registered';

    var shape = new createjs.Shape();

    var w = block._width;
    var h = block._height;
    var swidth = h/20;
    var ssize = h/8;
    var scolor = settings.get(colorKind + '_block_colors').symbol_color;

    shape.graphics.setStrokeStyle(swidth, 'round');
    shape.graphics.beginStroke(scolor);
    shape.graphics.arc(-ssize, -ssize, ssize, 3.141561, 1.570796, false);
    shape.graphics.lineTo(-ssize, ssize);
    shape.graphics.beginFill(scolor);
    shape.graphics.drawCircle(-ssize, ssize*2, swidth/2);
    shape.graphics.drawPolyStar(ssize*1.5, 0, ssize/2, 6, ssize/10, 0);

    shape.graphics.endFill();
    shape.graphics.endStroke();

    return shape;
};

b3editor.draw.textSymbol = function(block, settings) {
    var text = new createjs.Text(
        block.getTitle(),
        '18px Arial',
        '#333333'
    );
    
    text.textAlign = 'center';

    var bounds = text.getBounds();
    text.regY = bounds.height/2;

    // text.x = -block._width/2;
    // text.y = -block._height/2;

    return text;
}

}());
