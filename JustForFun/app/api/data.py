from . import api
from flask import jsonify, g, request, abort, current_app
from . import auth
from .. import db
from ..models import GameRecord, MyPagination, GameRecordSchema, MyPaginationSchema, User, UserSchema, ChatRecord
from string import Template


@api.route('/gameRecord', methods=['Post'])
@auth.login_required
def data():
    assert request.method == 'POST'
    user = g.current_user
    requestData = request.get_json()
    # 如果得分记录在request请求中的话，向数据库添加该条得分记录
    if 'score' in requestData:
        score = requestData['score']
        gameRecord = GameRecord(user=user, score=score)
        db.session.add(gameRecord)
        db.session.commit()
        return jsonify({'message': "success"})
    # 否则抛出异常
    abort(404)


@api.route("/tetrisRecord", methods=['GET'])
@auth.login_required
def getTetrisRecord():
    assert request.method == "GET"
    pagenum = request.args.get('page', 1, type=int)
    user = g.current_user
    query = user.gameRecords
    playNums = query.count()
    pagination = query.order_by(GameRecord.playTime.asc()) \
        .paginate(pagenum, per_page=current_app.config['FLASKY_PER_PAGE'],
                  error_out=False)
    myPagination = MyPagination(
        currentPage=pagination.page,
        pre_num=pagination.prev_num,
        next_num=pagination.next_num,
        has_next=pagination.has_next,
        has_prev=pagination.has_prev,
        totalPages=pagination.pages,
        totalItems=pagination.total)
    gameRecordsSchema = GameRecordSchema(many=True)
    myPaginationSchema = MyPaginationSchema()
    # 返回游戏次数，游戏记录，以及游戏记录的分页对象
    return jsonify({'playNums': playNums, 'gameRecords': gameRecordsSchema.dump(pagination.items).data,
                    'pagination': myPaginationSchema.dump(myPagination).data})


# 获取游戏记录的统计信息,每天得分的最大值
@api.route("/tetrisStatisInfo", methods=['Get'])
@auth.login_required
def getTetrisStatisInfo():
    assert g.current_user is not None
    user = g.current_user
    userId = user.id
    sql = "select strftime('%Y-%m-%d',  g.playTime) as playDate ,max(score) from GameRecord as g WHERE " \
          "g.user_id =" + str(userId) + " Group by strftime('%Y-%m-%d',  g.playTime)"
    resultRow = db.session.execute(sql)
    date = []
    score = []
    for row in resultRow:
        date.append(row[0])
        score.append(row[1])
    return jsonify({"date": date, "score": score})


# 得到10位顶级玩家
@api.route("/topTen", methods=["Get"])
def getTopTen():
    sql = "SELECT U.id,U.username,max(G.score) as maxScore FROM user as U ,GameRecord as G WHERE\
  U.id = g.user_id GROUP BY U.id,U.username ORDER BY score DESC LIMIT 0,10"

    resultRow = db.session.execute(sql)

    topTenUsers = []
    for row in resultRow:
        user = {
            "id": row[0],
            "username": row[1],
            "maxScore": row[2]
        }
        topTenUsers.append(user)
    return jsonify({"topUser": topTenUsers})


@api.route('/queryUser')
@auth.login_required
def queryUserByName():
    assert g.current_user is not None
    user = g.current_user
    username_to_query = request.args.get("username", "")
    page = request.args.get("page", 1, type=int)
    pagination = User.query.filter(User.username.like('%' + username_to_query + '%')).paginate(
        page, per_page=current_app.config['FLASKY_PER_PAGE'], error_out=False
    )
    users = pagination.items
    # 构造当前用户是否关注了这些用户的bool型数组
    hasFollowed = []
    for u in users:
        hasFollowed.append(user.is_following(u))
    myPagination = MyPagination(
        currentPage=pagination.page,
        pre_num=pagination.prev_num,
        next_num=pagination.next_num,
        has_next=pagination.has_next,
        has_prev=pagination.has_prev,
        totalPages=pagination.pages,
        totalItems=pagination.total)
    usersSchema = UserSchema(many=True)
    myPaginationSchema = MyPaginationSchema()
    return jsonify({'users': usersSchema.dump(users).data,
                    'pagination': myPaginationSchema.dump(myPagination).data,
                    'follows': hasFollowed})


@api.route("/unfollow/<userid>")
@auth.login_required
def un_follow_user(userid):
    assert g.current_user is not None
    user = g.current_user
    if user.un_follow(userid) is True:
        return jsonify(dict(result=True))
    return jsonify(dict(result=False))


@api.route("/getUser/<int:userid>")
@auth.login_required
def get_user(userid):
    assert g.current_user is not None
    user = User.query.filter_by(id=userid).first()
    userdump = UserSchema()
    if user is not None:
        return jsonify(dict(user=userdump.dump(user).data))


@api.route("/follow/<userid>")
@auth.login_required
def follow_user(userid):
    assert g.current_user is not None
    user = g.current_user
    if user.follow(userid) is True:
        return jsonify(dict(result=True))
    return jsonify(dict(result=False))


# 得到某个用户的所有好友
@api.route("/getFriends/<userid>")
@auth.login_required
def get_friends(userid):
    assert g.current_user is not None
    user = g.current_user
    followRelationShips = user.followed.all()
    friends = []
    for followRelationShip in followRelationShips:
        friends.append(followRelationShip.followed)
    usersDump = UserSchema(many=True)
    return jsonify(dict(friends=usersDump.dump(friends).data))


@api.route("/sendMessage", methods=['Post'])
@auth.login_required
def send_message():
    assert g.current_user is not None
    user = g.current_user
    requestData = request.get_json()
    sended_id = requestData['sended_id']
    message = requestData['message']
    sendTime, messageId = user.sendMessage(messageContent=message, user_id=sended_id)
    return jsonify(dict(result=True, sendTime=sendTime, messageId=messageId))


# 得到用户与某个人的从startRecord开始的最近的几条聊天记录,还需要判断自己是不是发送者
# 并将该用户与这个人的聊天记录标记为已读
@api.route("/chatRecords/<int:other_id>/<int:startRecord>", methods=['Get'])
@auth.login_required
def get_chat_records(other_id, startRecord):
    assert g.current_user is not None
    user = g.current_user
    # 要取得聊天记录的用户编号
    user_id = user.id
    # 构造查询语句
    endRecord = startRecord + current_app.config['FLASKY_PER_PAGE']

    # 将该用户与这个人的聊天记录标记为已读
    updateTemplate = Template("UPDATE ChatRecord SET hasReaded = 1\
                               WHERE ChatRecord.sender_id = $sender_id \
                              AND ChatRecord.sended_id = $sended_id;")
    updateSql = updateTemplate.substitute(sender_id=other_id, sended_id=user_id)
    db.session.execute(updateSql)

    sqlTemplate = Template("WITH tempView(sender_id,sended_id,chatContent,timestamp) \
          AS (SELECT sender_id, sended_id,chatContent,timestamp \
            FROM ChatRecord WHERE (sender_id = $user_id AND sended_id = $other_id)\
            OR (sender_id = $other_id AND sended_id = $user_id)" +
                           " ORDER BY  timestamp  DESC LIMIT $start,$end ) " +
                           "SELECT tempView.sender_id != $user_id as isReceive ,chatContent,strftime('%Y-%m-%d %H:%M:%S',timestamp) \
             ,u.id ,u.username,u.personal_image \
             FROM tempView,USER u WHERE tempView.sender_id = u.id  ORDER BY timestamp ASC ;")

    sql = sqlTemplate.substitute(user_id=user_id, other_id=other_id, start=startRecord, end=endRecord)
    resultRow = db.session.execute(sql)

    privateMessages = []
    for row in resultRow:
        sender = dict(id=row[3], username=row[4], image=current_app.config['BASE_LOCATION'] + row[5])
        privateMessage = dict(isReceive=(row[0] == 1), content=row[1], sendTime=row[2], sender=sender)
        privateMessages.append(privateMessage)
    return jsonify(privateMessages)


# 将某条聊天记录标记为已读
@api.route("/markAsReaded/<int:chatRecordId>")
def mark_as_readed(chatRecordId):
    return jsonify(dict(result=ChatRecord.mark_as_readed(chatRecordId)))


# 得到某位用户未读的聊天记录
@api.route("/getUnreaded")
@auth.login_required
def get_unreaded():
    assert g.current_user is not None
    user = g.current_user
    sqlTemplate = Template(
        "WITH unreadMessage(sender_id,latest_time)\
          AS (SELECT sender_id,max(timestamp) as latest_time From ChatRecord WHERE sended_id = $sended_id AND hasReaded = 0 GROUP BY sender_id)\
          SELECT  user.username,unreadMessage.sender_id,strftime('%Y-%m-%d %H:%M:%S',unreadMessage.latest_time), user.personal_image \
          FROM user,unreadMessage\
          WHERE user.id = unreadMessage.sender_id;")
    sql = sqlTemplate.substitute(sended_id=user.id)
    resultRow = db.session.execute(sql)
    # 提示信息
    message_infos = []
    for row in resultRow:
        message_info = dict(sender_name=row[0], sender_id=row[1], send_time=row[2],
                            sender_image=current_app.config['BASE_LOCATION'] + row[3])
        message_infos.append(message_info)
    return jsonify(message_infos)
