from app import socketio
from flask_socketio import emit, join_room, leave_room, close_room
from collections import defaultdict
from ..models import User

socketio.roomUserList = defaultdict(list)


@socketio.on("join_room")
def handle_join_room(data):
    room = data['room']
    user = data['user']
    # 如果该用户已经加入了该房间，直接返回
    if user in socketio.roomUserList[room]:
        return False
    # 先向当前该房间的所有用户发送有人加入了房间的信息
    emit("other_join_room", user, room=room)
    socketio.roomUserList[room].append(user)
    leave_room(room)
    join_room(room)
    print(str(user) + " has join the room " + str(room))
    # 向加入该房间的所有用户发送用户信息
    emit('currentUser', socketio.roomUserList[room], room=room)
    print("current Users :" + str(socketio.roomUserList[room]))
    return True


@socketio.on("create_room")
def handle_crete_room(roomname):
    # 如果该房间名已经存在了，返回false
    if roomname in socketio.roomUserList.keys():
        return False
    # 记录该房间，当前人数默认为空
    socketio.roomUserList[roomname] = []
    # 向客户端发送房间列表的信息以让客户端更新房间
    emit("rooms", dict(rooms=list(socketio.roomUserList.keys())), broadcast=True)
    return True


@socketio.on("leave_room")
def handle_leave_room(data):
    room = data['room']
    user = data['user']
    # 如果用户退出没有加入的房间，抛出异常
    if user not in socketio.roomUserList[room]:
        raise RuntimeError("用户试图退出没有加入的房间")
    socketio.roomUserList[room].remove(user)
    leave_room(room)
    # 如果该房间没有人的话,关闭该房间
    if len(socketio.roomUserList[room]) == 0:
        close_room(room)
        del socketio.roomUserList[room]
        emit("rooms", dict(rooms=list(socketio.roomUserList.keys())), broadcast=True)
        return
    print(str(user) + " has leaved the room")
    emit("other_leave_room", user, room=room)
    # 向该房间的成员显示当前的成员
    emit("currentUser", list(socketio.roomUserList[room]), room=room)


@socketio.on("sendMessage")
def handle_sendMessage(data):
    room = data['room']
    user = data['user']
    message = data['message']
    message_with_user = {"user": user, "message": message, "sendTime": data['sendTime']}
    emit('receive_message', dict(user=user, message=message_with_user), room=room)


@socketio.on("getRooms")
def get_rooms(data):
    rooms = socketio.roomUserList.keys()
    emit('rooms', {'rooms': list(rooms)})


@socketio.on("getUserList")
def get_users_in_room(data):
    room = data['room']
    users = socketio.roomUserList[room]
    emit("userList", {"users": users})


@socketio.on("login")
def handle_login(data):
    pass
    #  user = g.current_user
    #  print("login" + str(user.id))


@socketio.on("testcallback")
def handle_callback(data):
    print(str(data))
    return 'one', 2


@socketio.on("testsend")
def handle_testsend(message):
    print(str(message))
    # send(message)


@socketio.on('logout')
def handle_logout(data):
    # 找到发出登出请求的用户
    user = data["user"]
    # 找到该房间
    room = data['room']


# 某个用户加入一个私人的房间，以能够让该用户被私聊
@socketio.on('join_private_room')
def join_private_room(userid):
    room = User.get_room_name_byid(userid)
    if room is None:
        return False
    leave_room(room)
    join_room(room)
    return True


@socketio.on("send_private_message")
def send_private_message(data):
    sender = data['sender']
    sended_id = data['sended_id']
    message = data['message']
    room = User.get_room_name_byid(sended_id)
    if room is None:
        return False
    socketio.emit("receive", dict(sender=sender, message=message), room=room)


@socketio.on('disconnect')
def test_disconnect():
    print('Client disconnected')
