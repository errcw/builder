'''Models worlds.'''

import base64
import os
import re
import simplejson as json
import uuid

from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app

class World(db.Model):
  '''A world.'''
  id = db.StringProperty(required=True)
  world = db.StringProperty(required=True)
  thumbnail = db.BlobProperty()

  @classmethod
  def key_for(cls, id):
    return db.Key.from_path(cls.__name__, id)


class WorldDataHandler(webapp.RequestHandler):
  '''Controller for reading world data.'''

  def get(self, world_id):
    if not world_id:
      self.error(400)
      return

    world = db.get(World.key_for(world_id))
    if not world:
      self.error(404)
      return

    self.response.headers['Access-Control-Allow-Origin'] = '*'
    self.response.headers['Content-Type'] = 'application/json'
    self.response.out.write(world.world)


class WorldThumbnailHandler(webapp.RequestHandler):
  '''Controller for reading world thumbnails.'''

  def get(self, world_id):
    if not world_id:
      self.error(400)
      return

    world = db.get(World.key_for(world_id))
    if not world:
      self.error(404)
      return

    self.response.headers['Access-Control-Allow-Origin'] = '*'
    self.response.headers['Content-Type'] = 'image/png'
    self.response.out.write(world.thumbnail)


class WorldUploader(webapp.RequestHandler):
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

    id = str(uuid.uuid4())

    world = World(
        key_name = id,
        id = id,
        world = world_data_json,
        thumbnail = db.Blob(thumbnail))
    world.put()

    self.response.headers['Access-Control-Allow-Origin'] = '*'
    self.response.headers['Content-Type'] = 'application/json'
    self.response.out.write(json.dumps({
      'id': id,
      'thumbnail_url': '/worlds/thumbnails/' + id
    }))


application = webapp.WSGIApplication([('/worlds/data/(.*)', WorldDataHandler),
                                      ('/worlds/thumbnails/(.*)', WorldThumbnailHandler),
                                      ('/worlds/', WorldUploader)],
                                      debug=True)

if __name__ == '__main__':
    run_wsgi_app(application)
