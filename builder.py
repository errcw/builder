'''Front end serving.'''

import os

import webapp2
from google.appengine.ext import webapp
from google.appengine.ext.webapp import template
from google.appengine.ext.webapp.util import run_wsgi_app
from wsgiref.util import application_uri


def render_game(wrapper, is_google, request):
  base_url = application_uri(request.environ)
  path = os.path.join(os.path.dirname(__file__), 'templates', 'game.html')
  values = { 'wrapper': wrapper,
             'is_google': is_google,
             'baseurl': base_url,
           }
  return template.render(path, values)


class HtmlPage(webapp2.RequestHandler):
  '''Renders the game as an HTML page for debugging.'''
  def get(self):
    self.response.headers['Content-Type'] = 'text/html'
    self.response.out.write(render_game('builder.html', False, self.request))


app = webapp2.WSGIApplication([('/', HtmlPage), ('/es', EsGadget)], debug=True)
