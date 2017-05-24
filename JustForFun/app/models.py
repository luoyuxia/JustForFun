from itsdangerous import TimedJSONWebSignatureSerializer as Serializer
from . import ma

import os
from datetime import datetime, time
from flask import Flask
from flask_sqlalchemy import SQLAlchemy

from . import db


# app = Flask(__name__)
# app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DEV_DATABASE_URL') or \
#                                        'sqlite:///' + os.path.join(
#                                            r'E:\A_大学学习\课程项目\WebCourse\WebCourseDesign\WebCourseProject\data-dev.sqlite')
# db = SQLAlchemy(app)


# 定义好友关系表
class Follow(db.Model):
    __tablename__ = "follows"
    follower_id = db.Column(db.INTEGER, db.ForeignKey('user.id'), primary_key=True)
    followed_id = db.Column(db.INTEGER, db.ForeignKey('user.id'), primary_key=True)
    timestamp = db.Column(db.DATETIME, default=datetime.utcnow())


class ChatRecord(db.Model):
    __tablename__ = 'ChatRecord'
    id = db.Column(db.INTEGER, primary_key=True)
    chatContent = db.Column(db.Text)
    timestamp = db.Column(db.DATETIME, default=datetime.now())
    hasReaded = db.Column(db.BOOLEAN, default=0)
    sender_id = db.Column(db.INTEGER, db.ForeignKey('user.id'))
    sended_id = db.Column(db.INTEGER, db.ForeignKey('user.id'))

    def __init__(self, chatContent, sender=None, sended=None, timestamp=None):
        self.chatContent = chatContent
        if self.sender is None:
            self.sender = sender
        if self.sended is None:
            self.sended = sended
        self.timestamp = timestamp

    @staticmethod
    def mark_as_readed(chatRecord_Id):
        chatRecord = ChatRecord.query.filter_by(id=chatRecord_Id).first()
        if chatRecord is not None:
            chatRecord.hasReaded = 1
            db.session.add(chatRecord)
            db.session.commit()
            return True
        return False

    def __repr__(self):
        return "<chatRecord sender %s ,sended %s>" % (self.sender.username, self.sended.username)


class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.INTEGER, primary_key=True)
    account = db.Column(db.String(64), unique=True, index=True)
    username = db.Column(db.String(64), unique=True, index=True)
    password = db.Column(db.String(64))
    is_online = db.Column(db.BOOLEAN, default=False)
    personal_image = db.Column(db.String(64), default="default.jpg")
    gameRecords = db.relationship("GameRecord", backref="user", lazy='dynamic')
    sendChatRecords = db.relationship("ChatRecord", foreign_keys=[ChatRecord.sender_id],
                                      backref=db.backref('sender', lazy='joined'),
                                      lazy='dynamic', cascade='all, delete-orphan')
    recieveChatRecords = db.relationship("ChatRecord", foreign_keys=[ChatRecord.sended_id],
                                         backref=db.backref('sended', lazy='joined'),
                                         lazy='dynamic', cascade='all, delete-orphan')
    # 定义好友关系 （单向关系）
    # 自己关注的好友
    followed = db.relationship('Follow', foreign_keys=[Follow.follower_id],
                               backref=db.backref('follower', lazy='joined'),
                               lazy='dynamic', cascade='all, delete-orphan')
    # 关注自己的好友
    followers = db.relationship('Follow', foreign_keys=[Follow.followed_id],
                                backref=db.backref('followed', lazy='joined'),
                                lazy='dynamic', cascade='all,delete-orphan')

    def __init__(self, account, username, password):
        self.account = account
        self.username = username
        self.password = password

    # 为该用户分配一个房间
    def generate_roomName(self):
        return self.username + str(self.id)

    @staticmethod
    def create_new_user(user):
        try:
            db.session.add(user)
            db.session.commit()
            return True
        except:
            return False

    @staticmethod
    def get_room_name_byid(userid):
        user = User.query.filter_by(id=userid).first()
        if user is None:
            return None
        return user.generate_roomName()

    def follow(self, user_id):
        user = User.query.filter_by(id=user_id).first()
        # 如果要关注的用户为空,返回false
        if user is None:
            return False
        f = Follow(follower=self, followed=user)
        db.session.add(f)
        db.session.commit()
        return True

    def un_follow(self, user_id):
        f = Follow.query.filter_by(follower_id=self.id).filter_by(followed_id
                                                                  =user_id).first()
        if f is not None:
            db.session.delete(f)
            db.session.commit()
            return True
        return False

    # 更新该用户的在线状态
    def login(self):
        user = User.query.filter_by(id=self.id).first()
        if user is not None:
            user.is_online = True
            db.session.add(user)
            db.session.commit()

    def logout(self):
        user = User.query.filter_by(id=self.id).first()
        if user is not None:
            user.is_online = 0
            db.session.add(user)
            db.session.commit()

    # 判断是否正在关注某个用户
    def is_following(self, user):
        return self.followed.filter_by(followed_id=user.id).first() is not None

    # 向某个人发送信息,返回发送时间
    def sendMessage(self, user_id, messageContent=""):
        user = User.query.filter_by(id=user_id).first()
        if user is None:
            return
        chat = ChatRecord(sender=self, sended=user, chatContent=messageContent, timestamp=datetime.now())
        db.session.add(chat)
        db.session.commit()
        format_time = chat.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        # 返回该聊天记录的时间，编号
        return format_time, chat.id

    def verify_password(self, password):
        return self.password == password

    def generate_auth_token(self, expiration):
        s = Serializer("you never know", expiration)
        return s.dumps({'id': self.id}).decode('ascii')

    def __repr__(self):
        return '<User %r>' % self.username

    @staticmethod
    def findUserById(userid):
        return User.query.filter_by(id=userid).first()

    @staticmethod
    def findUsersByUserName(username):
        return User.query.filter(User.username.like('%' + username + '%')).all()

    @staticmethod
    def verify_auth_token(token):
        s = Serializer("you never know")
        try:
            data = s.loads(token)
        except:
            return None
        return User.query.get(data['id'])


class UserSchema(ma.Schema):
    class Meta:
        model = User
        fields = ('id', 'username', 'password', 'is_online', 'personal_image')


class GameRecord(db.Model):
    __tablename__ = "GameRecord"

    id = db.Column(db.INTEGER, primary_key=True)
    playTime = db.Column(db.DATETIME, default=datetime.now())
    score = db.Column(db.INTEGER, default=0)
    user_id = db.Column(db.INTEGER, db.ForeignKey('user.id'))

    def __init__(self, user, score=0, playTime=datetime.now()):
        self.playTime = playTime
        if self.user is None:
            self.user = user
        self.score = score

    def __repr__(self):
        return '<GameRecord user: %s ,socre:%s,playTime: %s>' % (self.user_id.username, self.score
                                                                 , str(self.playTime))


class GameRecordSchema(ma.Schema):
    class Meta:
        model = GameRecord
        fields = ('playTime', 'score')


# 自定义的分页对象，方便序列化成JSON对象
class MyPagination(object):
    def __init__(self, currentPage=0, pre_num=0, next_num=0, has_next=0, has_prev=0, totalPages=0,
                 totalItems=0):
        self.currentPage = currentPage
        self.pre_num = pre_num
        self.next_num = next_num
        self.has_next = has_next
        self.has_prev = has_prev
        self.pages = totalPages
        self.totalItems = totalItems


class MyPaginationSchema(ma.Schema):
    class Meta:
        model = GameRecord
        fields = ('currentPage', 'pre_num', 'next_num', 'has_next', 'has_prev',
                  'pages', 'totalItems')


"""
if __name__ == '__main__':
    #   user = User(username='luoyuxia', password='luoyuxia')
    #   user2 = User(username="DS",password="SD")
    user = User.query.filter_by(username="luoyuxia").first()
    print(user)
    user2 = User.query.filter_by(username='DS').first()
    print(user.is_following(user2))
    #  chatRecord = ChatRecord(chatContent="SDKP", sender=user, sended=user2)
    #  db.session.add(chatRecord)
    #   user.follow(user2)
    #  gameRecord1 = GameRecord(user=user, score=5)
    #  db.session.add(user)
    #  db.session.add(user2)
    #   user.follow(user2)
    #  db.session.add(gameRecord1)
    #   records = user.sendChatRecords.first()
    #   print(records)
    #  print(records.sender)
    #  print(user.gameRecords)
    #  db.session.commit()
    #  print(chatRecord.id)
    print(User.findUsersByUserName(username='D'))
    print(User.findUserById(1))

"""
