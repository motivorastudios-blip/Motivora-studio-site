import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
    import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js?module";
    import { STLLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/STLLoader.js?module";

    const DEFAULT_QUALITY = (window.DEFAULT_QUALITY || "ultra").toLowerCase();
    const form = document.getElementById("upload-form");
    const submitButton = document.getElementById("submit-button");
    const statusLabel = document.getElementById("status-label");
    const progressBar = document.getElementById("progress-bar");
    const totalEta = document.getElementById("total-eta");
    const fileInput = document.getElementById("model");
    const axisSelect = document.getElementById("axis");
    const offsetInput = document.getElementById("offset");
    const autoCheckbox = document.getElementById("auto_orientation");
    const qualitySelect = document.getElementById("quality");
    const kelvinSelect = document.getElementById("kelvin");
    const autoBrightnessCheckbox = document.getElementById("auto_brightness");
    const exposureSlider = document.getElementById("exposure");
    const exposureValue = document.getElementById("exposure-value");
    const exposureField = document.getElementById("exposure-field");
    const viewerCanvas = document.getElementById("viewer");
    const viewerNote = document.getElementById("viewer-note");
    const previewButton = document.getElementById("preview-spin");
    const uploadSection = document.getElementById("upload-section");
    const progressSection = document.getElementById("progress-section");
    const cancelButton = document.getElementById("cancel-button");
    const downloadButton = document.getElementById("download-button");
    const uploadStatus = document.getElementById("upload-status");
    const summaryQuality = document.getElementById("summary-quality");
    const summaryOrientation = document.getElementById("summary-orientation");
    const summaryAxis = document.getElementById("summary-axis");
    const resetViewButton = document.getElementById("reset-view");

    if (!viewerCanvas) {
      console.error("[Preview] ERROR: Canvas element 'viewer' not found in DOM!");
    } else {
      console.log("[Preview] Canvas found, initial dimensions:", viewerCanvas.clientWidth, "x", viewerCanvas.clientHeight);
    }
    
    const renderer = new THREE.WebGLRenderer({ canvas: viewerCanvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Set initial size - use fallback if canvas has no size yet
    const initialWidth = viewerCanvas?.clientWidth || 800;
    const initialHeight = viewerCanvas?.clientHeight || 600;
    renderer.setSize(initialWidth, initialHeight, false);
    renderer.setClearColor(0x000000, 1);
    console.log("[Preview] Renderer initialized with size:", initialWidth, "x", initialHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      viewerCanvas.clientWidth / viewerCanvas.clientHeight,
      0.1,
      1000
    );
    const DEFAULT_CAMERA_POS = new THREE.Vector3(0, -4, 2.5);
    const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0, 0);
    camera.position.copy(DEFAULT_CAMERA_POS);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.target.copy(DEFAULT_CAMERA_TARGET);
    controls.update();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);
    const keyLight = new THREE.DirectionalLight(0xfff2d4, 0.9);
    keyLight.position.set(3, -4, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xf8e7b0, 0.6);
    fillLight.position.set(-2.5, 3.5, 4);
    scene.add(fillLight);

    // Kelvin to RGB conversion function
    function kelvinToRGB(kelvin) {
      kelvin = Math.max(1000, Math.min(40000, kelvin));
      const temp = kelvin / 100.0;
      
      let red, green, blue;
      
      // Red component
      if (temp <= 66) {
        red = 255;
      } else {
        red = temp - 60;
        red = 329.698727446 * Math.pow(red, -0.1332047592);
        red = Math.max(0, Math.min(255, red));
      }
      
      // Green component
      if (temp <= 66) {
        green = temp;
        green = 99.4708025861 * Math.log(green) - 161.1195681661;
        green = Math.max(0, Math.min(255, green));
      } else {
        green = temp - 60;
        green = 288.1221695283 * Math.pow(green, -0.0755148492);
        green = Math.max(0, Math.min(255, green));
      }
      
      // Blue component
      if (temp >= 66) {
        blue = 255;
      } else if (temp <= 19) {
        blue = 0;
      } else {
        blue = temp - 10;
        blue = 138.5177312231 * Math.log(blue) - 305.0447927307;
        blue = Math.max(0, Math.min(255, blue));
      }
      
      return { r: red / 255, g: green / 255, b: blue / 255 };
    }

    // Update preview lighting based on Kelvin temperature (optimized)
    function updatePreviewLighting(kelvin) {
      const keyColor = kelvinToRGB(kelvin);
      const fillColor = kelvinToRGB(Math.min(10000, kelvin + 500));
      
      keyLight.color.setRGB(keyColor.r, keyColor.g, keyColor.b);
      fillLight.color.setRGB(fillColor.r, fillColor.g, fillColor.b);
      
      // Force immediate render to show changes
      renderPreview();
      
      console.log(`[Preview] Kelvin updated to ${kelvin}K - Key: RGB(${Math.round(keyColor.r*255)}, ${Math.round(keyColor.g*255)}, ${Math.round(keyColor.b*255)}), Fill: RGB(${Math.round(fillColor.r*255)}, ${Math.round(fillColor.g*255)}, ${Math.round(fillColor.b*255)})`);
    }

    // Update preview brightness based on exposure value (optimized)
    function updatePreviewBrightness(exposure) {
      const factor = Math.pow(2, exposure);
      ambientLight.intensity = Math.max(0.1, Math.min(2.0, 0.65 * factor));
      keyLight.intensity = Math.max(0.2, Math.min(3.0, 0.9 * factor));
      fillLight.intensity = Math.max(0.1, Math.min(2.0, 0.6 * factor));
      renderPreview();
    }
    
    // Helper function to force preview render (optimized - single render call)
    function renderPreview() {
      // Always render, even if no mesh (shows empty scene)
      try {
        if (viewerCanvas && viewerCanvas.clientWidth > 0 && viewerCanvas.clientHeight > 0) {
          renderer.render(scene, camera);
        } else {
          console.warn("[Preview] Canvas has zero dimensions, skipping render");
        }
      } catch (error) {
        console.error("[Preview] Render error:", error);
      }
    }

    // Update lighting when Kelvin selector changes (simplified)
    if (kelvinSelect) {
      kelvinSelect.addEventListener("change", () => {
        const kelvin = parseInt(kelvinSelect.value) || 5600;
        console.log(`[Preview] Kelvin selector changed to ${kelvin}K`);
        updatePreviewLighting(kelvin);
        // Also update if mesh is loaded
        if (meshGroup) {
          renderPreview();
        }
      });
      
      // Initialize with current value
      const initialKelvin = parseInt(kelvinSelect.value) || 5600;
      updatePreviewLighting(initialKelvin);
    }

    let meshGroup = null;
    const baseRotation = { x: 0, y: 0, z: 0 };
    const previewState = { active: false, startTime: null, duration: 4 };
    let currentDimensions = null;

    if (DEFAULT_QUALITY && ["fast", "standard", "ultra"].includes(DEFAULT_QUALITY)) {
      qualitySelect.value = DEFAULT_QUALITY;
    }

    function disposeObject(object) {
      object.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose?.());
          } else {
            child.material?.dispose?.();
          }
        }
      });
    }

    function formatEta(seconds) {
      if (typeof seconds !== "number" || !isFinite(seconds) || seconds <= 0) {
        return "";
      }
      const minutes = Math.floor(seconds / 60);
      const secs = Math.max(0, Math.round(seconds % 60));
      if (minutes > 0) {
        return `${minutes}m ${secs.toString().padStart(2, "0")}s`;
      }
      return `${secs}s`;
    }

    function showProgressView() {
      uploadSection.classList.add("hidden");
      progressSection.classList.remove("hidden");
      uploadStatus.textContent = "";
      progressBar.style.width = "0%";
      statusLabel.textContent = "Preparing Blender…";
      if (cancelButton) cancelButton.classList.remove("hidden");
      if (downloadButton) downloadButton.classList.add("hidden");
      updateBadgeSummary();
    }

    function showUploadView(message) {
      progressSection.classList.add("hidden");
      uploadSection.classList.remove("hidden");
      if (message) {
        uploadStatus.textContent = message;
      } else {
        uploadStatus.textContent = "";
      }
      statusLabel.textContent = "";
      progressBar.style.width = "0%";
      submitButton.disabled = false;
      if (cancelButton) cancelButton.classList.add("hidden");
      if (downloadButton) downloadButton.classList.add("hidden");
      currentJobId = null;
      updateBadgeSummary();
    }

    function clearPreview() {
      if (meshGroup) {
        scene.remove(meshGroup);
        disposeObject(meshGroup);
        meshGroup = null;
      }
      resetViewButton.disabled = true;
      resetView();
      renderer.render(scene, camera);
      previewButton.disabled = true;
      previewState.active = false;
      previewState.startTime = null;
    }

    function createMaterial() {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xd8cfbc),
        roughness: 0.5,
        metalness: 0.05,
      });
    }

    function computeAutoOrientation(dimensions) {
      const dims = { ...dimensions };
      const maxXY = Math.max(dims.X, dims.Y);
      let axis;
      if (dims.Z >= maxXY * 1.2) {
        axis = "Z";
      } else {
        axis = ["X", "Y", "Z"].reduce((minAxis, candidate) => {
          return dims[candidate] < dims[minAxis] ? candidate : minAxis;
        }, "X");
      }

      let offset = 0;
      if (axis === "Z") {
        offset = dims.X >= dims.Y ? 0 : 90;
      } else if (axis === "Y") {
        offset = dims.X >= dims.Z ? 0 : 90;
      } else {
        offset = dims.Y >= dims.Z ? 0 : 90;
      }
      return { axis, offset };
    }

    function fitCameraToObject(object) {
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      
      // Calculate distance based on canvas aspect ratio to ensure model fits
      const canvas = viewerCanvas;
      if (canvas && canvas.clientWidth > 0 && canvas.clientHeight > 0) {
        const aspect = canvas.clientWidth / canvas.clientHeight;
        // Base distance calculation
        const baseDistance = maxDim * 1.8;
        
        // For wider canvases, we need more distance to fit the model
        // Use a factor that accounts for both width and height
        const widthFactor = Math.max(1, aspect);
        const heightFactor = Math.max(1, 1 / aspect);
        const distance = baseDistance * Math.max(widthFactor, heightFactor) * 1.2;
        
        controls.target.copy(center);
        camera.position.copy(center);
        camera.position.z += distance;
        camera.position.y -= distance * 0.25;
        camera.near = distance / 100;
        camera.far = distance * 100;
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
        controls.update();
        
        console.log("[Preview] Camera fitted - distance:", distance.toFixed(1), "aspect:", aspect.toFixed(2));
      } else {
        // Fallback to original calculation
        const distance = maxDim * 1.8;
        controls.target.copy(center);
        camera.position.copy(center);
        camera.position.z += distance;
        camera.position.y -= distance * 0.25;
        camera.near = distance / 100;
        camera.far = distance * 100;
        camera.updateProjectionMatrix();
        controls.update();
      }
    }

    function updateBaseRotationFromInputs() {
      const axis = axisSelect.value || "Z";
      const offsetDeg = parseFloat(offsetInput.value) || 0;
      baseRotation.x = axis === "X" ? THREE.MathUtils.degToRad(offsetDeg) : 0;
      baseRotation.y = axis === "Y" ? THREE.MathUtils.degToRad(offsetDeg) : 0;
      baseRotation.z = axis === "Z" ? THREE.MathUtils.degToRad(offsetDeg) : 0;
      applyBaseRotation();
    }

    function updateBadgeSummary() {
      const qualityOption = qualitySelect.options[qualitySelect.selectedIndex];
      const qualityLabel = qualityOption ? qualityOption.textContent.trim() : qualitySelect.value;
      const offsetValue = Number(offsetInput.value) || 0;
      if (summaryQuality) {
        summaryQuality.textContent = `Quality • ${qualityLabel}`;
      }
      if (summaryOrientation) {
        summaryOrientation.textContent = autoCheckbox.checked ? "Auto orientation" : "Manual orientation";
      }
      if (summaryAxis) {
        summaryAxis.textContent = `Spin ${axisSelect.value || "Z"} • ${offsetValue.toFixed(0)}°`;
      }
    }

    function applyBaseRotation() {
      if (meshGroup) {
        meshGroup.rotation.set(baseRotation.x, baseRotation.y, baseRotation.z);
      }
      updateBadgeSummary();
    }

    async function loadPreview(file) {
      if (!file) {
        clearPreview();
        viewerNote.textContent = "Select an STL to preview.";
        currentDimensions = null;
        return;
      }
      const ext = file.name.split(".").pop().toLowerCase();
      if (ext !== "stl") {
        clearPreview();
        viewerNote.textContent = "Only STL previews are supported.";
        return;
      }
      viewerNote.textContent = "Loading preview…";
      const arrayBuffer = await file.arrayBuffer();

      clearPreview();
      try {
        const loader = new STLLoader();
        const geometry = loader.parse(arrayBuffer);
        geometry.computeVertexNormals();
        const mesh = new THREE.Mesh(geometry, createMaterial());
        meshGroup = new THREE.Group();
        meshGroup.add(mesh);
      } catch (error) {
        console.warn("Preview failed:", error);
        clearPreview();
        viewerNote.textContent =
          "Preview unavailable for this file, but rendering in Blender will still work.";
        currentDimensions = null;
        return;
      }

      scene.add(meshGroup);
      console.log("[Preview] Mesh added to scene, meshGroup:", meshGroup);
      
      // Ensure canvas is properly sized and camera is updated
      resizeRenderer();
      
      // Apply current Kelvin setting when model loads
      if (kelvinSelect) {
        const kelvin = parseInt(kelvinSelect.value) || 5600;
        console.log("[Preview] Applying Kelvin:", kelvin + "K");
        updatePreviewLighting(kelvin);
      }
      
      const box = new THREE.Box3().setFromObject(meshGroup);
      const size = box.getSize(new THREE.Vector3());
      currentDimensions = { X: size.x, Y: size.y, Z: size.z };
      console.log("[Preview] Model dimensions:", currentDimensions);
      
      resetViewButton.disabled = false;
      resetView();
      previewButton.disabled = !meshGroup;
      
      if (autoCheckbox.checked && currentDimensions) {
        const suggestion = computeAutoOrientation(currentDimensions);
        axisSelect.value = suggestion.axis;
        offsetInput.value = suggestion.offset.toFixed(0);
        console.log("[Preview] Auto orientation:", suggestion);
      }
      
      updateBaseRotationFromInputs();
      updateBadgeSummary();
      viewerNote.textContent = "Orbit with your mouse to inspect orientation. Preview spin shows the turntable look.";
      
      // Apply lighting and brightness
      if (kelvinSelect) {
        updatePreviewLighting(parseInt(kelvinSelect.value) || 5600);
      }
      updatePreviewBrightness((!autoBrightnessCheckbox?.checked && exposureSlider) ? parseFloat(exposureSlider.value) || 0.0 : 0.0);
      
      // Force render multiple times to ensure it shows
      renderPreview();
      setTimeout(() => renderPreview(), 100);
      setTimeout(() => renderPreview(), 300);
      
      console.log("[Preview] Preview loaded! Canvas size:", viewerCanvas?.clientWidth, "x", viewerCanvas?.clientHeight);
      console.log("[Preview] MeshGroup children:", meshGroup.children.length);
    }

    function resizeRenderer() {
      const parent = renderer.domElement.parentElement;
      if (!parent) return;
      const width = parent.clientWidth;
      // Use canvas's actual height instead of fixed 260px
      const height = viewerCanvas?.clientHeight || parent.clientHeight - 40 || 480;
      if (width && height) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        
        // Refit camera if model is loaded to ensure it's not cut off
        if (meshGroup) {
          fitCameraToObject(meshGroup);
        }
      }
    }

    function animate(now) {
      requestAnimationFrame(animate);
      if (previewState.active && meshGroup) {
        if (previewState.startTime === null) previewState.startTime = now;
        const progress = Math.min((now - previewState.startTime) / 1000 / previewState.duration, 1);
        const extra = progress * Math.PI * 2;
        const axis = axisSelect.value || "Z";
        meshGroup.rotation.set(baseRotation.x, baseRotation.y, baseRotation.z);
        meshGroup.rotation[axis.toLowerCase()] += extra;
        if (progress >= 1) {
          previewState.active = false;
          previewState.startTime = null;
          applyBaseRotation();
        }
      }
      controls.update();
      
      // Always render, even if no mesh (shows empty scene with lights)
      if (viewerCanvas) {
        const width = viewerCanvas.clientWidth;
        const height = viewerCanvas.clientHeight;
        if (width > 0 && height > 0) {
          // Update renderer size if canvas changed
          if (renderer.domElement.width !== width || renderer.domElement.height !== height) {
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
          }
          renderer.render(scene, camera);
        }
      }
    }
    requestAnimationFrame(animate);
    console.log("[Preview] Animation loop started");
    console.log("[Preview] Animation loop started");

    window.addEventListener("resize", resizeRenderer);
    resizeRenderer();

    function applyAutoState() {
      const autoOn = autoCheckbox.checked;
      axisSelect.disabled = autoOn;
      offsetInput.disabled = autoOn;
      if (autoOn && currentDimensions) {
        const suggestion = computeAutoOrientation(currentDimensions);
        axisSelect.value = suggestion.axis;
        offsetInput.value = suggestion.offset.toFixed(0);
      }
      updateBaseRotationFromInputs();
      updateBadgeSummary();
    }

    function resetView() {
      if (meshGroup) {
        fitCameraToObject(meshGroup);
        applyBaseRotation();
      } else {
        camera.position.copy(DEFAULT_CAMERA_POS);
        controls.target.copy(DEFAULT_CAMERA_TARGET);
        controls.update();
        updateBadgeSummary();
      }
    }

    fileInput.addEventListener("change", (e) => {
      try {
        const file = fileInput.files?.[0];
        if (file) {
          console.log("[Preview] File selected:", file.name);
          loadPreview(file);
        } else {
          console.log("[Preview] File deselected");
          clearPreview();
          viewerNote.textContent = "Select an STL to preview.";
        }
      } catch (error) {
        console.error("File input error:", error);
        uploadStatus.textContent = "Error loading file preview.";
        viewerNote.textContent = "Error loading preview. Please try selecting the file again.";
      }
    });
    
    // Load preview if file is already selected when page loads (with delay to ensure DOM is ready)
    setTimeout(() => {
      try {
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
          console.log("[Preview] Restoring preview for existing file:", fileInput.files[0].name);
          loadPreview(fileInput.files[0]);
        } else {
          console.log("[Preview] No file selected on page load");
          viewerNote.textContent = "Select an STL to preview.";
        }
      } catch (error) {
        console.warn("Initial file load failed:", error);
        viewerNote.textContent = "Select an STL to preview.";
      }
    }, 200);
    // Consolidated event listeners (optimized)
    axisSelect.addEventListener("change", () => {
      updateBaseRotationFromInputs();
      renderPreview();
    });
    offsetInput.addEventListener("input", () => {
      updateBaseRotationFromInputs();
      renderPreview();
    });
    qualitySelect.addEventListener("change", updateBadgeSummary);
    autoCheckbox.addEventListener("change", () => {
      applyAutoState();
    });
    
    // Brightness controls (optimized and consolidated)
    if (autoBrightnessCheckbox) {
      const brightnessModeLabel = document.getElementById("brightness-mode-label");
      const brightnessHint = document.getElementById("brightness-hint");
      const exposureField = document.getElementById("exposure-field");
      
      const updateBrightnessMode = () => {
        const autoOn = autoBrightnessCheckbox.checked;
        
        // Update slider state
        if (exposureSlider) {
          exposureSlider.disabled = autoOn;
          exposureSlider.style.opacity = autoOn ? "0.5" : "1";
          exposureSlider.style.cursor = autoOn ? "not-allowed" : "pointer";
        }
        
        // Update field opacity for visual feedback
        if (exposureField) {
          exposureField.style.opacity = autoOn ? "0.4" : "1";
          exposureField.style.pointerEvents = autoOn ? "none" : "auto";
        }
        
        // Update labels with clear explanations
        if (brightnessModeLabel) {
          brightnessModeLabel.textContent = autoOn 
            ? "Automatically adjusts for best results (recommended)" 
            : "Manual mode enabled - use slider below to adjust";
        }
        
        if (brightnessHint) {
          brightnessHint.textContent = autoOn 
            ? "Turn off Auto Brightness above to use manual adjustment" 
            : "Drag the slider left (darker) or right (brighter). Preview updates instantly!";
        }
        
        // Update preview
        if (meshGroup) {
          updatePreviewBrightness(autoOn ? 0.0 : (parseFloat(exposureSlider?.value) || 0.0));
        }
      };
      
      autoBrightnessCheckbox.addEventListener("change", updateBrightnessMode);
      
      // Set initial state
      updateBrightnessMode();
    }
    
    if (exposureSlider && exposureValue) {
      const brightnessIndicator = document.getElementById("brightness-indicator");
      const updateBrightnessMeter = (exposure) => {
        if (brightnessIndicator) {
          const percent = ((exposure + 2) / 4) * 100;
          brightnessIndicator.style.left = `${Math.max(0, Math.min(100, percent))}%`;
        }
        if (exposureValue) {
          exposureValue.textContent = exposure.toFixed(1);
          // Add visual feedback with color
          const absExposure = Math.abs(exposure);
          if (absExposure > 1.5) {
            exposureValue.style.color = "var(--accent)";
          } else if (absExposure > 0.5) {
            exposureValue.style.color = "var(--ink)";
          } else {
            exposureValue.style.color = "var(--muted)";
          }
        }
      };
      updateBrightnessMeter(0);
      ["input", "change"].forEach(evt => exposureSlider.addEventListener(evt, () => {
        if (!exposureSlider.disabled) {
          const exposure = parseFloat(exposureSlider.value);
          updateBrightnessMeter(exposure);
          updatePreviewBrightness(exposure);
        }
      }));
    }
    
    previewButton.addEventListener("click", () => {
      if (!meshGroup || previewState.active) return;
      updateBaseRotationFromInputs();
      previewState.active = true;
      previewState.startTime = null;
    });
    resetViewButton.addEventListener("click", () => {
      if (!resetViewButton.disabled) {
        resetView();
      }
    });

    let pollTimer = null;
    let currentJobId = null;

    async function pollStatus() {
      if (!currentJobId) return;
      try {
        const resp = await fetch(`/status/${currentJobId}`);
        if (!resp.ok) {
          throw new Error("Failed to get status");
        }
        const data = await resp.json();
        if (data.message) {
          statusLabel.textContent = data.message;
        }
        if (typeof data.progress === "number") {
          const progressPercent = Math.max(0, Math.min(100, data.progress));
          progressBar.style.width = `${progressPercent}%`;
          
          // Show percentage instead of ETA
          if (totalEta && data.state === "running") {
            totalEta.textContent = `${Math.round(progressPercent)}% complete`;
            totalEta.style.display = "inline-block";
          } else if (totalEta) {
            totalEta.style.display = "none";
          }
        } else if (totalEta) {
          totalEta.style.display = "none";
        }
        if (data.state === "finished") {
          clearInterval(pollTimer);
          pollTimer = null;
          submitButton.disabled = false;
          if (cancelButton) cancelButton.classList.add("hidden");
          
      // Simplified: Always allow downloads (dev mode)
      if (downloadButton) {
        downloadButton.classList.remove("hidden");
        statusLabel.textContent = "Render complete! Click Download to save your video.";
        downloadButton.onclick = async () => {
          // Prevent multiple simultaneous downloads
          if (downloadButton.disabled) return;
          
          try {
            statusLabel.textContent = "Preparing download...";
            downloadButton.disabled = true;
            
            const response = await fetch(`/download/${currentJobId}`);
            const contentType = response.headers.get('Content-Type') || '';
            
            if (response.ok && (contentType.startsWith('video/') || contentType.startsWith('application/'))) {
              // It's a file - download it
              const blob = await response.blob();
              
              // Extract filename from Content-Disposition header
              const contentDisposition = response.headers.get('Content-Disposition');
              let filename = 'render.mp4';
              if (contentDisposition) {
                // Try different patterns for filename extraction
                const patterns = [
                  /filename\*?=['"]?([^'";\n]+)['"]?/i,
                  /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i,
                  /filename=([^;\n]+)/i
                ];
                
                for (const pattern of patterns) {
                  const match = contentDisposition.match(pattern);
                  if (match && match[1]) {
                    filename = match[1].replace(/['"]/g, '').trim();
                    // Handle URL-encoded filenames
                    try {
                      filename = decodeURIComponent(filename);
                    } catch (e) {
                      // If decoding fails, use as-is
                    }
                    break;
                  }
                }
              }
              
              // Create download link
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = filename;
              a.style.display = 'none';
              document.body.appendChild(a);
              
              // Trigger download
              a.click();
              
              statusLabel.textContent = `Downloading ${filename}...`;
              
              // Clean up after download starts
              setTimeout(() => {
                if (a.parentNode) {
                  document.body.removeChild(a);
                }
                window.URL.revokeObjectURL(url);
                downloadButton.disabled = false;
                statusLabel.textContent = `Downloaded ${filename}`;
              }, 2000);
            } else {
              // Handle error response
              const text = await response.text();
              downloadButton.disabled = false;
              
              try {
                const errorData = JSON.parse(text);
                let errorMsg = errorData.message || "Download failed";
                if (errorData.upgrade_url) {
                  errorMsg += ` <a href="${errorData.upgrade_url}" target="_blank" style="color: var(--accent); text-decoration: underline;">Upgrade to Pro</a>`;
                }
                statusLabel.innerHTML = errorMsg;
                showUploadView(errorMsg);
              } catch {
                // It's HTML, show generic message
                statusLabel.textContent = "Download failed. Please check your account permissions.";
                showUploadView("Download failed. Please check your account permissions.");
              }
            }
          } catch (error) {
            console.error("Download error:", error);
            downloadButton.disabled = false;
            statusLabel.textContent = `Download failed: ${error.message}`;
            showUploadView(`Download failed: ${error.message}`);
          }
        };
      }
        } else if (data.state === "cancelled") {
          clearInterval(pollTimer);
          pollTimer = null;
          showUploadView("Render cancelled.");
          statusLabel.textContent = "Render cancelled.";
        } else if (data.state === "error") {
          clearInterval(pollTimer);
          pollTimer = null;
          const errorMsg = data.message || "Rendering failed.";
          let userFriendlyMsg = errorMsg;
          if (errorMsg.includes("Blender") && errorMsg.includes("not found")) {
            userFriendlyMsg = "Blender is not installed or not found. Please install Blender and ensure it's in your PATH, or set the BLENDER_BIN environment variable.";
          } else if (errorMsg.includes("FFmpeg") || errorMsg.includes("ffmpeg")) {
            userFriendlyMsg = "Video processing failed. Please ensure FFmpeg is installed and available in your PATH.";
          } else if (errorMsg.includes("file") && errorMsg.includes("large")) {
            userFriendlyMsg = "File is too large. Maximum size is 512 MB. Please use a smaller STL file.";
          } else if (errorMsg.includes("STL") || errorMsg.includes("stl")) {
            // Extract the actual error message from Blender if available
            const errorMatch = data.message.match(/(Invalid STL|Failed to parse|No mesh|STL.*error|ValueError|RuntimeError)[^\n]*/i);
            if (errorMatch) {
              userFriendlyMsg = errorMatch[0] + ". Please check that your file is a valid STL format and try again.";
            } else {
              userFriendlyMsg = data.message || "Invalid STL file. Please check that your file is a valid STL format and try again.";
            }
          }
          showUploadView(userFriendlyMsg);
          statusLabel.textContent = userFriendlyMsg;
        }
      } catch (error) {
        clearInterval(pollTimer);
        pollTimer = null;
        showUploadView("Connection lost while polling progress.");
        statusLabel.textContent = "Connection lost while polling progress.";
      }
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      statusLabel.textContent = "Uploading…";
      submitButton.disabled = true;
      progressBar.style.width = "0%";

      const formData = new FormData(form);
      formData.set("axis", axisSelect.value);
      formData.set("offset", offsetInput.value);
      formData.set("auto_orientation", autoCheckbox.checked ? "1" : "0");
      formData.set("quality", qualitySelect.value);
      const formatSelect = document.getElementById("format");
      const resolutionSelect = document.getElementById("resolution");
      if (formatSelect) formData.set("format", formatSelect.value);
      if (resolutionSelect) formData.set("resolution", resolutionSelect.value);

      try {
        const resp = await fetch("/render", {
          method: "POST",
          body: formData,
        });
        const payload = await resp.json();
        if (!resp.ok) {
          throw new Error(payload.message || "Upload failed.");
        }
        currentJobId = payload.job_id;
        showProgressView();
        statusLabel.textContent = "Rendering in Blender…";
        if (cancelButton) {
          cancelButton.classList.remove("hidden");
          cancelButton.onclick = async () => {
            if (!currentJobId) return;
            try {
              const resp = await fetch(`/cancel/${currentJobId}`, { method: "POST" });
              if (resp.ok) {
                clearInterval(pollTimer);
                pollTimer = null;
                showUploadView("Render cancelled.");
                statusLabel.textContent = "Render cancelled.";
                currentJobId = null;
              }
            } catch (error) {
              console.error("Failed to cancel:", error);
            }
          };
        }
        if (downloadButton) downloadButton.classList.add("hidden");
        pollTimer = setInterval(pollStatus, 1500);
      } catch (error) {
        showUploadView(error.message || "Upload failed.");
        statusLabel.textContent = error.message || "Upload failed.";
      }
    });

    autoCheckbox.checked = true;
    applyAutoState();
    // Status message comes from server template
    const initialStatus = statusLabel.textContent || "Ready when you are.";
    showUploadView(initialStatus);
    viewerNote.textContent = "Select an STL to preview.";