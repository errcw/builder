/**
 * @fileoverview Builder game.
 */
var builder = (function() {

  /**
   * Builder game.
   * @constructor
   */
  function Builder() { }

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

    var share = $('#share');
    share.click(function() {
      $.ajax({
        type: 'POST',
        url: builder.baseUrl + 'worlds/',
        data: {
          'world': game.getSerializedWorld(),
          'thumbnail': game.getWorldThumbnail()
        },
        success: function(response) {
          google.sendPost({
            title: 'Check out what I built!',
            body: 'Come check out what I built!',
            anchorText: 'Check It Out',
            params: {id: response.id},
            images: [builder.baseUrl + response.thumbnail_url]
          });
        },
        error: function() {
          showError_('Uh oh, there was a problem sharing your work.');
        }
      });
    });

    canvas.mousedown(function(e) { game.onMouseDown(e); });
    canvas.mousemove(function(e) { game.onMouseMove(e); });
    canvas.mouseup(function(e) { game.onMouseUp(e, false); });
    canvas.mouseleave(function(e) { game.onMouseUp(e, true); });

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
        var force = physics.Vec2.scale(
            directionToPointer,
            distanceToPointer * this.selection.body.density * 500);
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

    if (this.newBodyView != null) {
      this.newBodyView.draw(ctx);
    }

    // Draw the border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, Builder.WIDTH, Builder.HEIGHT);
  };

  /**
   * Handles when the mouse is clicked.
   * @param e Mouse event data
   */
  Builder.prototype.onMouseDown = function(e) {
    switch (this.mode) {
      case Builder.Mode.SELECT:
        // Check for selection of an existing body
        this.pointer.position = physics.Vec2.of(e.offsetX, e.offsetY);

        var selected = this.getCollidingBody(this.pointer);

        // Disallow selection of immovable objects (e.g., the ground)
        if (!selected || selected.mass == Number.MAX_VALUE) {
          break;
        }

        var selectedView = this.highlightView(selected);
        selectedView.selected = true;

        this.selection = {
          body: selected,
          view: selectedView,
          position: selected.position,
          dx: selected.position.x - e.offsetX,
          dy: selected.position.y - e.offsetY
        };
        break;

      case Builder.Mode.CREATE_BOX:
        // Start creating a new box
        this.newBody = new physics.Body(new physics.Box(1, 1), 20000);
        this.newBody.position = physics.Vec2.of(e.offsetX, e.offsetY);
        this.newBody.rotation = 0;
        this.newBodyStart = physics.Vec2.of(e.offsetX, e.offsetY);
        this.newBodyView = createView(this.newBody);
        break;
    }
  };

  /**
   * Handles when the mouse is moved.
   * @param e Mouse event data
   */
  Builder.prototype.onMouseMove = function(e) {
    switch (this.mode) {
      case Builder.Mode.SELECT:
        if (!this.selection) {
          return;
        }
        this.selection.position = physics.Vec2.of(
            e.offsetX + this.selection.dx,
            e.offsetY + this.selection.dy)
        break;

      case Builder.Mode.CREATE_BOX:
        if (!this.newBody) {
          return;
        }
        // Update the size/position of the box
        var dx = e.offsetX - this.newBodyStart.x;
        var dy = e.offsetY - this.newBodyStart.y;
        this.newBody.shape.setSize(Math.abs(dx), Math.abs(dy));
        this.newBody.position.x = this.newBodyStart.x + dx * 0.5;
        this.newBody.position.y = this.newBodyStart.y + dy * 0.5;
        this.newBodyView.invalid = !this.canCreate(this.newBody);
        break;
    }
  };

  /**
   * Handles when the mouse is released, or leaves the canvas.
   * @param e Mouse event data
   * @param didLeave {boolean} If this event fired because the mouse left
   */
  Builder.prototype.onMouseUp = function(e, didLeave) {
    switch (this.mode) {
      case Builder.Mode.SELECT:
        if (!this.selection) {
          return;
        }

        // Apply a final force
        if (!didLeave) {
          var toPointer = physics.Vec2.sub(
              this.selection.position,
              this.selection.body.position);
          if (toPointer.x != 0 || toPointer.y != 0) {
            var directionToPointer = physics.Vec2.normalize(toPointer);
            var distanceToPointer = physics.Vec2.len(toPointer);
            var force = physics.Vec2.scale(
                directionToPointer,
                distanceToPointer * this.selection.body.density * 200);
            this.selection.body.force = force;
          }
        }

        // Clear the selection
        this.selection.view.selected = false;
        this.selection = null;
        break;

      case Builder.Mode.CREATE_BOX:
        if (!this.newBody) {
          return;
        }

        // Add the new box if it is viable
        if (!didLeave && this.canCreate(this.newBody)) {
          var body = new physics.Body(this.newBody.shape, 20000);
          body.position = this.newBody.position;
          body.rotation = this.newBody.rotation;
          this.world.addBody(body);
          this.views.push(createView(body));
        }
        this.newBody = null;
        this.newBodyView = null;
        break;
    }
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
   * @return A JSON-stringified version of the current world state.
   */
  Builder.prototype.getSerializedWorld = function() {
    return '{}';
  };

  /**
   * @return A data url encoding a thumbnail of the current world state.
   */
  Builder.prototype.getWorldThumbnail = function() {
    var canvas = $('#canvas')[0];

    var scale = 6;
    var scaledWidth = Math.round(canvas.width / scale);
    var scaledHeight = Math.round(canvas.height / scale);

    var scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = scaledWidth;
    scaledCanvas.height = scaledHeight;

    var scaledCtx = scaledCanvas.getContext('2d');
    scaledCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, scaledWidth, scaledHeight);

    return scaledCanvas.toDataURL();
  };


  /**
   * @return {Body} The first body in the world colliding with the given body
   */
  Builder.prototype.getCollidingBody = function(body) {
    for (var i = 0; i < this.world.bodies.length; i++) {
      var contacts = physics.collide(this.world.bodies[i], body);
      if (contacts.length > 0) {
        return this.world.bodies[i];
      }
    }
  };

  /**
   * Highlights the view of the given body (i.e., causes it to be drawn last
   * such that no other body may obscure it).
   * @return {object} The view of the given body
   */
  Builder.prototype.highlightView = function(body) {
    for (var i = 0; i < this.views.length; i++) {
      if (this.views[i].body == body) {
        var highlightedView = this.views[i];
        this.views[i] = this.views[this.views.length - 1];
        this.views[this.views.length - 1] = highlightedView;
        return highlightedView;
      }
    }
    return null;
  };

  /**
   * @return {boolean} If it is safe to add the given body to the world
   */
  Builder.prototype.canCreate = function(body) {
    return this.getCollidingBody(body) == null;
  };


  /**
   * Displays a body with a Box shape.
   * @constructor
   */
  function BoxView(body) {
    this.body = body;
    this.selected = false;
    this.invalid = false;
  };

  BoxView.prototype.draw = function(ctx) {
    var width = this.body.shape.size.x;
    var height = this.body.shape.size.y;

    ctx.save();

    ctx.strokeStyle = this.selected ? '#111' : this.invalid ? '#ff0000' : '#555';
    ctx.fillStyle = '#eee';
    ctx.lineWidth = this.selected ? 3 : 1;

    ctx.translate(this.body.position.x, this.body.position.y);
    ctx.rotate(this.body.rotation);
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.strokeRect(-width / 2, -height / 2, width, height);

    ctx.restore();
  };

  BoxView.createColor = function(r, g, b) {
    return 'rgb( ' + Math.round(r) + ', ' + Math.round(g) + ', ' + Math.round(b) + ')';
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
   * Displays a dismissable error bar above the game.
   * @param text {string} The error text to show the user
   */
  function showError_(text) {
    $('#error-text').text(text);
    $('#error-bar').fadeIn();
      $('#dismiss').click(function() {
        $('#error-bar').fadeOut();
      });
  }

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
      showError_('Builder may not work well in your browser.');
    }
    new Builder().start();
  }

  return {
    ready: ready_,
    start: start_
  }
})();
