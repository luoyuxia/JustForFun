from flask_script import Manager
import os
from app import create_app, db, socketio
from flask_migrate import MigrateCommand, Migrate
import app.socketHandler

app = create_app(os.getenv('FLASK_CONFIG') or 'default')
app.jinja_env.variable_start_string = '%%'
app.jinja_env.variable_end_string = '%%'
manager = Manager(app)
migrate = Migrate(app, db)
manager.add_command('db', MigrateCommand)
if __name__ == '__main__':
    socketio.run(app)
