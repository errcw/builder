/**
 * @fileoverview Builder game.
 */
var builder = (function() {

  /**
   * Builder game.
   * @constructor
   */
  function Builder() {
  }

  /**
   * Starts the game loop.
   */
  Builder.prototype.start = function() {
    var game = this;
    var canvas = $('#canvas');

    var frameTimeInMillis = 1000 / 30;
    var frameTimeInSeconds = frameTimeInMillis / 1000;
    var context = canvas[0].getContext('2d');

    // Work around http://bugs.jquery.com/ticket/9678
    setInterval(function() { }, 24*60*60*1000);

    var ba = new physics.Body(new physics.Circle(10), 10);
    ba.position = new physics.Vec2(120, 20);
    var bb = new physics.Body(new physics.Circle(25), 20);
    bb.position = new physics.Vec2(40, 60);
    var bc = new physics.Body(new physics.Box(30, 30), 20);
    bc.position = new physics.Vec2(30, 80);

    this.bodies = [ba, bb, bc];
    this.views = [new CircleView(ba), new CircleView(bb), new BoxView(bc)];

    for (var i = 0; i < this.bodies.length; i++) {
      for (var j = i + 1; j < this.bodies.length; j++) {
        var contacts = physics.collide(this.bodies[i], this.bodies[j]);
        if (contacts.length > 0) {
          this.views[i].collided = true;
          this.views[j].collided = true;
        }
      }
    }

    setInterval(function() {
      game.update(frameTimeInSeconds);
      game.draw(context);
    }, frameTimeInMillis);
  };

  Builder.WIDTH = 640;
  Builder.HEIGHT = 480;

  /**
   * Updates the game for the current frame.
   * @param dt {number} The elapsed time, in seconds, since the last update
   */
  Builder.prototype.update = function(dt) {
  };

  /**
   * Draw the game for the current frame.
   * @param ctx {object} The cavnas context to which to draw
   */
  Builder.prototype.draw = function(ctx) {
    // Draw the background and border
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, Builder.WIDTH, Builder.HEIGHT);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, Builder.WIDTH, Builder.HEIGHT);

    // Draw the bodies
    for (var i = 0; i < this.views.length; i++) {
      this.views[i].draw(ctx);
    }
  };


  /**
   * Displays a body with a Box shape.
   * @constructor
   */
  function BoxView(body) {
    this.body = body;
    this.collided = false;
  };

  BoxView.prototype.draw = function(ctx) {
    ctx.strokeStyle = this.collided ? '#ff0000' : '#000';
    ctx.fillStyle = '#eee';
    ctx.lineWidth = 3;
    var halfWidth = this.body.shape.size.x / 2;
    var halfHeight = this.body.shape.size.y / 2;
    ctx.fillRect(
        this.body.position.x - halfWidth,
        this.body.position.y - halfHeight,
        this.body.shape.size.x,
        this.body.shape.size.y);
    ctx.strokeRect(
        this.body.position.x - halfWidth,
        this.body.position.y - halfHeight,
        this.body.shape.size.x,
        this.body.shape.size.y);
  };


  /**
   * Displays a body with a Circle shape.
   * @constructor
   */
  function CircleView(body) {
    this.body = body;
    this.collided = false;
  };

  CircleView.prototype.draw = function(ctx) {
    ctx.strokeStyle = this.collided ? '#ff0000' : '#000';
    ctx.fillStyle = '#eee';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.body.position.x, this.body.position.y, this.body.shape.radius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };


  /**
   * @return {boolean} If the browser supports the functionality we need.
   */
  function isSupported_() {
    var canvas = document.createElement('canvas');
    var supportsCanvas = !!(canvas.getContext);
    var supportsText = !!(supportsCanvas && typeof canvas.getContext('2d').fillText === 'function');
    return supportsCanvas && supportsText;
  };

  /**
   * Indicates that external parts of the page are ready for the game to start.
   * @type {boolean}
   */
  var ready_ = false;

  /**
   * Starts the game loop.
   */
  function start_() {
    if (!isSupported_()) {
      $('#unsupported').show();
      $('#force-play').click(function() {
        $('#unsupported').fadeOut();
      });
    }
    // Even if the game is not supported, try to start it regardless so that
    // the unsupported banner has a background... maybe.
    new Builder().start();
  }

  return {
    ready: ready_,
    start: start_
  }
})();
