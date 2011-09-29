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

  Builder.WIDTH = 640;
  Builder.HEIGHT = 480;

  /**
   * Starts the game loop.
   */
  Builder.prototype.start = function() {
    var game = this;
    var canvas = $('#canvas');

    var frameTimeInMillis = 1000 / 60;
    var frameTimeInSeconds = frameTimeInMillis / 1000;
    var context = canvas[0].getContext('2d');

    // Work around http://bugs.jquery.com/ticket/9678
    setInterval(function() { }, 24*60*60*1000);

    var ground = new physics.Body(new physics.Box(Builder.WIDTH, 40), Number.MAX_VALUE);
    ground.position = physics.Vec2.of(Builder.WIDTH / 2, Builder.HEIGHT);
    ground.rotation = 0;

    var box1 = new physics.Body(new physics.Box(20, 20), 20000);
    box1.position = physics.Vec2.of(120, 420);
    box1.rotation = 0;

    var box2 = new physics.Body(new physics.Box(20, 20), 20000);
    box2.position = physics.Vec2.of(120, 380);
    box2.rotation = 0;

    var box3 = new physics.Body(new physics.Box(20, 20), 20000);
    box3.position = physics.Vec2.of(120, 340);
    box3.rotation = 0;

    var b = new physics.Body(new physics.Box(20, 20), 20000);
    b.position = physics.Vec2.of(420, 340);

    var j = new physics.Joint(ground, b, physics.Vec2.of(440, 340));

    this.bodies = [ground, box1, box2, box3, b];

    this.world = new physics.World();
    for (var i = 0; i < this.bodies.length; i++) {
      this.world.addBody(this.bodies[i]);
    }
    this.world.addJoint(j);

    this.views = [];
    for (var i = 0; i < this.bodies.length; i++) {
      this.views.push(createView(this.bodies[i]));
    }

    this.pointer = new physics.Body(new physics.Box(1, 1), 1);
    this.selection = {
      body: null,
      dx: 0,
      dy: 0
    };

    canvas.mousedown(function(e) {
      game.pointer.position = physics.Vec2.of(e.offsetX, e.offsetY);

      // Check for selection of an existing body
      for (var i = 0; i < game.bodies.length; i++) {
        var contacts = physics.collide(game.bodies[i], game.pointer);
        if (contacts.length > 0) {
          game.views[i].collided = true;

          game.selection.body = game.bodies[i];
          game.selection.position = game.selection.body.position;
          game.selection.dx = e.offsetX - game.selection.body.position.x;
          game.selection.dy = e.offsetY - game.selection.body.position.y;

          return;
        }
      }

      // Otherwise start creating a new body
      game.newBody = new physics.Body(new physics.Box(30, 30), 20000);
      game.newBody.position = physics.Vec2.of(e.offsetX, e.offsetY);
      game.newBody.rotation = 0;
      game.views.push(createView(game.newBody));
    });

    canvas.mousemove(function(e) {
      if (game.selection.body != null) {
        game.selection.position = physics.Vec2.of(
            e.offsetX + game.selection.dx,
            e.offsetY + game.selection.dy)
      }

      if (game.newBody != null) {
        var sizeX = Math.abs(e.offsetX - game.newBody.position.x);
        var sizeY = Math.abs(e.offsetY - game.newBody.position.y);
        game.newBody.shape.setSize(sizeX, sizeY);
      }
    });

    canvas.mouseup(function(e) {
      for (var i = 0; i < game.bodies.length; i++) {
        game.views[i].collided = false;
      }

      if (game.selection.body != null) {
        game.selection.body = null;
      }

      if (game.newBody != null) {
        game.bodies.push(game.newBody);
        game.world.addBody(game.newBody);
      }
      game.newBody = null;
    });

    setInterval(function() {
      game.update(frameTimeInSeconds);
      game.draw(context);
    }, frameTimeInMillis);
  };

  /**
   * Updates the game for the current frame.
   * @param dt {number} The elapsed time, in seconds, since the last update
   */
  Builder.prototype.update = function(dt) {
    // Add a force to pull the selected piece to the pointer
    if (this.selection.body != null) {
      var toPointer = physics.Vec2.sub(
          this.selection.position,
          this.selection.body.position);
      if (toPointer.x != 0 || toPointer.y != 0) {
        var directionToPointer = physics.Vec2.normalize(toPointer);
        var distanceToPointer = physics.Vec2.len(toPointer);
        var force = physics.Vec2.scale(
            directionToPointer,
            distanceToPointer * 1000000000);
        this.selection.body.force = force;
      }
    }

    this.world.update(dt);

    // Force the selected piece to stop moving (prevents bad behavior)
    if (this.selection.body != null) {
      this.selection.body.velocity = physics.Vec2.of(0, 0);
      this.selection.body.angularVelocity = 0;
    }
  };

  /**
   * Draw the game for the current frame.
   * @param ctx {object} The cavnas context to which to draw
   */
  Builder.prototype.draw = function(ctx) {
    // Draw the background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, Builder.WIDTH, Builder.HEIGHT);

    // Draw the bodies
    for (var i = 0; i < this.views.length; i++) {
      this.views[i].draw(ctx);
    }

    // Draw the border
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, Builder.WIDTH, Builder.HEIGHT);
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
    var width = this.body.shape.size.x;
    var height = this.body.shape.size.y;

    ctx.save();

    ctx.strokeStyle = this.collided ? '#ff0000' : '#000';
    ctx.fillStyle = '#eee';
    ctx.lineWidth = 3;

    ctx.translate(this.body.position.x, this.body.position.y);
    ctx.rotate(this.body.rotation);
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.strokeRect(-width / 2, -height / 2, width, height);

    ctx.restore();
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
   * Creates a view for the given body.
   * @param body {Body} The body to view
   * @return {object} A view for the body
   */
  function createView(body) {
    var shape = Object.getPrototypeOf(body.shape).constructor;
    if (shape === physics.Box) {
      return new BoxView(body);
    } else if (shape === physics.Circle) {
      return new CircleView(body);
    }
    return null;
  }

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
