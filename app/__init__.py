from flask import Flask
import os

def create_app():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    template_dir = os.path.join(root_dir, 'templates')
    static_dir = os.path.join(root_dir, 'static')
    
    app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)

    upload_dir = os.path.join(static_dir, 'uploads')
    app.config['UPLOAD_FOLDER'] = upload_dir
    app.config['ALLOWED_EXTENSIONS'] = {'jpg', 'jpeg', 'png'}

    from .routes import main
    app.register_blueprint(main)

    return app
