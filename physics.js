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

  Vec2.add = function(a, b) {
    return new Vec2(a.x + b.x, a.y + b.y);
  };

  Vec2.sub = function(a, b) {
    return new Vec2(a.x - b.x, a.y - b.y);
  };

  Vec2.scale = function(v, s) {
    return new Vec2(v.x * s, v.y * s);
  };

  Vec2.len = function(v) {
    return Math.sqrt(Vec2.len2(v));
  };

  Vec2.len2 = function(v) {
    return v.x * v.x + v.y * v.y;
  };

  Vec2.normalized = function(v) {
    var scale = 1 / Vec2.len(v);
    return new Vec2(scale * v.x, scale * v.y);
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
   * A rectangle.
   * @constructor
   */
  function Box(width, height) {
    this.size = Vec2(width, height);
    this.bounds = new BoundingBox(this.size.len(), this.size.len());
  }

  Box.TYPE = 'BOX';

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
    this.type = Circle.TYPE;
  }

  Circle.TYPE = 'Circle';


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
  BoundingBox.prototype.touches = function(pos, other, opos) {
    var totalWidth = (this.width + other.width) / 2;
    var totalHeight = (this.height + other.height) / 2;

    var dx = Math.abs((pos.x + this.offsetx) - (opos.x + other.offsetx));
    var dy = Math.abs((pos.y + this.offsety) - (opos.y + other.offsety));

    return (totalWidth > dx) && (totalHeight > dy);
  };


  /**
   * A two-dimensional body.
   * @param shape {Shape} The shape of this body (e.g., Box)
   * @param mass {number} The mass of this body
   * @constructor
   */
  function Body(shape, mass) {
    this.shape = shape
    this.mass = mass;

    this.position = new Vec2(0, 0);
    this.lastPosition = new Vec2(0, 0);
    this.rotation = 0;
    this.velocity = new Vec2(0, 0);
    this.angular_velocity = new Vec2(0, 0);
    this.force = new Vec2(0, 0);
    this.torque = 0;
    this.surface_friction = 0.2;
  }


  /**
   * Describes a point of contact between two bodies.
   * @constructor
   */
  function Contact(separation, position, normal) {
    this.separation = separation;
    this.position = position;
    this.normal = normal;
  }


  /**
   * Calculates the collision contacts between two circles.
   */
  function collideCircleCircle(a, b) {
    var offset = Vec2.sub(b.position, a.position);
    var totalRadius = a.shape.radius + b.shape.radius;

    // Check for a collision
    if (totalRadius * totalRadius < Vec2.len2(offset)) {
      return [];
    };

    // Find the collision location
    var normal = Vec2.normalized(offset);
    var separation = totalRadius - Vec2.len(offset);
    var point = Vec2.scale(normal, a.shape.radius);

    return [ new Contact(separation, point, normal) ];
  }

  /**
   * Calculates the collision contacts between two boxes.
   */
  function collideBoxBox(a, b) {
    return []
  }

  /**
   * Calculates the collision contacts between a box and a circle.
   */
  function collideBoxCircle(a, b) {
    return []
  }

  /**
   * Swaps the arguments of a collision function.
   */
  function reverseCollision(collideFn) {
    return function(a, b) {
      var contacts = collideFn(b, a);
      for (var i = 0; i < contacts.length; i++) {
        contacts[i].normal = Vec2.scale(contacts[i].normal, -1);
      }
      return contacts;
    }
  }

  /**
   * @return {function} A collision function to use for the two bodies
   */
  function getCollisionFunction(a, b) {
    var aShape = Object.getPrototypeOf(a).constructor;
    var bShape = Object.getPrototypeOf(b).constructor;
    if (aShape === Box) {
      if (bShape === Box) {
        return collideBoxBox;
      } else if (bShape === Circle) {
        return collideBoxCircle;
      }
    } else if (aShape === Circle) {
      if (bShape === Circle) {
        return collideCircleCircle;
      } else if (bShape === Box) {
        return reverseCollision(collideBoxCircle);
      }
    }
    return null;
  }

  /**
   * Checks for collision between two bodies.
   * @param a {Body} the first body
   * @param b {Body} the second body
   * @return {Array.<Contact>} the list of contact points between the two bodies
   */
  function collide(a, b) {
    // Bail early if the bounding boxes do not intersect
    if (!a.shape.bounds.touches(a.position, b.shape.bounds, b.position)) {
      return [];
    }

    // Otherwise look up an appropriate collision function
    var collideFn = getCollisionFunction(a.shape, b.shape);
    return collideFn(a, b);
  }


  return {
    Box: Box,
    Circle: Circle,
    Body: Body,
    collide: collide
  };
})();
