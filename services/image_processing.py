import cv2
import numpy as np


def read_image(image_abs_path: str) -> np.ndarray:
    img = cv2.imread(image_abs_path)
    if img is None:
        raise ValueError(f"Gambar tidak bisa dibaca: {image_abs_path}")
    return img


def to_grayscale(bgr_img: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(bgr_img, cv2.COLOR_BGR2GRAY)


def normalize_gray_uint8(gray: np.ndarray) -> np.ndarray:
    if gray.ndim != 2:
        raise ValueError("Input harus citra grayscale (2D array).")

    gray_f = gray.astype(np.float32)
    gmin = float(gray_f.min())
    gmax = float(gray_f.max())

    if gmax - gmin < 1e-6:
        return np.clip(gray_f, 0, 255).astype(np.uint8)

    norm = (gray_f - gmin) / (gmax - gmin) * 255.0
    return np.clip(norm, 0, 255).astype(np.uint8)


def _make_odd(n: int) -> int:
    n = int(n)
    if n < 3:
        n = 3
    if n % 2 == 0:
        n += 1
    return n


def apply_gaussian(gray_u8: np.ndarray, ksize: int, sigma: float) -> np.ndarray:
    ksize = _make_odd(ksize)
    sigma = float(sigma)
    return cv2.GaussianBlur(gray_u8, (ksize, ksize), sigmaX=sigma)


def apply_median(gray_u8: np.ndarray, ksize: int) -> np.ndarray:
    ksize = _make_odd(ksize)
    return cv2.medianBlur(gray_u8, ksize)


def apply_histogram_equalization(gray_u8: np.ndarray) -> np.ndarray:
    """Contrast enhancement via global histogram equalization."""
    return cv2.equalizeHist(gray_u8)


def apply_clahe(gray_u8: np.ndarray, clip_limit: float, tile_grid_size: int) -> np.ndarray:
    """Contrast enhancement via CLAHE (adaptive)."""
    clip_limit = float(clip_limit)
    grid = _make_odd(tile_grid_size)
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(grid, grid))
    return clahe.apply(gray_u8)


def apply_otsu(gray_u8: np.ndarray) -> np.ndarray:
    """Segmentation via Otsu thresholding; returns binary mask (0/255)."""
    _, mask = cv2.threshold(gray_u8, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return mask


def render_histogram_image(gray_u8: np.ndarray, width: int = 256, height: int = 160) -> np.ndarray:
    """
    Render grayscale histogram as an image (uint8 BGR).
    - gray_u8: input grayscale (0-255)
    - width/height: output canvas size
    """
    hist = cv2.calcHist([gray_u8], [0], None, [256], [0, 256]).flatten()
    hist_max = hist.max() if hist.max() > 0 else 1.0
    hist = hist / hist_max

    canvas = np.full((height, width, 3), 25, dtype=np.uint8)

    # Area plot dengan margin untuk axis/label
    margin_left, margin_right, margin_top, margin_bottom = 26, 8, 8, 20
    plot_w = max(width - margin_left - margin_right, 1)
    plot_h = max(height - margin_top - margin_bottom, 1)

    bin_w = max(int(plot_w / 256), 1)
    bar_w = max(bin_w, 3)  # pastikan bar terlihat, terutama untuk citra biner
    base_y = margin_top + plot_h

    for i in range(256):
        h = int(hist[i] * plot_h)
        # Pastikan bar terlihat minimal 1px saat ada nilai
        if hist[i] > 0 and h < 1:
            h = 2
        cv2.rectangle(
            canvas,
            (margin_left + i * bin_w, base_y - h),
            (margin_left + i * bin_w + bar_w - 1, base_y),
            (230, 200, 180),
            thickness=-1,
        )

    # Axis
    cv2.line(canvas, (margin_left, margin_top), (margin_left, base_y), (90, 70, 60), 1)
    cv2.line(canvas, (margin_left, base_y), (margin_left + plot_w, base_y), (90, 70, 60), 1)

    # Labels
    cv2.putText(
        canvas,
        "Frequency",
        (4, margin_top + 10),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.35,
        (180, 180, 200),
        1,
        cv2.LINE_AA,
    )
    cv2.putText(
        canvas,
        "Intensity",
        (margin_left + int(plot_w * 0.55), height - 4),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.35,
        (180, 180, 200),
        1,
        cv2.LINE_AA,
    )

    cv2.rectangle(canvas, (0, 0), (width - 1, height - 1), (90, 70, 60), 1)
    return canvas


def noise_removal(
    image_abs_path: str,
    method: str,
    gaussian_ksize: int = 5,
    gaussian_sigma: float = 1.0,
    median_ksize: int = 5,
) -> np.ndarray:
    """
    FUNGSI UTAMA NOISE REMOVAL
    method: 'gaussian' atau 'median'
    output: image grayscale uint8 hasil noise removal
    """

    # 1) Read → grayscale → normalize
    bgr = read_image(image_abs_path)
    gray = to_grayscale(bgr)
    gray_u8 = normalize_gray_uint8(gray)

    # 2) Pilih metode
    method = (method or "").lower().strip()

    if method == "gaussian":
        return apply_gaussian(gray_u8, gaussian_ksize, gaussian_sigma)

    if method == "median":
        return apply_median(gray_u8, median_ksize)

    raise ValueError('method harus "gaussian" atau "median"')


def contrast_enhancement(
    image_abs_path: str,
    method: str,
    clahe_clip_limit: float = 2.0,
    clahe_tile_grid_size: int = 8,
    pre_gray: np.ndarray | None = None,
) -> np.ndarray:
    """
    FUNGSI UTAMA KONTRAS
    method: 'histogram' atau 'clahe'
    output: image grayscale uint8 hasil enhancement
    """
    if pre_gray is None:
        bgr = read_image(image_abs_path)
        gray = to_grayscale(bgr)
        gray_u8 = normalize_gray_uint8(gray)
    else:
        gray_u8 = normalize_gray_uint8(pre_gray)

    method = (method or "").lower().strip()

    if method == "histogram":
        return apply_histogram_equalization(gray_u8)

    if method == "clahe":
        return apply_clahe(gray_u8, clahe_clip_limit, clahe_tile_grid_size)

    raise ValueError('method harus "histogram" atau "clahe"')


def image_segmentation(
    image_abs_path: str,
    method: str,
    pre_gray: np.ndarray | None = None,
) -> np.ndarray:
    """
    FUNGSI UTAMA SEGMENTASI
    method: 'otsu'
    output: binary mask uint8 (0 atau 255)
    """
    if pre_gray is None:
        bgr = read_image(image_abs_path)
        gray = to_grayscale(bgr)
        gray_u8 = normalize_gray_uint8(gray)
    else:
        gray_u8 = normalize_gray_uint8(pre_gray)

    method = (method or "").lower().strip()

    if method == "otsu":
        return apply_otsu(gray_u8)

    raise ValueError('method harus "otsu"')


def apply_image_masking(
    image_abs_path: str,
    mask: np.ndarray,
    pre_gray: np.ndarray | None = None,
) -> np.ndarray:
    """
    FUNGSI UTAMA IMAGE MASKING
    Menerapkan mask ke gambar asli atau gambar yang sudah di-enhance.
    - image_abs_path: path ke gambar asli
    - mask: binary mask (0 atau 255) dari hasil segmentation
    - pre_gray: gambar grayscale yang sudah di-process (optional)
    output: gambar grayscale uint8 hasil masking
    """
    if pre_gray is None:
        bgr = read_image(image_abs_path)
        gray = to_grayscale(bgr)
        gray_u8 = normalize_gray_uint8(gray)
    else:
        gray_u8 = normalize_gray_uint8(pre_gray)

    # Normalize mask ke 0-1 untuk operasi masking
    mask_normalized = (mask > 127).astype(np.float32)
    
    # Terapkan mask: kalikan gambar dengan mask
    masked = (gray_u8.astype(np.float32) * mask_normalized).astype(np.uint8)
    
    return masked