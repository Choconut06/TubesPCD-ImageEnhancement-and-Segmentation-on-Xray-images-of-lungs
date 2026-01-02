document.addEventListener("DOMContentLoaded", () => {
  const dropArea = document.getElementById("dropArea");
  const fileInput = document.getElementById("fileInput");
  const uploadForm = document.getElementById("uploadForm");
  const resetButton = document.getElementById("resetControls");
  const brightness = document.getElementById("brightness");
  const brightnessValue = document.getElementById("brightnessValue");
  const brightnessTargets = document.querySelectorAll(".brightness-target");
  const mainImage = document.querySelector(".uploaded-image");
  const processedPreview = document.querySelector(".processed-preview");
  const rawPreview = document.querySelector(".raw-preview");
  const rawHistogramImg = document.getElementById("rawHistogram");
  const processedHistogramImg = document.getElementById("processedHistogram");
  const gaussianKernel = document.getElementById("gaussianKernel");
  const gaussianKernelValue = document.getElementById("gaussianKernelValue");
  const gaussianSigma = document.getElementById("gaussianSigma");
  const gaussianSigmaValue = document.getElementById("gaussianSigmaValue");
  const medianKernel = document.getElementById("medianKernel");
  const medianKernelValue = document.getElementById("medianKernelValue");
  const applyNoiseBtn = document.getElementById("applyNoise");
  const downloadProcessedBtn = document.getElementById("downloadProcessed");
  const zoomInBtn = document.getElementById("zoomIn");
  const zoomOutBtn = document.getElementById("zoomOut");
  const zoomResetBtn = document.getElementById("zoomReset");
  const zoomValue = document.getElementById("zoomValue");
  const zoomTargets = document.querySelectorAll(".zoom-target");
  const mainPanel = document.querySelector(".main-panel");
  let currentZoom = 1.0;
  let translateX = 0;
  let translateY = 0;
  const currentFilenameInput = document.getElementById("currentFilename");
  const toggleIds = ["gaussian", "median", "histogram", "clahe", "otsu"];
  const toggles = toggleIds
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const singleSelectGroups = [
    ["gaussian", "median"],
    ["histogram", "clahe"],
  ];

  const applyBrightness = (value) => {
    const sliderValue = Math.max(0, Math.min(100, Number(value)));
    const brightnessPercent = (sliderValue / 50) * 100; // 50 => normal (100%)
    brightnessTargets.forEach((img) => {
      img.style.filter = `brightness(${brightnessPercent}%)`;
    });
    if (brightnessValue) {
      brightnessValue.textContent = `${Math.round(sliderValue)}%`;
    }
  };

  const resetControls = () => {
    if (brightness) {
      brightness.value = 50;
      applyBrightness(50);
    }
    if (gaussianKernel) gaussianKernel.value = 5;
    if (gaussianSigma) gaussianSigma.value = 0.0;
    if (medianKernel) medianKernel.value = 5;
    toggles.forEach((toggle) => {
      toggle.checked = false;
    });
    resetProcessedImage();
    updateGaussianDisplay();
    updateGaussianControlsState();
    updateMedianDisplay();
    updateMedianControlsState();
    currentZoom = 1.0;
    translateX = 0;
    translateY = 0;
    applyZoom();
  };

  if (resetButton) {
    resetButton.addEventListener("click", resetControls);
  }

  const setupSingleSelect = (ids) => {
    const controls = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    controls.forEach((control) => {
      control.addEventListener("change", () => {
        if (!control.checked) return;
        controls.forEach((other) => {
          if (other !== control) other.checked = false;
        });
      });
    });
  };

  singleSelectGroups.forEach(setupSingleSelect);

  const updateGaussianDisplay = () => {
    if (gaussianKernelValue && gaussianKernel) {
      gaussianKernelValue.textContent = String(gaussianKernel.value);
    }
    if (gaussianSigmaValue && gaussianSigma) {
      gaussianSigmaValue.textContent = Number(gaussianSigma.value).toFixed(1);
    }
  };

  const updateGaussianControlsState = () => {
    const gaussianToggle = document.getElementById("gaussian");
    const enabled = gaussianToggle?.checked;
    [gaussianKernel, gaussianSigma].forEach((el) => {
      if (!el) return;
      el.disabled = !enabled;
      el.classList.toggle("range-disabled", !enabled);
    });
  };

  const updateMedianDisplay = () => {
    if (medianKernelValue && medianKernel) {
      medianKernelValue.textContent = String(medianKernel.value);
    }
  };

  const updateMedianControlsState = () => {
    const medianToggle = document.getElementById("median");
    const enabled = medianToggle?.checked;
    if (medianKernel) {
      medianKernel.disabled = !enabled;
      medianKernel.classList.toggle("range-disabled", !enabled);
    }
  };

  const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

  const applyZoom = () => {
    zoomTargets.forEach((el) => {
      el.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentZoom})`;
      el.style.transformOrigin = "center center";
    });
    if (zoomValue) {
      zoomValue.textContent = `${Math.round(currentZoom * 100)}%`;
    }
  };

  const originalImageSrc = rawPreview?.src || mainImage?.src || "";

  const setProcessedImageSrc = (src) => {
    if (processedPreview) processedPreview.src = src;
    if (mainImage) mainImage.src = src;
  };

  const resetProcessedImage = () => {
    if (originalImageSrc) {
      setProcessedImageSrc(originalImageSrc);
      updateProcessedHistogram(originalImageSrc);
    }
  };

  const stripCache = (src) => (src || "").split("?")[0];

  const toRelativeStaticPath = (src) => {
    if (!src) return "";
    try {
      const url = new URL(src, window.location.origin);
      let path = url.pathname || "";
      path = path.replace(/^\/+/, "");
      path = path.replace(/^static\//, "");
      return path;
    } catch {
      return src.replace(/^\/+/, "").replace(/^static\//, "");
    }
  };

  const updateHistogram = async (targetEl, imgSrc) => {
    if (!targetEl || !imgSrc) return;
    const relPath = toRelativeStaticPath(stripCache(imgSrc));
    if (!relPath) return;

    const formData = new FormData();
    formData.append("image_path", relPath);

    try {
      const response = await fetch("/process/histogram", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data?.out_url) {
        targetEl.src = `${data.out_url}?t=${Date.now()}`;
      }
    } catch (err) {
      console.error("Histogram update failed:", err);
    }
  };

  const updateRawHistogram = () => {
    updateHistogram(rawHistogramImg, rawPreview?.src || originalImageSrc);
  };

  const updateProcessedHistogram = (src) => {
    updateHistogram(processedHistogramImg, src || processedPreview?.src);
  };

  const getActiveNoiseMethod = () => {
    const gaussian = document.getElementById("gaussian");
    const median = document.getElementById("median");
    if (gaussian?.checked) return "gaussian";
    if (median?.checked) return "median";
    return "";
  };

  const getNoiseParams = () => {
    const params = {};
    if (gaussianKernel) {
      params.gaussian_ksize = parseInt(gaussianKernel.value, 10);
    }
    if (gaussianSigma) {
      params.gaussian_sigma = parseFloat(gaussianSigma.value);
    }
    if (medianKernel) {
      params.median_ksize = parseInt(medianKernel.value, 10);
    }
    return params;
  };

  const getActiveContrastMethod = () => {
    const histogram = document.getElementById("histogram");
    const clahe = document.getElementById("clahe");
    if (histogram?.checked) return "histogram";
    if (clahe?.checked) return "clahe";
    return "";
  };

  const getActiveSegmentationMethod = () => {
    const otsu = document.getElementById("otsu");
    if (otsu?.checked) return "otsu";
    return "";
  };

  const runNoiseRemoval = async (method, noiseParams = {}) => {
    const filename = currentFilenameInput?.value;
    if (!filename || !method) {
      resetProcessedImage();
      updateProcessedHistogram(filename ? `${window.location.origin}/static/uploads/${filename}` : "");
      return;
    }

    const formData = new FormData();
    formData.append("filename", filename);
    formData.append("method", method);
    if (method === "gaussian") {
      if (Number.isFinite(noiseParams.gaussian_ksize)) {
        formData.append("gaussian_ksize", String(noiseParams.gaussian_ksize));
      }
      if (Number.isFinite(noiseParams.gaussian_sigma)) {
        formData.append("gaussian_sigma", String(noiseParams.gaussian_sigma));
      }
    }
    if (method === "median") {
      if (Number.isFinite(noiseParams.median_ksize)) {
        formData.append("median_ksize", String(noiseParams.median_ksize));
      }
    }

    try {
      const response = await fetch("/process/noise-removal", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        resetProcessedImage();
        return;
      }
      const data = await response.json();
      if (data?.out_url) {
        const url = data.out_url;
        setProcessedImageSrc(`${url}?t=${Date.now()}`);
        updateProcessedHistogram(url);
      } else {
        resetProcessedImage();
      }
    } catch (err) {
      console.error("Noise removal failed:", err);
      resetProcessedImage();
    }
  };

  const runContrastEnhancement = async (method, noiseMethod, noiseParams = {}) => {
    const filename = currentFilenameInput?.value;
    if (!filename || !method) {
      resetProcessedImage();
      updateProcessedHistogram(filename ? `${window.location.origin}/static/uploads/${filename}` : "");
      return;
    }

    const formData = new FormData();
    formData.append("filename", filename);
    formData.append("method", method);
    if (noiseMethod) {
      formData.append("noise_method", noiseMethod);
      if (noiseMethod === "gaussian") {
        if (Number.isFinite(noiseParams.gaussian_ksize)) {
          formData.append("gaussian_ksize", String(noiseParams.gaussian_ksize));
        }
        if (Number.isFinite(noiseParams.gaussian_sigma)) {
          formData.append("gaussian_sigma", String(noiseParams.gaussian_sigma));
        }
      }
      if (noiseMethod === "median") {
        if (Number.isFinite(noiseParams.median_ksize)) {
          formData.append("median_ksize", String(noiseParams.median_ksize));
        }
      }
    }

    try {
      const response = await fetch("/process/contrast-enhancement", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        resetProcessedImage();
        return;
      }
      const data = await response.json();
      if (data?.out_url) {
        const url = data.out_url;
        setProcessedImageSrc(`${url}?t=${Date.now()}`);
        updateProcessedHistogram(url);
      } else {
        resetProcessedImage();
      }
    } catch (err) {
      console.error("Contrast enhancement failed:", err);
      resetProcessedImage();
    }
  };

  const runSegmentation = async (method, noiseMethod, contrastMethod, noiseParams = {}) => {
    const filename = currentFilenameInput?.value;
    if (!filename || !method) {
      resetProcessedImage();
      updateProcessedHistogram(filename ? `${window.location.origin}/static/uploads/${filename}` : "");
      return;
    }

    const formData = new FormData();
    formData.append("filename", filename);
    formData.append("method", method);
    if (noiseMethod) formData.append("noise_method", noiseMethod);
    if (contrastMethod) formData.append("contrast_method", contrastMethod);
    if (noiseMethod === "gaussian") {
      if (Number.isFinite(noiseParams.gaussian_ksize)) {
        formData.append("gaussian_ksize", String(noiseParams.gaussian_ksize));
      }
      if (Number.isFinite(noiseParams.gaussian_sigma)) {
        formData.append("gaussian_sigma", String(noiseParams.gaussian_sigma));
      }
    }
    if (noiseMethod === "median") {
      if (Number.isFinite(noiseParams.median_ksize)) {
        formData.append("median_ksize", String(noiseParams.median_ksize));
      }
    }

    try {
      const response = await fetch("/process/segmentation", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        resetProcessedImage();
        return;
      }
      const data = await response.json();
      if (data?.out_url) {
        const url = data.out_url;
        setProcessedImageSrc(`${url}?t=${Date.now()}`);
        updateProcessedHistogram(url);
      } else {
        resetProcessedImage();
      }
    } catch (err) {
      console.error("Segmentation failed:", err);
      resetProcessedImage();
    }
  };

  const processImage = () => {
    const contrastMethod = getActiveContrastMethod();
    const noiseMethod = getActiveNoiseMethod();
    const noiseParams = getNoiseParams();
    const segmentationMethod = getActiveSegmentationMethod();

    if (segmentationMethod) {
      runSegmentation(segmentationMethod, noiseMethod, contrastMethod, noiseParams);
      return;
    }

    if (contrastMethod) {
      runContrastEnhancement(contrastMethod, noiseMethod, noiseParams);
      return;
    }

    if (noiseMethod) {
      runNoiseRemoval(noiseMethod, noiseParams);
      return;
    }

    resetProcessedImage();
  };

  ["gaussian", "median", "histogram", "clahe", "otsu"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("change", processImage);
    }
  });

  [gaussianKernel, gaussianSigma].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", () => {
      updateGaussianDisplay();
    });
  });

  if (medianKernel) {
    medianKernel.addEventListener("input", () => {
      updateMedianDisplay();
    });
  }

  if (brightness) {
    brightness.addEventListener("input", (event) => {
      applyBrightness(event.target.value);
    });
    applyBrightness(brightness.value);
  }

  if (!fileInput || !uploadForm) return;

  // Initial histogram render for loaded image
  if (rawPreview?.src) {
    updateRawHistogram();
    updateProcessedHistogram(processedPreview?.src || rawPreview.src);
  }

  updateGaussianDisplay();
  updateGaussianControlsState();
  updateMedianDisplay();
  updateMedianControlsState();
  applyZoom();
  const gaussianToggle = document.getElementById("gaussian");
  if (gaussianToggle) {
    gaussianToggle.addEventListener("change", updateGaussianControlsState);
  }
  const medianToggle = document.getElementById("median");
  if (medianToggle) {
    medianToggle.addEventListener("change", updateMedianControlsState);
  }
  if (applyNoiseBtn) {
    applyNoiseBtn.addEventListener("click", processImage);
  }

  if (downloadProcessedBtn) {
    downloadProcessedBtn.addEventListener("click", () => {
      const src = processedPreview?.src || mainImage?.src;
      if (!src) return;
      const link = document.createElement("a");
      link.href = src;
      link.download = "processed_image.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  const clampZoom = (value) => Math.min(3, Math.max(0.5, value));

  if (zoomInBtn) {
    zoomInBtn.addEventListener("click", () => {
      currentZoom = clampZoom(currentZoom + 0.1);
      translateX = 0;
      translateY = 0;
      applyZoom();
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener("click", () => {
      currentZoom = clampZoom(currentZoom - 0.1);
      translateX = 0;
      translateY = 0;
      applyZoom();
    });
  }

  if (zoomResetBtn) {
    zoomResetBtn.addEventListener("click", () => {
      currentZoom = 1.0;
      translateX = 0;
      translateY = 0;
      applyZoom();
    });
  }

  const updatePanFromCursor = (event) => {
    if (!mainPanel || !zoomTargets.length || currentZoom <= 1.0) {
      translateX = 0;
      translateY = 0;
      applyZoom();
      return;
    }
    const panelRect = mainPanel.getBoundingClientRect();
    const target = zoomTargets[0];
    const imgRect = target.getBoundingClientRect();

    const maxOffsetX = Math.max(0, (imgRect.width - panelRect.width) / 2);
    const maxOffsetY = Math.max(0, (imgRect.height - panelRect.height) / 2);

    const normX = clamp((event.clientX - panelRect.left) / panelRect.width, 0, 1);
    const normY = clamp((event.clientY - panelRect.top) / panelRect.height, 0, 1);

    translateX = clamp((0.5 - normX) * 2 * maxOffsetX, -maxOffsetX, maxOffsetX);
    translateY = clamp((0.5 - normY) * 2 * maxOffsetY, -maxOffsetY, maxOffsetY);

    applyZoom();
  };

  if (mainPanel) {
    mainPanel.addEventListener("mousemove", updatePanFromCursor);
    mainPanel.addEventListener("mouseleave", () => {
      translateX = 0;
      translateY = 0;
      applyZoom();
    });
  }

  const preventDefaults = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const highlight = () => dropArea.classList.add("active");
  const unhighlight = () => dropArea.classList.remove("active");

  if (dropArea) {
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      dropArea.addEventListener(eventName, preventDefaults, false);
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      dropArea.addEventListener(eventName, highlight, false);
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropArea.addEventListener(eventName, unhighlight, false);
    });

    dropArea.addEventListener("click", () => fileInput.click());

    dropArea.addEventListener("drop", (event) => {
      const droppedFiles = event.dataTransfer.files;
      if (!droppedFiles || !droppedFiles.length) return;

      const file = droppedFiles[0];
      const allowedTypes = ["image/jpeg", "image/png"];
      if (!allowedTypes.includes(file.type)) {
        alert("Format harus jpg, jpeg, atau png.");
        return;
      }

      fileInput.files = droppedFiles;
      uploadForm.submit();
    });
  }

  fileInput.addEventListener("change", () => {
    if (!fileInput.files || !fileInput.files.length) return;
    uploadForm.submit();
  });
});
