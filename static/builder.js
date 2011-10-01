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
   * Mode describing the behavior of the cursor.
   */
  Builder.Mode = {
    SELECT: 1,
    CREATE_BOX : 2
  };

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


    this.world = this.createWorld();

    this.views = [];
    for (var i = 0; i < this.world.bodies.length; i++) {
      this.views.push(createView(this.world.bodies[i]));
    }


    this.mode = Builder.Mode.SELECT;
    this.pointer = new physics.Body(new physics.Box(1, 1), 1);
    this.selection = null;

    var toggle = $('#toggle');
    toggle.click(function() {
      toggle.toggleClass('move');
      toggle.toggleClass('create');
      game.mode = toggle.hasClass('move') ? Builder.Mode.SELECT : Builder.Mode.CREATE_BOX;
    });

    canvas.mousedown(function(e) {
      switch (game.mode) {
        case Builder.Mode.SELECT:
          // Check for selection of an existing body
          game.pointer.position = physics.Vec2.of(e.offsetX, e.offsetY);

          for (var i = 0; i < game.world.bodies.length; i++) {
            // Disallow selection of immovable objects (e.g., the ground)
            if (game.world.bodies[i].mass == Number.MAX_VALUE) {
              continue;
            }

            var contacts = physics.collide(game.world.bodies[i], game.pointer);

            if (contacts.length > 0) {
              var selected = game.world.bodies[i];

              var selectedView = game.views[i];
              selectedView.selected = true;

              game.selection = {
                body: selected,
                view: selectedView,
                position: selected.position,
                dx: e.offsetX - selected.position.x,
                dy: e.offsetY - selected.position.y
              };

              break;
            }
          }
          break;

        case Builder.Mode.CREATE_BOX:
          // Start creating a new box
          game.newBody = new physics.Body(new physics.Box(1, 1), 20000);
          game.newBody.position = physics.Vec2.of(e.offsetX, e.offsetY);
          game.newBody.rotation = 0;
          game.views.push(createView(game.newBody));
          game.newBodyStart = physics.Vec2.of(e.offsetX, e.offsetY);
          break;
      }
    });

    canvas.mousemove(function(e) {
      switch (game.mode) {
        case Builder.Mode.SELECT:
          if (!game.selection) {
            return;
          }
          // Update the position of the cursor
          game.selection.position = physics.Vec2.of(
              e.offsetX + game.selection.dx,
              e.offsetY + game.selection.dy)
          break;

        case Builder.Mode.CREATE_BOX:
          if (!game.newBody) {
            return;
          }
          // Update the size/position of the box
          var dx = e.offsetX - game.newBodyStart.x;
          var dy = e.offsetY - game.newBodyStart.y;
          game.newBody.shape.setSize(Math.abs(dx), Math.abs(dy));
          game.newBody.position.x = game.newBodyStart.x + dx * 0.5;
          game.newBody.position.y = game.newBodyStart.y + dy * 0.5;
          break;
      }
    });

    canvas.mouseup(function(e) {
      switch (game.mode) {
        case Builder.Mode.SELECT:
          if (!game.selection) {
            return;
          }
          // Clear the selection
          game.selection.view.selected = false;
          game.selection = null;
          break;

        case Builder.Mode.CREATE_BOX:
          if (!game.newBody) {
            return;
          }

          // Ensure the new box does not collide with anything in the world
          var colliding = false;
          for (var i = 0; i < game.world.bodies.length; i++) {
            var contacts = physics.collide(game.world.bodies[i], game.newBody);
            if (contacts.length > 0) {
              colliding = true;
              break;
            }
          }

          // Remove the view for the temporary box
          game.views.pop();

          // Add the new box if it is viable
          if (!colliding) {
            var body = new physics.Body(game.newBody.shape, 20000);
            body.position = game.newBody.position;
            body.rotation = game.newBody.rotation;
            game.world.addBody(body);
            game.views.push(createView(body));
          }
          game.newBody = null;
          break;
      }
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
    if (this.selection) {
      var toPointer = physics.Vec2.sub(
          this.selection.position,
          this.selection.body.position);
      if (toPointer.x != 0 || toPointer.y != 0) {
        var directionToPointer = physics.Vec2.normalize(toPointer);
        var distanceToPointer = physics.Vec2.len(toPointer);
        //TODO force proportional to size/mass of body
        var force = physics.Vec2.scale(
            directionToPointer,
            distanceToPointer * 1000000000);
        this.selection.body.force = force;
      }
    }

    this.world.update(dt);

    // Force the selected piece to stop moving (prevents bad behavior)
    if (this.selection) {
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
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, Builder.WIDTH, Builder.HEIGHT);
  };

  /**
   * Creates and returns a world with some interesting initial state.
   */
  Builder.prototype.createWorld = function() {
    var world = new physics.World();

    var ground = new physics.Body(new physics.Box(Builder.WIDTH + 100, 50), Number.MAX_VALUE);
    ground.position = physics.Vec2.of(Builder.WIDTH / 2, Builder.HEIGHT - 25);
    ground.rotation = 0;
    world.addBody(ground);

    var PYRAMID_HEIGHT = 5;
    var PYRAMID_SPACING = 35;

    var yBase = ground.position.y - ground.shape.size.y - 5;
    for (var row = 0; row < PYRAMID_HEIGHT; row++) {
      var cols = PYRAMID_HEIGHT - row;
      var xBase = (Builder.WIDTH / 2) - (cols / 2) * PYRAMID_SPACING;
      for (var col = 0; col < cols; col++) {
        var box = new physics.Body(new physics.Box(30, 30), 20000);
        box.position = physics.Vec2.of(xBase + col * PYRAMID_SPACING, yBase - row * PYRAMID_SPACING);
        box.rotation = 0;
        world.addBody(box);
      }
    }

    return world;
  };

  /**
   * @return {Body} The first body in the world colliding with the given body
   */
  Builder.prototype.getFirstCollision = function(body) {
    //TODO factor out some common code
  };


  /**
   * Displays a body with a Box shape.
   * @constructor
   */
  function BoxView(body) {
    this.body = body;
    this.selected = false;
  };

  BoxView.prototype.draw = function(ctx) {
    var width = this.body.shape.size.x;
    var height = this.body.shape.size.y;

    ctx.save();

    ctx.strokeStyle = this.selected ? '#ff0000' : '#555';
    ctx.fillStyle = '#eee';
    ctx.lineWidth = 1;

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
    ctx.strokeStyle = this.collided ? '#ff0000' : '#555';
    ctx.fillStyle = '#eee';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(
        this.body.position.x,
        this.body.position.y,
        this.body.shape.radius,
        0,
        Math.PI * 2,
        true);
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
      $('#dismiss').click(function() {
        $('#unsupported').fadeOut();
      });
    }
    new Builder().start();
  }

  return {
    ready: ready_,
    start: start_
  }
})();
