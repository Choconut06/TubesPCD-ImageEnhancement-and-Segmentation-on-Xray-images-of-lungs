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
    toggles.forEach((toggle) => {
      toggle.checked = false;
    });
    resetProcessedImage();
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

  const runNoiseRemoval = async (method) => {
    const filename = currentFilenameInput?.value;
    if (!filename || !method) {
      resetProcessedImage();
      updateProcessedHistogram(filename ? `${window.location.origin}/static/uploads/${filename}` : "");
      return;
    }

    const formData = new FormData();
    formData.append("filename", filename);
    formData.append("method", method);

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

  const runContrastEnhancement = async (method, noiseMethod) => {
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

  const runSegmentation = async (method, noiseMethod, contrastMethod) => {
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
    const segmentationMethod = getActiveSegmentationMethod();

    if (segmentationMethod) {
      runSegmentation(segmentationMethod, noiseMethod, contrastMethod);
      return;
    }

    if (contrastMethod) {
      runContrastEnhancement(contrastMethod, noiseMethod);
      return;
    }

    if (noiseMethod) {
      runNoiseRemoval(noiseMethod);
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
