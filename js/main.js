/**
 * @author Darius de Witt <darius.dewitt@gmail.com>
 * @description JavaScript Raphael Experiment.
 *
 * ************************************************************************************************************
 * Based on http://caniuse.com/#feat=svg SVG support is high so I should be okay...                           *
 * Decided to experiment with SVG because they're flexible and practical.                                     *
 * If I were to do this in practice I think I'd just use a canvas.                                            *
 * Not sure if this would fall in the category of game or visiualization.                                     *
 * Played with Processing first, because I'm familiar with it, but been wanting to play with Raphael...       *
 * Would be a lot easier to print, export, and generally have external things interact with SVGs.             *
 * Made a generic shape, draggable dot and connecting line, so you could use this to make something bigger.   *
 * There's a lot that could be moved into a proper Raphael plugin, but I'll leave that for another time ;)    *
 * I started... but no time :lol:                                                                             *
 *                                                                                                            *
 * Sadly, as with most things, best experienced in Chrome.                                                    *
 *                                                                                                            *
 * I just found these:                                                                                        *
 * http://victorjs.org/                                                                                       *
 * http://jsxgraph.uni-bayreuth.de/wiki/index.php/Polygon                                                     *
 *                                                                                                            *
 * :face_palm:                                                                                                *
 * But then again, why not...                                                                                 *
 * ************************************************************************************************************
 */

var debug = false;

/**
 * These two functions are here because I don't want to mix jQuery stuff with Raphael stuff.
 *
 * Pop the shape info into the table.
 */
function setTableData(shapes) {
    if (shapes.length) {
        $('tr').each(function (i) {
            $(this).find('.counterType').html(shapes[i].type)
                .end().find('.counterValue').html(shapes[i].area);
        });
    }
}

/**
 * Clear the table.
 */
function clearTableData() {
    $('tr').each(function () {
        $(this).find('.counterType').html('')
            .end().find('.counterValue').html('');
    });
}

Raphael.fn.init = function () {
    this.shapes = [];
    this.temp = [];
};

Raphael.fn.setConfig = function (config) {
    this.config = config;
    this.init();
};

/**
 * General logging.
 *
 * @param {string} message
 * @param {string} level
 * @returns {undefined}
 */
Raphael.fn.log = function (message, level) {
    if (console[level] !== 'undefined') {
        console[level || 'log'](message);
    }
};
Raphael.fn.error = function (message) {
    this.log(message, 'error');
};
Raphael.fn.warn = function (message) {
    this.log(message, 'warn');
};

/**
 * Gets a circle's radius from its area.
 *
 * @param {number} area
 * @returns {number}
 */
Raphael.fn.radiusFromArea = function (area) {
    return Math.sqrt(area / Math.PI);
};

/**
 * Gets a circle's area from its radius.
 *
 * @param {number} radius
 * @returns {number}
 */
Raphael.fn.areaFromRadius = function (radius) {
    return Math.PI * Math.pow(radius, 2);
};

/**
 * Get's the diagonal of a parallelogram.
 *
 * @param {object} prev - A dot from R.drawDot()
 * @param {object} corner - A dot from R.drawDot()
 * @param {object} next - A dot from R.drawDot()
 * @returns {object} - A path from R.path()
 */
Raphael.fn.getDiagonal = function (prev, corner, next) {
    var xy = {
        x: prev.attr('cx') - corner.attr('cx') + next.attr('cx'),
        y: prev.attr('cy') - corner.attr('cy') + next.attr('cy')
    },
    path = 'M' + xy.x + ',' + xy.y + 'L' + corner.attr('cx') + ',' + corner.attr('cy') + 'Z';

    var type = 'hidden';
    if (this.config.debug) type = 'system';

    return this.path(path)
        .attr(this.config.themes[this.config.theme].line[type]).toBack();
};

/**
 * Draws a generic line, that can be connected to dots.
 *
 * @param {object} start - A dot from R.drawDot()
 * @param {object} end - A dot from R.drawDot()
 * @param {string} type - Changes the attributes from the theme. "system"/"hidden" etc.
 * @returns {object} - A path from R.path()
 */
Raphael.fn.drawLine = function (start, end, type) {
    var path = 'M' + start.attr('cx') + ',' + start.attr('cy') + 'L' + end.attr('cx') + ',' + end.attr('cy') + 'Z';
    var attributes = this.config.themes[this.config.theme].line[type || 'base'];

    var l = this.path(path)
        .attr(attributes).toBack();

    // The line will have it's start and end in the same place, behind the center of the dot.
    l.start = start;
    l.end = end;

    l.refresh = function () {
        this.attr({
            path: 'M' + this.start.attr('cx') + ',' + this.start.attr('cy') + 'L' + this.end.attr('cx') + ',' + this.end.attr('cy') + 'Z'
        });
    };

    return l;
};

/**
 * Draws our "big circle" for the assignment.
 *
 * @param {number} x
 * @param {number} y
 * @param {string} type - Changes the attributes from the theme. "system"/"hidden" etc.
 * @returns {object} - A circle from R.circle()
 */
Raphael.fn.drawBigCircle = function (x, y, type) {
    var raphael = this;
    var attributes = this.config.themes[this.config.theme].bigCircle[type || 'base'];
    var c = this.circle(x, y, this.config.themes[this.config.theme].bigCircle.base.size)
        .attr(attributes).toBack();

    c.area = this.areaFromRadius(this.config.themes[this.config.theme].bigCircle.base.size);

    c.refresh = function () {
        this.attr({
            r: raphael.radiusFromArea(this.area)
        });
    };

    c.getArea = function () {
        this.area = raphael.areaFromRadius(this.attr('r'));
        return this.area;
    };

    return c;
};

/**
 * Remove temporary shapes, so DOM doesn't get bloated.
 *
 * @returns {undefined}
 */
Raphael.fn.clearTemp = function () {
    for (var k in this.temp) {
        this.temp[k].remove();
    }
};

$(function () {

    // Init.
    var artboardId = 'artboard',
        artboardWidth = $('#' + artboardId).width(),
        artboardHeight = $('#' + artboardId).height(),
        dots = [],
        theme = 'default',
        themes = {},
        bigCircle,
        parallelogram;

    // To make a theme follow this structure :)
    themes.default = {
        dot: {
            base: {
                size: 5.5,
                fill: 'crimson',
                stroke: 'none',
                opacity: 1,
                cursor: 'move'
            },
            system: {
                fill: 'crimson',
                stroke: 'none',
                opacity: 0.5,
                cursor: 'move'
            }
        },
        dotHighlight: {
            base: {
                size: 0,
                fill: 'yellow',
                stroke: 'none',
                opacity: 0.3
            }
        },
        line: {
            base: {
                fill: 'none',
                stroke: 'navy',
                opacity: 0.5
            },
            system: {
                fill: 'none',
                stroke: 'grey',
                opacity: 0.5
            },
            hidden: {
                fill: 'none',
                stroke: 'none',
                opacity: 0
            }
        },
        bigCircle: {
            base: {
                size: 50,
                fill: 'none',
                stroke: 'yellow',
                opacity: 1
            }
        }
    };

    themes.lego = {
        dot: {
            base: {
                size: 5.5,
                fill: 'red',
                stroke: 'none',
                opacity: 1,
                cursor: 'move'
            },
            system: {
                fill: 'pink',
                stroke: 'none',
                opacity: 1,
                cursor: 'move'
            }
        },
        dotHighlight: {
            base: {
                size: 0,
                fill: 'none',
                stroke: 'red',
                opacity: 1
            }
        },
        line: {
            base: {
                fill: 'none',
                stroke: 'blue',
                opacity: 1
            },
            system: {
                fill: 'none',
                stroke: 'grey',
                opacity: 1
            },
            hidden: {
                fill: 'none',
                stroke: 'none',
                opacity: 0
            }
        },
        bigCircle: {
            base: {
                size: 50,
                fill: 'yellow',
                stroke: 'none',
                opacity: 1
            }
        }
    };

    // Create the artboard/paper.
    var R = Raphael(artboardId, artboardWidth, artboardHeight);
    R.setConfig({
        debug: debug,
        theme: theme,
        themes: themes
    });

    // Drag functions.
    var start = function () {
        this.moving = true;

        // Original position of dot.
        this.ox = this.attr('cx');
        this.oy = this.attr('cy');

        this.highlight.animate({
            r: 20
        }, 1, 'elastic');
    }, move = function (dx, dy) {
        this.attr({
            cx: this.ox + dx,
            cy: this.oy + dy
        });

        // Each dot/line/shape has a refresh method.
        this.refresh();

        // Update the position/data of everything.
        for (var i in R.shapes) {
            R.shapes[i].refresh();
        }

        // Set the circle and parallelogram to have the same area.
        if (typeof bigCircle !== 'undefined') {
            bigCircle.area = parallelogram.getArea();
        }

        setTableData(R.shapes);
    }, end = function () {
        this.highlight.animate({
            r: 0
        }, 1, 'elastic');

        // Clear all temp elements.
        R.clearTemp();
        this.moving = false;
    };

    /**
     * Draws a generic draggable dot, which can have lines connected to it.
     *
     * @param {number} x
     * @param {number} y
     * @param {string} type - Changes the attributes from the theme. "system"/"hidden" etc.
     * @returns {object} - A circle from R.circle()
     */
    R.drawDot = function (x, y, type) {
        var attributes = themes[theme].dot[type || 'base'];
        var d = this.circle(x, y, themes[theme].dot.base.size)
            .attr(attributes).toFront().drag(move, start, end);

        d.moving = false;
        d.lines = [];
        d.highlight = this.circle(x, y, themes[theme].dotHighlight.base.size)
            .attr(themes[theme].dotHighlight.base).toBack();
        d.text = this.text(d.attr('cx') + 20, d.attr('cy') + 14, d.attr('cx') + ',' + d.attr('cy'))
            .toFront();

        d.refresh = function () {
            this.highlight.attr({
                cx: this.attr('cx'),
                cy: this.attr('cy')
            });
            this.text.attr({
                x: this.attr('cx') + 20,
                y: this.attr('cy') + 14,
                text: this.attr('cx') + ',' + this.attr('cy')
            });
        };

        return d;
    };

    /**
     * Creates a generic shape based on the dots, by joining them together with lines.
     *
     * @param {array} dots - An array of dots from R.drawDot()
     * @returns {object} - A collection of dots and lines from R.drawDot() and R.drawLine()
     */
    R.createShape = function (dots) {
        var next, prev, s = {
            type: 'shape',
            area: 0,
            dots: dots,
            lines: []
        };

        // Connect the dots.
        for (var i in s.dots) {
            if (!Raphael.is(s.dots[+i + 1], 'undefined')) {
                next = +i + 1;
            } else {
                next = 0;
            }

            var line = this.drawLine(s.dots[i], s.dots[next]);
            // Store the dot's lines in the dot.
            s.dots[i].lines.push(line);
            s.lines.push(line);
        }

        // Connect the line to the other dot.
        for (var i in s.dots) {
            if (!Raphael.is(s.dots[+i - 1], 'undefined')) {
                prev = +i - 1;
            } else {
                prev = s.dots.length - 1;
            }

            s.dots[i].lines.push(s.dots[prev].lines[0]);
            s.dots[prev].lines[0].end = s.dots[i];
        }

        s.refresh = function () {
            for (var i in this.lines) {
                this.lines[i].refresh();
            }
        };

        return s;
    },

    /**
     * Creates a parallelogram based on the dots, by joining them together with lines.
     * Sides will remain parallel.
     *
     * @param {array} dots - An array of dots from R.drawDot()
     * @returns {object} - A collection of dots and lines from R.drawDot() and R.drawLine()
     */
    R.parallelogram = function (dots) {
        if (Raphael.is(dots, 'undefined') ||
            !Raphael.is(dots, 'array') ||
            dots.length !== 3) {

            // Log error and return false.
            R.warn('When creating a parallelogram you must provide 3 dots.');
            return false;
        }

        // Create fourth dot.
        var diagonal = R.getDiagonal(dots[0], dots[1], dots[2]);
        R.temp.push(diagonal);

        var diagXY = diagonal.getPointAtLength(diagonal.getTotalLength());
        dots.push(R.drawDot(diagXY.x, diagXY.y, 'system'));

        var p = {
            type: 'parallelogram',
            area: 0,
            dots: dots,
            lines: []
        }, shape = this.createShape(dots);

        p.dots = shape.dots;
        p.lines = shape.lines;

        // @todo Rewrite these 3 blocks!
        // Although it's not that bad, parallelograms always have 4 points...
        // Set a reference to the opposite/next/previous dots.
        // Raphael next/prev won't always work.
        p.dots[0].oppoDot = p.dots[2];
        p.dots[1].oppoDot = p.dots[3];
        p.dots[2].oppoDot = p.dots[0];
        p.dots[3].oppoDot = p.dots[1];

        p.dots[0].nextDot = p.dots[1];
        p.dots[1].nextDot = p.dots[2];
        p.dots[2].nextDot = p.dots[3];
        p.dots[3].nextDot = p.dots[0];

        p.dots[0].prevDot = p.dots[3];
        p.dots[1].prevDot = p.dots[0];
        p.dots[2].prevDot = p.dots[1];
        p.dots[3].prevDot = p.dots[2];

        p.refresh = function () {
            for (var i in this.dots) {
                if (this.dots[i].moving === true) {

                    var diag = R.getDiagonal(this.dots[i].prevDot, this.dots[i], this.dots[i].nextDot);
                    R.temp.push(diag);

                    var xy = diag.getPointAtLength(diag.getTotalLength());
                    this.dots[i].oppoDot.attr({
                        cx: xy.x,
                        cy: xy.y
                    });

                    this.dots[i].oppoDot.refresh();
                }
            }

            for (var i in this.lines) {
                this.lines[i].refresh();
            }

            this.area = this.getArea();
        };

        p.getCenter = function () {
            var x = 0,
                y = 0;

            for (var i in this.dots) {
                x += this.dots[i].attr('cx');
                y += this.dots[i].attr('cy');
            }

            return {
                x: x / 4,
                y: y / 4
            };
        };

        p.getArea = function () {
            var x1 = this.dots[0].attr('cx'),
                y1 = this.dots[0].attr('cy'),
                x2 = this.dots[1].attr('cx'),
                y2 = this.dots[1].attr('cy'),
                x3 = this.dots[2].attr('cx'),
                y3 = this.dots[2].attr('cy');

            var degrees = Raphael.angle(x1, y1, x3, y3, x2, y2);
            var radians = Raphael.rad(Math.abs(degrees));

            var side1 = Math.sqrt(Math.pow(Math.abs(x1 - x2), 2) + Math.pow(Math.abs(y1 - y2), 2));
            var side2 = Math.sqrt(Math.pow(Math.abs(x2 - x3), 2) + Math.pow(Math.abs(y2 - y3), 2));

            return Math.abs((side1 * side2) * Math.sin(radians));
        };

        return p;
    };

    /**
     * Reset counters and other important variables.
     *
     * @returns {undefined}
     */
    R.reset = function () {
        bigCircle = undefined;
        parallelogram = undefined;
        dots = [];

        this.init();
        this.clear();
    };

    /**
     * When the user clicks the artboard, create dots, till it's time to create the parallelogram.
     */
    $('#artboard svg:first').on('click', function (e) {

        // Don't create a dot if clicking on a dot.
        for (var i in dots) {
            if (dots[i].isPointInside(e.offsetX, e.offsetY)) {
                return false;
            }
        }

        // Draw a dot for each click on the root element, till we reach the limit.
        if (dots.length < 4) {

            var dot = R.drawDot(e.offsetX, e.offsetY);
            dots.push(dot);

            // Finish:
            if (dots.length === 3) {

                // Parallelogram.
                parallelogram = R.parallelogram(dots);
                R.shapes.push(parallelogram);

                // Get area for circle.
                var area = parallelogram.getArea();
                themes[theme].bigCircle.base.size = R.radiusFromArea(area);

                // Circle.
                var center = parallelogram.getCenter();
                bigCircle = R.drawBigCircle(center.x, center.y);
                R.shapes.push(bigCircle);


                // Show the examples.
                //
                // Generic dot.
                R.drawDot(150, 450);

                // Generic shape.
                var genericShape = R.createShape([
                    R.drawDot(100, 200),
                    R.drawDot(200, 100),
                    R.drawDot(220, 180),
                    R.drawDot(170, 340),
                    R.drawDot(70, 300)
                ]);
                R.shapes.push(genericShape);

                // Connect a dot to the shape.
                var genericDot = R.drawDot(100, 400);
                var genericLine = R.drawLine(genericDot, genericShape.dots[3]);

                // Store the dot's lines in the dot.
                genericDot.lines.push(genericLine);
                genericShape.lines.push(genericLine);
            }
        }

        // Refresh all the shapes/coordinates/areas etc.
        for (var i in R.shapes) {
            R.shapes[i].refresh();
        }

        setTableData(R.shapes);

        // Clear temp shapes.
        R.clearTemp();
    });


    /********************************************************
       General ugly jQuery stuff. Ignore below this line :P
     ********************************************************/

    $('#aboutButton').on('click', function (e) {
        e.preventDefault();
        $('#aboutPopWrapper').fadeIn();
    });

    $('#aboutPopWrapper').on('click', function (e) {
        e.preventDefault();
        $('#aboutPopWrapper').fadeOut();
    });

    $('#debugButton').on('click', function (e) {
        e.preventDefault();

        debug = !debug;
        R.config.debug = debug;
        if (debug) {
            alert('Debug mode is now enabled. You\'ll be able to see pretty lines and make cool flowers/snowflakes :)');
        } else {
            alert('Debug mode disabled... but it\'s so much prettier with it XD');
        }
    });

    $('#themeButton').on('click', function (e) {
        e.preventDefault();
        clearTableData();
        R.reset();

        if (theme === 'default') {
            theme = 'lego';
        } else {
            theme = 'default';
        }
        R.config.theme = theme;
    });

    $('#resetButton').on('click', function (e) {
        e.preventDefault();
        clearTableData();
        R.reset();
    });

});
