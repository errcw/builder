/**
 * @fileoverview Tiny physics libary based on Box2D.
 */
var physics = (function() {

  /**
   * A two-dimensional vector.
   * @constructor
   */
  function Vec2(x, y) {
    this.x = x;
    this.y = y;
  };

  Vec2.prototype.add = function(other) {
    this.x += other.x;
    this.y += other.y;
  };

  Vec2.prototype.sub = function(other) {
    this.x -= other.x;
    this.y -= other.y;
  };

  Vec2.prototype.len = function() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  };

  /**
   * A two-dimensional body.
   * @param shape {Shape} The shape of this body
   * @param mass {number} The mass of this body
   * @constructor
   */
  function Body(shape, mass) {
    this.shape = shape
    this.mass = mass;

    this.position = Vec2(0, 0);
    this.lastPosition = Vec2(0, 0);
    this.rotation = 0;
    this.velocity = Vec2(0, 0);
    this.angular_velocity = Vec2(0, 0);
    this.force = Vec2(0, 0);
    this.torque = 0;
    this.surface_friction = 0.2;
  }

  /**
   * A rectangle.
   * @constructor
   */
  function Box(width, height) {
    this.size = Vec2(width, height);
    this.bounds = new BoundingBox(this.size.len(), this.size.len());
  }

  /**
   * @param position {Vec2} The position of the box
   * @param rotation {number} The rotation of the box, in radians
   * @return {Array.<number>} The four corners of this box
   */
  Box.prototype.getPoints = function(position, rotation) {
    //TODO
    var r = Mat2.forRotation(rotation);
    var hx = this.size.x * 0.5;
    var hy = this.size.y * 0.5;
    return [ r.mul(Vec2(-h.x, -h.y)).add(position),
             r.mul(Vec2(h.x, -h.y)).add(position),
             r.mul(Vec2(h.x, h.y)).add(position),
             r.mul(Vec2(-h.x, h.y)).add(position) ];
  };

  /**
   * A circle.
   * @constructor
   */
  function Circle(radius) {
    this.radius = radius;
    this.bounds = new BoundingBox(radius * 2, radius * 2);
  }

  /**
   * An axis-aligned bounding box for a shape.
   * @constructor
   */
  function BoundingBox(width, height) {
    this.width = width;
    this.height = height;
    this.offsetx = 0;
    this.offsety = 0;
  }

  /**
   * @return {boolean} If this bounding box touches another
   */
  BoundingBox.prototype.touches = function(x, y, other, ox, oy) {
    var totalWidth = (this.width + other.width) / 2;
    var totalHeight = (this.height + other.height) / 2;

    var dx = Math.abs((x + this.offsetx) - (ox + other.offsetx));
    var dy = Math.abs((y + this.offsety) - (oy + other.offsety));

    return (totalWidth > dx) && (totalHeight > dy);
  };

})();
