from flask import Flask
import os

def create_app():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    template_dir = os.path.join(root_dir, 'templates')
    static_dir = os.path.join(root_dir, 'static')
    
    app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)

    app.config['UPLOAD_FOLDER'] = 'static/uploads'

    from .routes import main
    app.register_blueprint(main)

    return app
