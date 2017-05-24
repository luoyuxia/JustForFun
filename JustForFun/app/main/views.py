from . import main
from flask import render_template, Response, current_app, jsonify, request
import os
from ..models import User


@main.route("/")
def index():
    return render_template("index.html")


@main.route("/partials/<string:filename>")
def render(filename):
    return render_template("partials/" + filename)


@main.route("/getImage/<string:imageName>")
def get_image(imageName):
    imageLocation = os.path.join(current_app.static_folder, "img", imageName)
    with open(imageLocation, 'rb') as image:
        response = Response(image.read(), mimetype="image/jpeg")
        return response


@main.route("/user/<string:useraccount>")
def verify_account(useraccount):
    if User.query.filter_by(account=useraccount).first() is None:
        return jsonify(dict(result=True))
    return jsonify(dict(result=False))


@main.route("/register", methods=["Post"])
def user_register():
    requestData = request.get_json()
    account = requestData['account']
    username = requestData['username']
    password = requestData['password']
    newUser = User(account=account, username=username, password=password)
    return jsonify(dict(result=User.create_new_user(newUser)))
