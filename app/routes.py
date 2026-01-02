from flask import Blueprint, render_template, request, current_app, url_for, jsonify
import os
import cv2
from services.image_processing import (
    noise_removal,
    contrast_enhancement,
    image_segmentation,
    render_histogram_image,
)
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

@main.route("/process/noise-removal", methods=["POST"])
def process_noise_removal():
    filename = secure_filename(request.form.get("filename", ""))
    method = (request.form.get("method", "") or "").lower().strip()

    if not filename or method not in ("gaussian", "median"):
        return jsonify({"error": "invalid input"}), 400

    # Ambil absolute path dari folder upload (SUDAH ADA DI CONFIG)
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    image_abs_path = os.path.join(upload_folder, filename)

    # Parameter optional: hanya teruskan jika ada input; default di service.
    gaussian_ksize_raw = request.form.get("gaussian_ksize")
    gaussian_sigma_raw = request.form.get("gaussian_sigma")
    median_ksize_raw = request.form.get("median_ksize")

    kwargs = {}
    if gaussian_ksize_raw:
        kwargs["gaussian_ksize"] = int(gaussian_ksize_raw)
    if gaussian_sigma_raw:
        kwargs["gaussian_sigma"] = float(gaussian_sigma_raw)
    if median_ksize_raw:
        kwargs["median_ksize"] = int(median_ksize_raw)

    # PROSES NOISE REMOVAL
    out_img = noise_removal(
        image_abs_path=image_abs_path,
        method=method,
        **kwargs,
    )

    # Simpan hasil ke static/outputs
    output_dir = os.path.join(current_app.static_folder, "outputs")
    os.makedirs(output_dir, exist_ok=True)

    # bikin nama output aman + konsisten png
    base_name = os.path.splitext(filename)[0]  # nama file tanpa ekstensi
    out_name = f"nr_{method}_{base_name}.png"
    out_path = os.path.join(output_dir, out_name)

    ok = cv2.imwrite(out_path, out_img)
    if not ok:
        return jsonify({"error": "gagal menyimpan output"}), 500

    return jsonify({
        "out_url": url_for("static", filename=f"outputs/{out_name}")
    })


@main.route("/process/contrast-enhancement", methods=["POST"])
def process_contrast_enhancement():
    filename = secure_filename(request.form.get("filename", ""))
    method = (request.form.get("method", "") or "").lower().strip()

    if not filename or method not in ("histogram", "clahe"):
        return jsonify({"error": "invalid input"}), 400

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    image_abs_path = os.path.join(upload_folder, filename)

    clip_limit_raw = request.form.get("clahe_clip_limit")
    tile_grid_raw = request.form.get("clahe_tile_grid_size")
    noise_method = (request.form.get("noise_method", "") or "").lower().strip()

    kwargs = {}
    if clip_limit_raw:
        kwargs["clahe_clip_limit"] = float(clip_limit_raw)
    if tile_grid_raw:
        kwargs["clahe_tile_grid_size"] = int(tile_grid_raw)

    pre_gray = None
    if noise_method in ("gaussian", "median"):
        pre_gray = noise_removal(
            image_abs_path=image_abs_path,
            method=noise_method,
        )

    out_img = contrast_enhancement(
        image_abs_path=image_abs_path,
        method=method,
        pre_gray=pre_gray,
        **kwargs,
    )

    output_dir = os.path.join(current_app.static_folder, "outputs")
    os.makedirs(output_dir, exist_ok=True)

    base_name = os.path.splitext(filename)[0]
    out_name = f"ce_{method}_{base_name}.png"
    out_path = os.path.join(output_dir, out_name)

    ok = cv2.imwrite(out_path, out_img)
    if not ok:
        return jsonify({"error": "gagal menyimpan output"}), 500

    return jsonify({
        "out_url": url_for("static", filename=f"outputs/{out_name}")
    })


@main.route("/process/segmentation", methods=["POST"])
def process_segmentation():
    filename = secure_filename(request.form.get("filename", ""))
    method = (request.form.get("method", "") or "").lower().strip()

    if not filename or method not in ("otsu",):
        return jsonify({"error": "invalid input"}), 400

    upload_folder = current_app.config["UPLOAD_FOLDER"]
    image_abs_path = os.path.join(upload_folder, filename)

    noise_method = (request.form.get("noise_method", "") or "").lower().strip()
    contrast_method = (request.form.get("contrast_method", "") or "").lower().strip()
    clip_limit_raw = request.form.get("clahe_clip_limit")
    tile_grid_raw = request.form.get("clahe_tile_grid_size")

    pre_gray = None
    if noise_method in ("gaussian", "median"):
        pre_gray = noise_removal(
            image_abs_path=image_abs_path,
            method=noise_method,
        )

    if contrast_method in ("histogram", "clahe"):
        kwargs = {}
        if clip_limit_raw:
            kwargs["clahe_clip_limit"] = float(clip_limit_raw)
        if tile_grid_raw:
            kwargs["clahe_tile_grid_size"] = int(tile_grid_raw)

        pre_gray = contrast_enhancement(
            image_abs_path=image_abs_path,
            method=contrast_method,
            pre_gray=pre_gray,
            **kwargs,
        )

    out_img = image_segmentation(
        image_abs_path=image_abs_path,
        method=method,
        pre_gray=pre_gray,
    )

    output_dir = os.path.join(current_app.static_folder, "outputs")
    os.makedirs(output_dir, exist_ok=True)

    base_name = os.path.splitext(filename)[0]
    out_name = f"seg_{method}_{base_name}.png"
    out_path = os.path.join(output_dir, out_name)

    ok = cv2.imwrite(out_path, out_img)
    if not ok:
        return jsonify({"error": "gagal menyimpan output"}), 500

    return jsonify({
        "out_url": url_for("static", filename=f"outputs/{out_name}")
    })


@main.route("/process/histogram", methods=["POST"])
def process_histogram():
    """
    Generate histogram image for a given image under the static folder.
    Accepts:
      - image_path: path relative to /static (e.g., 'uploads/foo.png' atau 'outputs/bar.png')
    """
    rel_path = request.form.get("image_path", "").lstrip("/")
    if not rel_path:
        return jsonify({"error": "invalid input"}), 400

    static_root = current_app.static_folder
    abs_target = os.path.normpath(os.path.join(static_root, rel_path))

    # Pastikan path berada di dalam static
    if os.path.commonpath([abs_target, static_root]) != os.path.abspath(static_root):
        return jsonify({"error": "invalid path"}), 400

    if not os.path.exists(abs_target):
        return jsonify({"error": "file not found"}), 404

    img = cv2.imread(abs_target, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return jsonify({"error": "cannot read image"}), 500

    hist_img = render_histogram_image(img)

    output_dir = os.path.join(static_root, "outputs")
    os.makedirs(output_dir, exist_ok=True)

    base_name = os.path.splitext(os.path.basename(rel_path))[0]
    out_name = f"hist_{base_name}.png"
    out_path = os.path.join(output_dir, out_name)

    ok = cv2.imwrite(out_path, hist_img)
    if not ok:
        return jsonify({"error": "gagal menyimpan histogram"}), 500

    return jsonify({
        "out_url": url_for("static", filename=f"outputs/{out_name}")
    })
