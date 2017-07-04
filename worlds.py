'''Models worlds.'''

import base64
import json
import os
import re
import uuid

import webapp2
from google.appengine.ext import db

class World(db.Model):
  '''A world.'''
  world = db.TextProperty(required=True)
  thumbnail = db.BlobProperty()


class WorldDataHandler(webapp2.RequestHandler):
  '''Controller for reading world data.'''

  def get(self, world_id):
    if not world_id:
      self.error(400)
      return

    world = World.get_by_id(int(world_id))
    if not world:
      self.error(404)
      return

    self.response.headers['Access-Control-Allow-Origin'] = '*'
    self.response.headers['Content-Type'] = 'application/json'
    self.response.out.write(world.world)


class WorldThumbnailHandler(webapp2.RequestHandler):
  '''Controller for reading world thumbnails.'''

  def get(self, world_id):
    if not world_id:
      self.error(400)
      return

    world = World.get_by_id(int(world_id))
    if not world:
      self.error(404)
      return

    self.response.headers['Access-Control-Allow-Origin'] = '*'
    self.response.headers['Content-Type'] = 'image/png'
    self.response.out.write(world.thumbnail)


class WorldUploader(webapp2.RequestHandler):
  '''Controller for uploading new worlds.'''

  data_url_pattern = re.compile('data:image/png;base64,(.*)$')

  def post(self):
    world_data_json = self.request.get('world')
    if not world_data_json:
      self.error(400)
      return

    thumbnail_data_url = self.request.get('thumbnail')
    if not thumbnail_data_url:
      self.error(400)
      return
    thumbnail_base64 = self.data_url_pattern.match(thumbnail_data_url).group(1)
    if not thumbnail_base64 or not len(thumbnail_base64):
      self.error(400)
      return
    thumbnail = base64.b64decode(thumbnail_base64)

    world = World(
        world = world_data_json,
        thumbnail = db.Blob(thumbnail))
    world.put()

    id = str(world.key().id())

    self.response.headers['Access-Control-Allow-Origin'] = '*'
    self.response.headers['Content-Type'] = 'application/json'
    self.response.out.write(json.dumps({
      'id': id,
      'thumbnail_url': 'worlds/thumbnails/' + id
    }))


app = webapp2.WSGIApplication([('/worlds/data/(\d+)', WorldDataHandler),
                               ('/worlds/thumbnails/(\d+)', WorldThumbnailHandler),
                               ('/worlds/', WorldUploader)],
                               debug=True)
