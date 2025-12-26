from flask import Blueprint, render_template, request
import os

main = Blueprint('main', __name__)

@main.route("/")
def index():
    return render_template("index.html")

@main.route("/upload", methods=["POST"])
def upload():
    file = request.files["image"]

    save_path = os.path.join("static/uploads", file.filename)
    file.save(save_path)

    return render_template(
        "index.html",
        image_path=save_path
    )
