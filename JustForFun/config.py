import os
basedir = os.path.abspath(os.path.dirname(__file__))
class Config:
    SECRET_KEY = "hard to guess"
    FLASKY_PER_PAGE = 5
    SQLALCHEMY_COMMIT_ON_TEARDOWN = True
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CHAT_NUMS_PER_REQUEST = 10
    # 允许上传的图片类型
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
    # 上传图片的最大大小
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024

    # 获取图片的基础位置
    BASE_LOCATION = "/getImage/"

    @staticmethod
    def init_app(app):
        pass

class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get('DEV_DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'data-dev.sqlite')


config = {
    'development': DevelopmentConfig,
    'default': DevelopmentConfig
}