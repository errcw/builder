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
  }

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
   * A two-by-two matrix.
   * @constructor
   */
  function Mat2(e11, e12, e21, e22) {
    this.e11 = e11;
    this.e12 = e12;
    this.e21 = e21;
    this.e22 = e22;
  }

  /**
   * @param vec2 {Vec2} The vector to multiply
   * @return {Vec2} The vector result
   */
  Mat2.prototype.mul = function(vec2) {
    return new Vec2(
        this.e11 * vec2.x + this.e12 * vec2.y,
        this.e21 * vec2.x + this.e22 * vec2.y);
  };

  /**
   * @return {Mat2} A copy of this matrix
   */
  Mat2.prototype.clone = function() {
    return new Mat2(this.e11, this.e12, this.e21, this.e22);
  };

  /**
   * @return {Mat2} A matrix representing the given angle in radians
   */
  Mat2.forRotation = function(angle) {
    var c = Math.cos(angle);
    var s = Math.sin(angle);
    return new Mat22(c, -s, s, c);
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
   * @return {Array.<Vec2>} The four corners of this box
   */
  Box.prototype.getPoints = function(position, rotation) {
    var r = Mat2.forRotation(rotation);
    var hx = this.size.x * 0.5;
    var hy = this.size.y * 0.5;
    return [ r.clone().mul(new Vec2(-h.x, -h.y)).add(position),
             r.clone().mul(new Vec2(h.x, -h.y)).add(position),
             r.clone().mul(new Vec2(h.x, h.y)).add(position),
             r.cloen().mul(new Vec2(-h.x, h.y)).add(position) ];
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
