from config import config
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_marshmallow import Marshmallow
from flask_socketio import SocketIO

db = SQLAlchemy()
ma = Marshmallow()
socketio = SocketIO()

def create_app(config_name):
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    config[config_name].init_app(app)
    db.init_app(app)
    ma.init_app(app)
    socketio.init_app(app)
    from .main import main as main_blueprint
    app.register_blueprint(main_blueprint)

    from .api import api
    app.register_blueprint(api, url_prefix="/api")
    return app
