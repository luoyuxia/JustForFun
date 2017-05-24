from flask import g, jsonify, abort, current_app, request
from . import api, auth
from ..models import User
from flask_socketio import join_room, leave_room
from werkzeug.utils import secure_filename
import os
from datetime import datetime


# 为防止在浏览器中进行验证，所以用403错误掩饰401错误
@auth.verify_password
def verify_password(account_or_token, password):
    if account_or_token == "":
        abort(403)
        return True
    if password == "":
        g.current_user = User.verify_auth_token(account_or_token)
        g.token_used = True
        if g.current_user is not None:
            return True
    user = User.query.filter_by(account=account_or_token).first()
    if user is not None and user.verify_password(password=password) is True:
        g.current_user = user
        return True
    abort(403)
    return True


def forbidden(message):
    response = jsonify({'error': 'forbidden', 'message': message})
    response.status_code = 403
    return response


@api.route("/token")
@auth.login_required
def login():
    token = g.current_user.generate_auth_token(expiration=3600)
    user = g.current_user
    # 更新用户的在线状态
    user.login()
    return jsonify({"token": token, 'username': user.username, 'userid': user.id,
                    'img': current_app.config['BASE_LOCATION'] + user.personal_image,
                    'expiration': 3600})


@api.route('/logout')
@auth.login_required
def logout():
    user = g.current_user
    user.logout()
    return jsonify(dict(result=True))


@api.route('/getData')
@auth.login_required
def hello_world():
    user = g.current_user
    return jsonify({'message': "通过token获得的数据: " + user.username})


def allowed_file(filename):
    return '.' in filename and \
           (filename.rsplit('.', 1)[1]).lower() in current_app.config['ALLOWED_EXTENSIONS']


# 给文件名添加一个唯一的编号
def add_salt_to_file(filename):
    uniqueId = datetime.now().strftime("%Y%m%d%H%M%S")
    # 将文件名拆分成文件名+类型名数组
    split_arr = filename.rsplit('.', 1)
    return split_arr[0] + "_" + uniqueId + "." + split_arr[1]


# 用户上传自己的头像
@api.route("/uploadImage", methods=['Post'])
@auth.login_required
def upload_image():
    user = g.current_user
    file = request.files['image']
    if file and allowed_file(file.filename):
        filename = add_salt_to_file(secure_filename(file.filename))
        file.save(os.path.join(current_app.static_folder, "img", filename))
        # 删除用户之前的图片
        previos_image = os.path.join(current_app.static_folder, "img", user.personal_image)
        if os.path.exists(previos_image):
            os.remove(previos_image)
        # 改变用户的图片的地址
        user.personal_image = filename
        return jsonify(
            dict(result=True, imageName=filename, imageLocation=(current_app.config['BASE_LOCATION'] + filename)))
    return jsonify(dict(result=False, error="文件类型有误!"))
