from flask import Blueprint, render_template, request, current_app, url_for
import os
from werkzeug.utils import secure_filename

main = Blueprint('main', __name__)

@main.route("/")
def index():
    return render_template(
        "index.html",
        image_path=None,
        has_image=False,
        error_message=None,
        image_filename=None,
    )


def allowed_file(filename):
    allowed = current_app.config.get("ALLOWED_EXTENSIONS", set())
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed

@main.route("/upload", methods=["POST"])
def upload():
    file = request.files.get("image")
    if not file or file.filename == "":
        return render_template(
            "index.html",
            image_path=None,
            has_image=False,
            error_message="Pilih file gambar terlebih dahulu.",
            image_filename=None,
        )

    filename = secure_filename(file.filename)
    if not allowed_file(filename):
        return render_template(
            "index.html",
            image_path=None,
            has_image=False,
            error_message="Format harus jpg, jpeg, atau png.",
            image_filename=None,
        )

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_folder, exist_ok=True)
    save_path = os.path.join(upload_folder, filename)
    file.save(save_path)

    image_url = url_for("static", filename=f"uploads/{filename}")
    return render_template(
        "index.html",
        image_path=image_url,
        has_image=True,
        error_message=None,
        image_filename=filename,
    )


@main.route("/clear", methods=["POST"])
def clear():
    filename = secure_filename(request.form.get("filename", ""))
    upload_folder = current_app.config["UPLOAD_FOLDER"]

    if filename:
        target_path = os.path.join(upload_folder, filename)
        # Only remove files inside the configured upload folder.
        if os.path.commonpath([os.path.abspath(target_path), os.path.abspath(upload_folder)]) == os.path.abspath(upload_folder):
            if os.path.exists(target_path):
                os.remove(target_path)

    return render_template(
        "index.html",
        image_path=None,
        has_image=False,
        error_message=None,
        image_filename=None,
    )
