'''Front end serving.'''

import os

from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext.webapp import template
from google.appengine.ext.webapp.util import run_wsgi_app
from wsgiref.util import application_uri


def render_game(wrapper, request):
  base_url = application_uri(request.environ)
  path = os.path.join(os.path.dirname(__file__), 'templates', 'game.html')
  values = { 'wrapper': wrapper,
             'baseurl': base_url,
            }
  return template.render(path, values)


class EsGadget(webapp.RequestHandler):
  '''Renders the game as an XML gadget for ES.'''
  def get(self):
    self.response.headers['Content-Type'] = 'application/xml'
    self.response.out.write(render_game('builder.xml', self.request))


class Builder(webapp.RequestHandler):
  '''Renders the game as an HTML page for debugging.'''
  def get(self):
    self.response.headers['Content-Type'] = 'text/html'
    self.response.out.write(render_game('builder.html', self.request))


application = webapp.WSGIApplication([('/', Builder),
                                      ('/es', EsGadget)],
                                     debug=True)

if __name__ == '__main__':
    run_wsgi_app(application)
