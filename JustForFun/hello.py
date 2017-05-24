from flask import Flask
from flask_script import Manager

app = Flask(__name__)


@app.route("/")
def index():
    return "<h1>Hello World!</h1>"

manager = Manager(app)

if __name__ == "__main__":
    manager.run()
