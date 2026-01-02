document.addEventListener("DOMContentLoaded", () => {
  const dropArea = document.getElementById("dropArea");
  const fileInput = document.getElementById("fileInput");
  const uploadForm = document.getElementById("uploadForm");
  const resetButton = document.getElementById("resetControls");
  const brightness = document.getElementById("brightness");
  const brightnessValue = document.getElementById("brightnessValue");
  const brightnessTargets = document.querySelectorAll(".brightness-target");
  const toggleIds = ["gaussian", "median", "histogram", "clahe", "otsu"];
  const toggles = toggleIds.map((id) => document.getElementById(id)).filter(Boolean);
  const otsuToggle = document.getElementById("otsu");
  const otsuSlider = document.getElementById("otsuThreshold");
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

  const updateOtsuSliderState = () => {
    if (!otsuSlider || !otsuToggle) return;

    const canUseSlider = !otsuToggle.disabled && otsuToggle.checked;
    otsuSlider.disabled = !canUseSlider;
    otsuSlider.classList.toggle("range-disabled", !canUseSlider);
  };

  const resetControls = () => {
    if (brightness) {
      brightness.value = 50;
      applyBrightness(50);
    }
    toggles.forEach((toggle) => {
      toggle.checked = false;
    });
    if (otsuSlider) {
      otsuSlider.value = 128;
    }
    updateOtsuSliderState();
  };

  if (resetButton) {
    resetButton.addEventListener("click", resetControls);
  }

  const setupSingleSelect = (ids) => {
    const controls = ids.map((id) => document.getElementById(id)).filter(Boolean);
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

  if (brightness) {
    brightness.addEventListener("input", (event) => {
      applyBrightness(event.target.value);
    });
    applyBrightness(brightness.value);
  }

  if (otsuToggle) {
    otsuToggle.addEventListener("change", updateOtsuSliderState);
    updateOtsuSliderState();
  }

  if (!fileInput || !uploadForm) return;

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
