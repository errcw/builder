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

  Vec2.of = function(x, y) {
    return new Vec2(x, y);
  };

  Vec2.add = function(a, b) {
    return Vec2.of(a.x + b.x, a.y + b.y);
  };

  Vec2.sub = function(a, b) {
    return Vec2.of(a.x - b.x, a.y - b.y);
  };

  Vec2.scale = function(v, s) {
    return Vec2.of(v.x * s, v.y * s);
  };

  Vec2.dot = function(a, b) {
    return a.x * b.x + a.y * b.y;
  };

  Vec2.cross = function(v, s) {
    return Vec2.of(v.y * s, v.x * -s);
  };

  Vec2.crossVec = function(a, b) {
    return a.x * b.y - a.y * b.x;
  };

  Vec2.normalize = function(v) {
    var scale = 1 / Vec2.len(v);
    return Vec2.of(scale * v.x, scale * v.y);
  };

  Vec2.abs = function(v) {
    return Vec2.of(Math.abs(v.x), Math.abs(v.y));
  };

  Vec2.neg = function(v) {
    return Vec2.of(-v.x, -v.y);
  };

  Vec2.len = function(v) {
    return Math.sqrt(Vec2.len2(v));
  };

  Vec2.len2 = function(v) {
    return v.x * v.x + v.y * v.y;
  };


  /**
   * A two-by-two matrix.
   * @constructor
   */
  function Mat22(e11, e12, e21, e22) {
    this.e11 = e11;
    this.e12 = e12;
    this.e21 = e21;
    this.e22 = e22;
  }

  Mat22.of = function(e11, e12, e21, e22) {
    return new Mat22(e11, e12, e21, e22);
  };

  Mat22.mulVec = function(m, v) {
    return Vec2.of(
        m.e11 * v.x + m.e12 * v.y,
        m.e21 * v.x + m.e22 * v.y);
  };

  Mat22.mulMat = function(m1, m2) {
    return Mat22.of(
        m1.e11 * m2.e11 + m1.e12 * m2.e21,
        m1.e11 * m2.e21 + m1.e12 * m2.e22,
        m1.e21 * m2.e11 + m1.e22 * m2.e21,
        m1.e21 * m2.e12 + m1.e22 * m2.e22);
  }

  Mat22.transpose = function(mat22) {
    return Mat22.of(mat22.e11, mat22.e21, mat22.e12, mat22.e22);
  };

  Mat22.abs = function(m) {
    return Mat22.of(Math.abs(m.e11), Math.abs(m.e12), Math.abs(m.e21), Math.abs(m.e22));
  };

  /**
   * @return {Mat22} A matrix representing the given angle in radians
   */
  Mat22.forRotation = function(angle) {
    var c = Math.cos(angle);
    var s = Math.sin(angle);
    return Mat22.of(c, -s, s, c);
  };


  /**
   * A rectangle.
   * @param width {number} The width of this box
   * @param height {number} The height of this box
   * @constructor
   */
  function Box(width, height) {
    this.setSize(width, height);
  }

  /**
   * @param width {number} The new width of this box
   * @param height {number} The new height of this box
   */
  Box.prototype.setSize = function(width, height) {
    this.size = Vec2.of(width, height);
    this.bounds = new BoundingBox(Vec2.len(this.size), Vec2.len(this.size));
  };

  /**
   * @param position {Vec2} The position of the box
   * @param rotation {number} The rotation of the box, in radians
   * @return {Array.<Vec2>} The four corners of this box
   */
  Box.prototype.getPoints = function(position, rotation) {
    var r = Mat22.forRotation(rotation);
    var hx = this.size.x * 0.5;
    var hy = this.size.y * 0.5;
    return [ Vec2.add(Mat22.mulVec(r, Vec2.of(-hx, -hy)), position),
             Vec2.add(Mat22.mulVec(r, Vec2.of(hx, -hy)), position),
             Vec2.add(Mat22.mulVec(r, Vec2.of(hx, hy)), position),
             Vec2.add(Mat22.mulVec(r, Vec2.of(-hx, hy)), position) ];
  };


  /**
   * A circle.
   * @param radius {number} The radius of this circle
   * @constructor
   */
  function Circle(radius) {
    this.radius = radius;
    this.bounds = new BoundingBox(radius * 2, radius * 2);
    this.type = Circle.TYPE;
  }


  /**
   * A line segment.
   * @param start {Vec2} The start of this line segment
   * @param end {Vec2} The end of this line segment
   * @constructor
   */
  function Line(start, end) {
    this.start = start;
    this.end = end;
    this.vec = Vec2.sub(this.end, this.start);
  }

  Line.prototype.len2 = function() {
    return Vec2.len2(this.vec);
  };

  /**
   * @return {number} The minimum distance squared between this line and the given point
   */
  Line.prototype.distanceToPoint2 = function(point) {
    var closest = this.getClosestPoint(point);
    var toClosest = Vec2.sub(closest, point);
    return Vec2.len2(toClosest);
  };

  /**
   * @return {Vec2} The closest point on this line to the given point
   */
  Line.prototype.getClosestPoint = function(point) {
    var toPoint = Vec2.sub(point, this.start);

    var dp = Vec2.dot(toPoint, this.vec);
    var t = dp / this.len2();
    if (t < 0) {
      t = 0;
    } else if (t > 1) {
      t = 1;
    }

    return Vec2.add(this.start, Vec2.scale(this.vec, t));
  };


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
   * Describes a point of contact between two bodies.
   * @constructor
   */
  function Contact(separation, position, normal, opt_id) {
    this.separation = separation;
    this.position = position;
    this.normal = normal;
    this.id = opt_id || Contact.NO_ID;

    // Accumulated impulses
    this.Pn = 0;
    this.Pt = 0;
    this.Pnb = 0;
  }

  Contact.NO_ID = { equals: function(other) { return true; } };


  /**
   * Calculates the collision contacts between two circles.
   */
  function collideCircleCircle(circleA, circleB) {
    var offset = Vec2.sub(circleB.position, circleA.position);
    var totalRadius = circleA.shape.radius + circleB.shape.radius;

    // Check for a collision
    if (totalRadius * totalRadius < Vec2.len2(offset)) {
      return [];
    };

    // Find the collision location
    var normal = Vec2.normalize(offset);
    var separation = totalRadius - Vec2.len(offset);
    var point = Vec2.scale(normal, circleA.shape.radius);

    return [ new Contact(separation, point, normal) ];
  }

  /**
   * Calculates the collision contacts between a box and a circle.
   */
  function collideBoxCircle(boxBody, circleBody) {
    var r2 = circleBody.shape.radius * circleBody.shape.radius;

    // Represent the box as line segments
    var pts = boxBody.shape.getPoints(boxBody.position, boxBody.rotation);
    var lines = [
      new Line(pts[0], pts[1]),
      new Line(pts[1], pts[2]),
      new Line(pts[2], pts[3]),
      new Line(pts[3], pts[0]) ];

    // Find the side of the box closest to the circle also intersecting it
    var closest = null;
    var closest_distance2 = Number.MAX_VALUE;
    for (var i = 0; i < lines.length; i++) {
      var d2 = lines[i].distanceToPoint2(circleBody.position);
      if (d2 < r2 && d2 < closest_distance2) {
        closest = lines[i];
        closest_distance2 = d2;
      }
    }

    // Find the collision location
    if (closest != null) {
      var separation = Math.sqrt(closest_distance2) - circleBody.shape.radius;
      var point = closest.getClosestPoint(circleBody.position);
      var normal = Vec2.normalize(Vec2.sub(circleBody.position, point));
      return [ new Contact(separation, point, normal) ]
    } else {
      return [];
    }
  }

  /**
   * Calculates the collision contacts between two boxes.
   */
  function collideBoxBox(boxA, boxB) {
    // Separating axes
    var SeparatingAxis = {
        FACE_A_X: 1,
        FACE_A_Y: 2,
        FACE_B_X: 3,
        FACE_B_Y: 4
    };

    // Collision tolerances
    var REL_TOL = 0.95;
    var ABS_TOL = 0.01;

    // Identifies box-box contact by the intersecting edges
    function EdgePair(inEdge1, inEdge2, outEdge1, outEdge2) {
      this.inEdge1 = inEdge1;
      this.inEdge2 = inEdge2;
      this.outEdge1 = outEdge1;
      this.outEdge2 = outEdge2;
    }

    EdgePair.EDGE1 = 1;
    EdgePair.EDGE2 = 2;
    EdgePair.EDGE3 = 3;
    EdgePair.EDGE4 = 4;

    EdgePair.prototype.swap = function() {
      var tIn = this.inEdge1;
      this.inEdge1 = this.inEdge2;
      this.inEdge2 = tIn;

      var tOut = this.outEdge1;
      this.outEdge1 = this.outEdge2;
      this.outEdge2 = tOut;
    };

    EdgePair.prototype.equals = function(other) {
      return this.inEdge1 == other.inEdge1
          && this.inEdge2 == other.inEdge2
          && this.outEdge1 == other.outEdge1
          && this.outEdge2 == other.outEdge2;
    };

    // Contains a clip vertex (v) and edge pair (ep);
    function ClipVertex() {
      this.v = null;
      this.ep = null;
    }

    function computeIncidentEdge(h, pos, rot, normal) {
      // Normal from reference box; convert to incident box's frame, flip sign
      var n = Vec2.neg(Mat22.mulVec(Mat22.transpose(rot), normal));
      var c0 = new ClipVertex();
      var c1 = new ClipVertex();

      if (Math.abs(n.x) > Math.abs(n.y)) {
        if (n.x > 0) {
          c0.v = Vec2.of(h.x, -h.y);
          c0.ep = new EdgePair(0, EdgePair.EDGE3, 0, EdgePair.EDGE4);
          c1.v = Vec2.of(h.x, h.y);
          c1.ep = new EdgePair(0, EdgePair.EDGE4, 0, EdgePair.EDGE1);
        } else {
          c0.v = Vec2.of(-h.x, h.y);
          c0.ep = new EdgePair(0, EdgePair.EDGE1, 0, EdgePair.EDGE2);
          c1.v = Vec2.of(-h.x, -h.y);
          c1.ep = new EdgePair(0, EdgePair.EDGE2, 0, EdgePair.EDGE3);
        }
      } else {
        if (n.y > 0) {
          c0.v = Vec2.of(h.x, h.y);
          c0.ep = new EdgePair(0, EdgePair.EDGE4, 0, EdgePair.EDGE1);
          c1.v = Vec2.of(-h.x, h.y);
          c1.ep = new EdgePair(0, EdgePair.EDGE1, 0, EdgePair.EDGE2);
        } else {
          c0.v = Vec2.of(-h.x, -h.y);
          c0.ep = new EdgePair(0, EdgePair.EDGE2, 0, EdgePair.EDGE3);
          c1.v = Vec2.of(h.x, -h.y);
          c1.ep = new EdgePair(0, EdgePair.EDGE3, 0, EdgePair.EDGE4);
        }
      }

      c0.v = Vec2.add(pos, Mat22.mulVec(rot, c0.v));
      c1.v = Vec2.add(pos, Mat22.mulVec(rot, c1.v));

      return [c0, c1];
    }

    function clipSegmentToLine(v, normal, offset, clipEdge) {
      var vout = [];

      // Calculate the distance of the end points to the line
      var distance0 = Vec2.dot(normal, v[0].v) - offset;
      var distance1 = Vec2.dot(normal, v[1].v) - offset;

      // If the points are behind the plane
      if (distance0 <= 0) {
        vout.push(v[0]);
      }
      if (distance1 <= 0) {
        vout.push(v[1]);
      }

      // If the points are on different sides of the plane
      if (distance0 * distance1 < 0) {
        // Find the intersection point of the edge and the plane
        var interp = distance0 / (distance0 - distance1);
        var vp = new ClipVertex();
        vp.v = Vec2.add(v[0].v, Vec2.scale(Vec2.sub(v[1].v, v[0].v), interp));
        if (distance0 > 0) {
          vp.ep = v[0].ep;
          vp.ep.inEdge1 = clipEdge;
          vp.ep.inEdge2 = 0;
        } else {
          vp.ep = v[1].ep;
          vp.ep.outEdge1 = clipEdge;
          vp.ep.outEdge2 = 0;
        }
        vout.push(vp);
      }

      return vout;
    }

    var ha = Vec2.scale(boxA.shape.size, 0.5);
    var hb = Vec2.scale(boxB.shape.size, 0.5);

    var posa = boxA.position;
    var posb = boxB.position;

    var rota = Mat22.forRotation(boxA.rotation);
    var rotb = Mat22.forRotation(boxB.rotation);

    var rotat = Mat22.transpose(rota); // equivalent to inverse
    var rotbt = Mat22.transpose(rotb);

    var dp = Vec2.sub(posb, posa);
    var da = Mat22.mulVec(rotat, dp); // dp with A axis aligned
    var db = Mat22.mulVec(rotbt, dp);

    var c = Mat22.mulMat(rotat, rotb); // transform B size vector with A axis aligned
    var absc = Mat22.abs(c);
    var absct = Mat22.transpose(absc);

    // Box A faces: abs(da) - ha - absc * hb
    // abs(da) - ha: vector from edge of A to B
    // absc * hb: size of B projected on A's axes (A axis aligned)
    // distance > size => separating axis
    var facea = Vec2.sub(Vec2.sub(Vec2.abs(da), ha), Mat22.mulVec(absc, hb));
    if (facea.x > 0 || facea.y > 0) {
      return []
    }

    // Box B faces: abs(db) - absct * ha - hb
    var faceb = Vec2.sub(Vec2.sub(Vec2.abs(db), Mat22.mulVec(absct, ha)), hb);
    if (faceb.x > 0 || faceb.y > 0) {
      return []
    }

    // Find best axis (minimum penetration)
    var axis = SeparatingAxis.FACE_A_X;
    var separation = facea.x;
    var normal = Vec2.of(rota.e11, rota.e21);
    if (da.x <= 0) {
      normal = Vec2.neg(normal);
    }

    if (facea.y > separation * REL_TOL + ha.y * ABS_TOL) {
      axis = SeparatingAxis.FACE_A_Y;
      separation = facea.y;
      normal = Vec2.of(rota.e12, rota.e22);
      if (da.y <= 0) {
        normal = Vec2.neg(normal);
      }
    }

    if (faceb.x > separation * REL_TOL + hb.x * ABS_TOL) {
      axis = SeparatingAxis.FACE_B_X;
      separation = faceb.x;
      normal = Vec2.of(rotb.e11, rotb.e21);
      if (db.x <= 0) {
        normal = Vec2.neg(normal);
      }
    }

    if (faceb.y > separation * REL_TOL + hb.y * ABS_TOL) {
      axis = SeparatingAxis.FACE_B_Y;
      separation = faceb.y;
      normal = Vec2.of(rotb.e12, rotb.e22);
      if (db.y <= 0) {
        normal = Vec2.neg(normal);
      }
    }

    // Compute clipping lines
    var frontNormal, front, sideNormal, side, negSide, posSide, negEdge, posEdge, incident;
    switch (axis) {
      case SeparatingAxis.FACE_A_X:
        frontNormal = normal;
        front = Vec2.dot(posa, frontNormal) + ha.x;
        sideNormal = Vec2.of(rota.e12, rota.e22);
        side = Vec2.dot(posa, sideNormal);
        negSide = -side + ha.y;
        posSide = side + ha.y;
        negEdge = EdgePair.EDGE3;
        posEdge = EdgePair.EDGE1;
        incident = computeIncidentEdge(hb, posb, rotb, frontNormal);
        break;

      case SeparatingAxis.FACE_A_Y:
        frontNormal = normal;
        front = Vec2.dot(posa, frontNormal) + ha.y;
        sideNormal = Vec2.of(rota.e11, rota.e21);
        side = Vec2.dot(posa, sideNormal);
        negSide = -side + ha.x;
        posSide = side + ha.x;
        negEdge = EdgePair.EDGE2;
        posEdge = EdgePair.EDGE4;
        incident = computeIncidentEdge(hb, posb, rotb, frontNormal);
        break;

      case SeparatingAxis.FACE_B_X:
        frontNormal = Vec2.neg(normal);
        front = Vec2.dot(posb, frontNormal) + hb.x;
        sideNormal = Vec2.of(rotb.e12, rotb.e22);
        side = Vec2.dot(posb, sideNormal);
        negSide = -side + hb.y;
        posSide = side + hb.y;
        negEdge = EdgePair.EDGE3;
        posEdge = EdgePair.EDGE1;
        incident = computeIncidentEdge(ha, posa, rota, frontNormal);
        break;

      case SeparatingAxis.FACE_B_Y:
        frontNormal = Vec2.neg(normal);
        front = Vec2.dot(posb, frontNormal) + hb.y;
        sideNormal = Vec2.of(rotb.e11, rotb.e21);
        side = Vec2.dot(posb, sideNormal);
        negSide = -side + hb.x;
        posSide = side + hb.x;
        negEdge = EdgePair.EDGE2;
        posEdge = EdgePair.EDGE4;
        incident = computeIncidentEdge(ha, posa, rota, frontNormal);
        break;
    }

    // Clip to box side 1
    var c1 = clipSegmentToLine(incident, Vec2.neg(sideNormal), negSide, negEdge);
    if (c1.length < 2) {
      return [];
    }

    // Clip to negative box side 1; c2 contains clipping points
    var c2 = clipSegmentToLine(c1, sideNormal, posSide, posEdge);
    if (c2.length < 2) {
      return [];
    }

    // Calculate the contacts
    var contacts = [];
    for (var i = 0; i < c2.length; i++) {
      var c = c2[i];
      var separation = Vec2.dot(frontNormal, c.v) - front;
      if (separation <= 0) {
        var position = Vec2.sub(c.v, Vec2.scale(frontNormal, separation));
        var contact = new Contact(separation, position, normal, c.ep);
        if (axis === SeparatingAxis.FACE_B_X || axis === SeparatingAxis.FACE_B_Y) {
          contact.id.swap();
        }
        contacts.push(contact);
      }
    }

    return contacts;
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


  /**
   * A two-dimensional body.
   * @param shape {Shape} The shape of this body (e.g., Box)
   * @param mass {number} The mass of this body
   * @constructor
   */
  function Body(shape, mass) {
    this.shape = shape

    this.position = Vec2.of(0, 0);
    this.lastPosition = Vec2.of(0, 0);
    this.rotation = 0;
    this.velocity = Vec2.of(0, 0);
    this.angularVelocity = 0;
    this.force = Vec2.of(0, 0);
    this.torque = 0;
    this.friction = 0.2;

    this.mass = mass;
    if (this.mass < Number.MAX_VALUE) {
      this.inverseMass = 1 / this.mass;
      this.density = this.mass;
      this.inverseDensity = 1/ this.density;
    } else {
      this.inverseMass = 0;
      this.density = Number.MAX_VALUE;
      this.inverseDensity = 0;
    }
  }


  /**
   * A link between two bodies.
   * @constructor
   */
  function Joint(body1, body2, anchor) {
    this.body1 = body1;
    this.body2 = body2;
    this.anchor = anchor;
  }

  Joint.prototype.preStep = function(invDt) {
  };

  Joint.prototype.applyImpulse = function() {
  };


  /**
   * Manages the collision between two bodies.
   * @constructor
   */
  function Arbiter(body1, body2, contacts) {
    this.body1 = body1;
    this.body2 = body2;
    this.contacts = contacts;

    this.friction = Math.sqrt(this.body1.friction * this.body2.friction);
  }

  /**
   * The amonut of penetration between bodies before separating them.
   * @const
   */
  Arbiter.ALLOWED_PENETRATION = 0.01;

  /**
   * The bias factor. (TODO)
   * @const
   */
  Arbiter.BIAS_FACTOR = 0.2;

  Arbiter.prototype.preStep = function(invDt) {
    var body1 = this.body1;
    var body2 = this.body2;
    for (var i = 0; i < this.contacts.length; i++) {
      var contact = this.contacts[i];

      var r1 = Vec2.sub(contact.position, body1.position);
      var r2 = Vec2.sub(contact.position, body2.position);

      // Compute normal mass, tangent mass, bias
      var rn1 = Vec2.dot(r1, contact.normal);
      var rn2 = Vec2.dot(r2, contact.normal);
      var kNormal = body1.inverseMass * body2.inverseMass;
      kNormal +=
        body1.inverseDensity * (Vec2.dot(r1, r1) - rn1 * rn1) +
        body2.inverseDensity * (Vec2.dot(r2, r2) - rn2 * rn2);
      contact.massNormal = 1 / kNormal;

      var tangent = Vec2.cross(contact.normal, 1.0);
      var rt1 = Vec2.dot(r1, tangent);
      var rt2 = Vec2.dot(r2, tangent);
      var kTangent = body1.inverseMass * body2.inverseMass;
      kTangent +=
        body1.inverseDensity * (Vec2.dot(r1, r1) - rt1 * rt1) +
        body2.inverseDensity * (Vec2.dot(r2, r2) - rt2 * rt2);
      contact.massTangent = 1 / kTangent;

      var adjustedSeparation = Math.min(0, contact.separation + Arbiter.ALLOWED_PENETRATION);
      contact.bias = -Arbiter.BIAS_FACTOR * invDt * adjustedSeparation;

      // Apply normal+friction impulse
      var p = Vec2.add(Vec2.scale(contact.normal, contact.Pn), Vec2.scale(tangent, contact.Pt));

      body1.velocity = Vec2.sub(body1.velocity, Vec2.scale(p, body1.inverseMass));
      body1.angularVelocity -= Vec2.crossVec(r1, p) * body1.inverseDensity;

      body2.velocity = Vec2.add(body2.velocity, Vec2.scale(p, body2.inverseMass));
      body2.angularVelocity += Vec2.crossVec(r2, p) * body2.inverseDensity;
    }
  };

  Arbiter.prototype.applyImpulse = function() {
    var body1 = this.body1;
    var body2 = this.body2;
    for (var i = 0; i < this.contacts.length; i++) {
      var contact = this.contacts[i];

      contact.r1 = Vec2.sub(contact.position, body1.position);
      contact.r2 = Vec2.sub(contact.position, body2.position);

      // Compute relative velocity at contact
      var dv = Vec2.sub(
        Vec2.add(body2.velocity, Vec2.cross(contact.r2, body2.angularVelocity)),
        Vec2.sub(body1.velocity, Vec2.cross(contact.r1, body1.angularVelocity)));

      // Compute normal impulse
      var vn = Vec2.dot(dv, contact.normal);

      var dPn = contact.massNormal * (-vn + contact.bias);

      // Clamp the accumulated normal impulse
      var Pn0 = contact.Pn;
      contact.Pn = Math.max(Pn0 + dPn, 0);
      dPn = contact.Pn - Pn0;

      // Apply contact normal impulse
      var Pn = Vec2.scale(contact.normal, dPn);

      body1.velocity = Vec2.sub(body1.velocity, Vec2.scale(Pn, body1.inverseMass));
      body1.angularVelocity -= body1.inverseDensity * Vec2.crossVec(contact.r1, Pn);

      body2.velocity = Vec2.add(body2.velocity, Vec2.scale(Pn, body2.inverseMass));
      body2.angularVelocity += body2.inverseDensity * Vec2.crossVec(contact.r2, Pn);


      // Recompute relative velocity at contact
      dv = Vec2.sub(
        Vec2.add(body2.velocity, Vec2.cross(contact.r2, body2.angularVelocity)),
        Vec2.sub(body1.velocity, Vec2.cross(contact.r1, body1.angularVelocity)));

      var tangent = Vec2.cross(contact.normal, 1.0);
      var vt = Vec2.dot(dv, tangent);
      var dPt = contact.massTangent * -vt;

      // Compute friction impulse
      var maxPt = this.friction * contact.Pn;

      // Clamp the accumulated friction impulse
      var Pt0 = contact.Pt;
      contact.Pt = Math.max(-maxPt, Math.min(maxPt, Pt0 + dPt));
      dPt = contact.Pt - Pt0;

      // Apply contact tangent impulse
      var Pt = Vec2.scale(tangent, dPt);

      body1.velocity = Vec2.sub(body1.velocity, Vec2.scale(Pt, body1.inverseMass));
      body1.angularVelocity -= body1.inverseDensity * Vec2.crossVec(contact.r1, Pt);

      body2.velocity = Vec2.add(body2.velocity, Vec2.scale(Pt, body2.inverseMass));
      body2.angularVelocity += body2.inverseDensity * Vec2.crossVec(contact.r2, Pt);
    }
  };

  Arbiter.prototype.setContacts = function(newContacts) {
    for (var i = 0; i < newContacts.length; i++) {
      var newContact = newContacts[i];
      var oldContact = null;

      // Find any existing contact matching the new contact
      for (var j = 0; j < this.contacts.length; j++) {
        var contact = this.contacts[j];
        if (contact.id.equals(newContact.id)) {
          oldContact = contact;
          break;
        }
      }

      // Found an existing contact, update it with the existing information
      if (oldContact != null) {
        newContact.Pn = oldContact.Pn;
        newContact.Pt = oldContact.Pt;
        newContact.Pnb = oldContact.Pnb;
      }
    }

    // Switch to using the new contacts
    this.contacts = newContacts;
  };

  Arbiter.prototype.hasBody = function(body) {
    return this.body1 === body || this.body2 === body;
  };


  /**
   * Physical interaction for a set of bodies.
   * @constructor
   */
  function World() {
    this.bodies = [];
    this.arbiters = [];
    this.joints = [];
    this.gravity = Vec2.of(0, 10);
  }

  /**
   * Number of impluse iterations to apply each update step.
   * @const
   */
  World.ITERATIONS = 5;

  /**
   * Updates this world for the given time step.
   * @param dt {number} The time since the last update, in seconds
   */
  World.prototype.update = function(dt) {
    // Broad phase collision detection
    this.calculateCollisions();

    // Integrate forces
    for (var i = 0; i < this.bodies.length; i++) {
      var body = this.bodies[i];
      if (body.inverseMass == 0) {
        continue;
      }

      var dv = Vec2.scale(Vec2.add(this.gravity, Vec2.scale(body.force, body.inverseDensity)), dt);
      body.velocity = Vec2.add(body.velocity, dv);

      body.angularVelocity += body.torque * body.inverseDensity * dt;
    }

    // Pre-steps
    var invDt = 1 / dt;
    for (var i = 0; i < this.arbiters.length; i++) {
      this.arbiters[i].preStep(invDt);
    }
    for (var i = 0; i < this.joints.length; i++) {
      this.joints[i].preStep(invDt);
    }

    // Iterations
    for (var i = 0; i < World.ITERATIONS; i++) {
      for (var j = 0; j < this.arbiters.length; j++) {
        this.arbiters[j].applyImpulse();
      }
      for (var j = 0; j < this.joints.length; j++) {
        this.joints[j].applyImpulse();
      }
    }

    // Integrate velocities
    for (var i = 0; i < this.bodies.length; i++) {
      var body = this.bodies[i];

      body.position = Vec2.add(body.position, Vec2.scale(body.velocity, dt));
      body.rotation += body.angularVelocity * dt;

      body.force = Vec2.of(0, 0);
      body.torque = 0;
    }
  };

  World.prototype.addBody = function(body) {
    this.bodies.push(body);
  };

  World.prototype.removeBody = function(body) {
    var bodyIdx = this.bodies.indexOf(body);
    this.bodies.splice(bodyIdx, 1);

    for (var i = 0; i < this.arbiters.length; i++) {
      if (this.arbiters[i].hasBody(body)) {
        this.arbiters.splice(i, 1);
        //TODO modify the index here?
      }
    }
  };

  World.prototype.addJoint = function(joint) {
    this.joints.push(joint);
  };

  World.prototype.removeJoint = function(joint) {
    var jointIdx = this.joints.indexOf(joint);
    this.joints.splice(jointIdx, 1);
  };

  /**
   * Finds colliding bodies and their contact points. Creates or updates an
   * Arbiter for each collision. TODO: Uses O(n^2) collision detection.
   */
  World.prototype.calculateCollisions = function() {
    var world = this;

    //TODO a real map would be nice
    function getArbiterFor(body1, body2) {
      for (var i = 0; i < world.arbiters.length; i++) {
        var arbiter = world.arbiters[i];
        if (arbiter.hasBody(body1) && arbiter.hasBody(body2)) {
          return arbiter;
        }
      }
      return null;
    }

    function removeArbiterFor(body1, body2) {
      var idx = -1;
      for (var i = 0; i < world.arbiters.length; i++) {
        var arbiter = world.arbiters[i];
        if (arbiter.hasBody(body1) && arbiter.hasBody(body2)) {
          idx = i;
          break;
        }
      }
      if (idx >= 0) {
        world.arbiters.splice(idx, 1);
      }
    }

    for (var i = 0; i < this.bodies.length; i++) {
      var bi = this.bodies[i];
      for (var j = i + 1; j < this.bodies.length; j++) {
        var bj = this.bodies[j];

        if (bi.inverseMass == 0 && bj.inverseMass == 0) {
          continue;
        }

        var contacts = collide(bi, bj);
        if (contacts.length > 0) {
          var arbiter = getArbiterFor(bi, bj);
          if (arbiter != null) {
            arbiter.setContacts(contacts);
          } else {
            this.arbiters.push(new Arbiter(bi, bj, contacts));
          }
        } else {
          removeArbiterFor(bi, bj);
        }
      }
    }
  };

  return {
    Vec2: Vec2,
    Mat22: Mat22,
    Box: Box,
    Circle: Circle,
    Body: Body,
    collide: collide,
    World: World,
  };
})();
