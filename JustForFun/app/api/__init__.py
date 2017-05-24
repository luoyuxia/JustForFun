from flask import Blueprint

api = Blueprint('api', __name__)
from flask_httpauth import HTTPBasicAuth

auth = HTTPBasicAuth()
from . import authentication, data
