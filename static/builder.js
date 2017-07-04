/**
 * @fileoverview Builder game.
 */
const builder = (function() {

  /**
   * Builder game.
   * @param initialWorldData The initial world state to use, or none for a fresh world
   * @constructor
   */
  function Builder(initialWorldData) {
    const game = this;

    // Build the world
    if (initialWorldData) {
      this.world = this.getDeserializedWorld(initialWorldData);
    } else {
      this.world = this.createWorld();
    }

    this.views = [];
    for (let i = 0; i < this.world.bodies.length; i++) {
      this.views.push(createView(this.world.bodies[i]));
    }

    this.cleanTicks = Builder.WORLD_CLEAN_TICK_INTERVAL;

    // Build the interaction data
    this.mode = Builder.Mode.SELECT;
    this.pointer = new physics.Body(new physics.Box(1, 1), 1);
    this.selection = null;

    // Add the button handlers
    const move = $('#move');
    const create = $('#create');
    move.click(function() {
      game.mode = Builder.Mode.SELECT;
      move.addClass('active');
      create.removeClass('active');
    });
    create.click(function() {
      game.mode = Builder.Mode.CREATE_BOX;
      create.addClass('active');
      move.removeClass('active');
    });

    const share = $('#share');
    share.click(function() {
      $.ajax({
        type: 'POST',
        url: builder.baseUrl + 'worlds/',
        data: {
          'world': game.getSerializedWorld(),
          'thumbnail': game.getWorldThumbnail()
        },
        success: function(response) {
          console.log('Uploaded world ' + response.id);
          const url = builder.baseUrl + '#' + response.id;
          showInfo_('<a href="' + url + '">Link to share</a>');
        },
        error: function() {
          showError_('Uh oh, there was a problem sharing your work.');
        }
      });
    });

    // Add the canvas handlers
    this.canvas = $('#canvas');
    this.canvas.mousedown(function(e) { game.onMouseDown(e); });
    this.canvas.mousemove(function(e) { game.onMouseMove(e); });
    this.canvas.mouseup(function(e) { game.onMouseUp(e, false); });
    this.canvas.mouseleave(function(e) { game.onMouseUp(e, true); });
  }

  /** Width and height of the canvas, in pixels. */
  Builder.WIDTH = 640;
  Builder.HEIGHT = 480;

  /** Mode describing the behavior of the cursor. */
  Builder.Mode = {
    SELECT: 1,
    CREATE_BOX : 2
  };

  /** Number of updates between world cleaning. */
  Builder.WORLD_CLEAN_TICK_INTERVAL = 60;

  /**
   * Starts the game loop running at 60 FPS.
   */
  Builder.prototype.start = function() {
    const frameTimeInMillis = 1000 / 60;
    const frameTimeInSeconds = frameTimeInMillis / 1000;

    const game = this;
    const context = this.canvas[0].getContext('2d');

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
      const toPointer = physics.Vec2.sub(
          this.selection.position,
          this.selection.body.position);
      if (toPointer.x != 0 || toPointer.y != 0) {
        const directionToPointer = physics.Vec2.normalize(toPointer);
        const distanceToPointer = physics.Vec2.len(toPointer);
        const force = physics.Vec2.scale(
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

    // Remove objects outside the frame
    this.cleanTicks -= 1;
    if (this.cleanTicks <= 0) {
      let bodiesToRemove = [];
      for (let i = 0; i < this.world.bodies.length; i++) {
        const body = this.world.bodies[i];
        if (body.position.y > Builder.HEIGHT * 2) {
          bodiesToRemove.push(body);
        }
      }
      for (let i = 0; i < bodiesToRemove.length; i++) {
        this.world.removeBody(bodiesToRemove[i]);
      }
      this.cleanTicks = Builder.WORLD_CLEAN_TICK_INTERVAL;
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
    for (let i = 0; i < this.views.length; i++) {
      this.views[i].draw(ctx);
    }

    if (this.newBodyView != null) {
      this.newBodyView.draw(ctx);
    }

    // Draw the border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, Builder.WIDTH, Builder.HEIGHT);
  };

  /**
   * Handles when the mouse is clicked.
   * @param e Mouse event data
   */
  Builder.prototype.onMouseDown = function(e) {
    const mx = e.pageX - this.canvas.offset().left;
    const my = e.pageY - this.canvas.offset().top;
    switch (this.mode) {
      case Builder.Mode.SELECT:
        // Check for selection of an existing body
        this.pointer.position = physics.Vec2.of(mx, my);

        const selected = this.getCollidingBody(this.pointer);

        // Disallow selection of immovable objects (e.g., the ground)
        if (!selected || selected.mass == Number.MAX_VALUE) {
          break;
        }

        const selectedView = this.highlightView(selected);
        selectedView.selected = true;

        this.selection = {
          body: selected,
          view: selectedView,
          position: selected.position,
          dx: selected.position.x - mx,
          dy: selected.position.y - my
        };
        break;

      case Builder.Mode.CREATE_BOX:
        // Start creating a new box
        this.newBody = new physics.Body(new physics.Box(1, 1), 20000);
        this.newBody.position = physics.Vec2.of(mx, my);
        this.newBody.rotation = 0;
        this.newBodyStart = physics.Vec2.of(mx, my);
        this.newBodyView = createView(this.newBody);
        break;
    }
  };

  /**
   * Handles when the mouse is moved.
   * @param e Mouse event data
   */
  Builder.prototype.onMouseMove = function(e) {
    const mx = e.pageX - this.canvas.offset().left;
    const my = e.pageY - this.canvas.offset().top;
    switch (this.mode) {
      case Builder.Mode.SELECT:
        if (!this.selection) {
          return;
        }
        this.selection.position = physics.Vec2.of(
            mx + this.selection.dx,
            my + this.selection.dy)
        break;

      case Builder.Mode.CREATE_BOX:
        if (!this.newBody) {
          return;
        }
        // Update the size/position of the box
        const dx = mx - this.newBodyStart.x;
        const dy = my - this.newBodyStart.y;
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
          const toPointer = physics.Vec2.sub(
              this.selection.position,
              this.selection.body.position);
          if (toPointer.x != 0 || toPointer.y != 0) {
            const directionToPointer = physics.Vec2.normalize(toPointer);
            const distanceToPointer = physics.Vec2.len(toPointer);
            const force = physics.Vec2.scale(
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
          const body = new physics.Body(this.newBody.shape, 20000);
          body.position = this.newBody.position;
          body.rotation = this.newBody.rotation;
          this.world.addBody(body);

          const view = createView(body);
          view.colour = this.newBodyView.colour;
          this.views.push(view);
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
    const world = new physics.World();

    const ground = new physics.Body(new physics.Box(Builder.WIDTH + 100, 50), Number.MAX_VALUE);
    ground.position = physics.Vec2.of(Builder.WIDTH / 2, Builder.HEIGHT - 25);
    ground.rotation = 0;
    world.addBody(ground);

    const PYRAMID_HEIGHT = 5;
    const PYRAMID_SPACING = 35;

    const yBase = ground.position.y - ground.shape.size.y - 5;
    for (let row = 0; row < PYRAMID_HEIGHT; row++) {
      const cols = PYRAMID_HEIGHT - row;
      const xBase = (Builder.WIDTH / 2) - (cols / 2) * PYRAMID_SPACING;
      for (let col = 0; col < cols; col++) {
        const box = new physics.Body(new physics.Box(30, 30), 20000);
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
    const bodies = [];
    for (let i = 0; i < this.world.bodies.length; i++) {
      const body = this.world.bodies[i];
      bodies.push({
        x: body.position.x,
        y: body.position.y,
        r: body.rotation,
        m: body.mass,
        w: body.shape.size.x,
        h: body.shape.size.y
      });
    }

    return JSON.stringify({
      version: 1,
      bodies: bodies
    });
  };

  /**
   * @param worldData A world in JSON format, from getSerializedWorld
   * @return {World} A world parsed from its JSON representation
   */
  Builder.prototype.getDeserializedWorld = function(worldData) {
    const world = new physics.World();

    for (let i = 0; i < worldData.bodies.length; i++) {
      const bodyData = worldData.bodies[i];
      const box = new physics.Body(new physics.Box(bodyData.w, bodyData.h), bodyData.m);
      box.position = physics.Vec2.of(bodyData.x, bodyData.y);
      box.rotation = bodyData.r;
      world.addBody(box);
    }

    return world;
  };

  /**
   * @return A data url encoding a thumbnail of the current world state.
   */
  Builder.prototype.getWorldThumbnail = function() {
    const canvas = this.canvas[0];

    const scale = 6;
    const scaledWidth = Math.round(canvas.width / scale);
    const scaledHeight = Math.round(canvas.height / scale);

    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = scaledWidth;
    scaledCanvas.height = scaledHeight;

    const scaledCtx = scaledCanvas.getContext('2d');
    scaledCtx.drawImage(
        canvas,
        0, 0,
        canvas.width, canvas.height,
        0, 0,
        scaledWidth, scaledHeight);

    return scaledCanvas.toDataURL();
  };


  /**
   * @return {Body} The first body in the world colliding with the given body
   */
  Builder.prototype.getCollidingBody = function(body) {
    for (let i = 0; i < this.world.bodies.length; i++) {
      const contacts = physics.collide(this.world.bodies[i], body);
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
    for (let i = 0; i < this.views.length; i++) {
      if (this.views[i].body == body) {
        const highlightedView = this.views[i];
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
    if (body.mass < Number.MAX_VALUE) {
      this.colour = Math.floor(Math.random() * (BoxView.COLOURS.length - 1));
    } else {
      this.colour = BoxView.GREY;
    }
  };

  BoxView.COLOURS = [
    {fill: '#6E8DC4', border: '#51688E'},
    {fill: '#DA4936', border: '#963025'},
    {fill: '#41B148', border: '#2E7A31'},
    {fill: '#F6AA37', border: '#AF7927'},
    // Reserved for immovable and invalid bodies
    {fill: '#FCFCFC', border: '#666666'},
  ];
  BoxView.GREY = BoxView.COLOURS.length - 1;

  BoxView.prototype.draw = function(ctx) {
    const width = this.body.shape.size.x;
    const height = this.body.shape.size.y;

    ctx.save();

    const colours = BoxView.COLOURS[this.invalid ? BoxView.GREY : this.colour];
    ctx.lineWidth = this.selected ? 3 : 1;
    ctx.strokeStyle = this.selected ? '#111' : colours.border;
    ctx.fillStyle = colours.fill;

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
    const shape = Object.getPrototypeOf(body.shape).constructor;
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
    const canvas = document.createElement('canvas');
    const supportsCanvas = !!(canvas.getContext);
    const supportsCors = !!('withCredentials' in new XMLHttpRequest());
    return supportsCanvas
        && (supportsCors || !window.google); // Only necessary for G+
  }

  /**
   * Displays a dismissable error bar above the game.
   * @param text {string} The error text to show the user
   */
  function showError_(text) {
    $('#error-text').text(text);
    $('#error-bar').fadeIn();
      $('#error-dismiss').click(function() {
        $('#error-bar').fadeOut();
      });
  }

  /**
   * Displays a dismissable information bar above the game.
   * @param text {string} The text to show the user
   */
  function showInfo_(text) {
    $('#info-text').html(text);
    $('#info-bar').fadeIn();
      $('#info-dismiss').click(function() {
        $('#info-bar').fadeOut();
      });
  }

  /**
   * @return {string} Id of the world to load, taken from the page
   */
  function getWorldIdToLoad_() {
    const worldHash = window.location.hash;
    if (worldHash) {
      return worldHash.substring(1);
    }
    return null;
  }

  /**
   * Adds a loading animation while waiting for ajax requests.
   */
  function addAjaxAnimations_() {
    $('#loading').hide();
    $('#loading').ajaxStart(function () {
      $(this).fadeIn();
    });
    $('#loading').ajaxStop(function () {
      $(this).fadeOut();
    });
  }

  /**
   * Starts the game loop.
   */
  function start_() {
    if (!isSupported_()) {
      showError_('Builder may not work well in your browser.');
    }

    addAjaxAnimations_();

    const worldId = getWorldIdToLoad_();
    if (worldId) {
      $.ajax({
        url: builder.baseUrl + 'worlds/data/' + worldId,
        success: function(world) {
          new Builder(world).start();
        },
        error: function() {
          showError_('Uh oh, there was a problem loading the world.');
          new Builder().start();
        }
      });
    } else {
      new Builder().start();
    }
  }

  return { start: start_ }
})();
