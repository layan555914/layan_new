// Adds a "التقط بالكاميرا" button next to every photo/document upload field.
// On phones it opens the camera directly; captured photos are added to the same field,
// so the existing validation, preview and upload code keeps working unchanged.
(() => {
  "use strict";
  const enhance = input => {
    if (input.dataset.cameraReady || input.disabled) return;
    const accept = String(input.getAttribute("accept") || "");
    if (accept && !/image|jpe?g|png/i.test(accept)) return;
    input.dataset.cameraReady = "1";
    const wrap = document.createElement("div");
    wrap.className = "aa-upload-row";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const camera = document.createElement("input");
    camera.type = "file";
    camera.accept = "image/jpeg,image/*";
    camera.setAttribute("capture", "environment");
    camera.hidden = true;
    camera.dataset.cameraReady = "1";
    camera.tabIndex = -1;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "aa-camera-btn";
    button.innerHTML = '<span aria-hidden="true">📷</span> التقط بالكاميرا';
    button.setAttribute("aria-label", "التقاط صورة بالكاميرا وإضافتها");
    button.addEventListener("click", () => camera.click());
    camera.addEventListener("change", () => {
      const shot = camera.files && camera.files[0];
      if (!shot) return;
      try {
        const transfer = new DataTransfer();
        if (input.multiple) Array.from(input.files || []).forEach(file => transfer.items.add(file));
        // Name it .jpg so the existing JPG checks accept camera photos.
        const named = /\.jpe?g$/i.test(shot.name) ? shot : new File([shot], "camera-" + Date.now() + ".jpg", { type: shot.type || "image/jpeg" });
        transfer.items.add(named);
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new Event("input", { bubbles: true }));
      } catch (_) {
        input.click();
      }
      camera.value = "";
    });
    wrap.append(button, camera);
  };
  const scan = root => (root.querySelectorAll ? root.querySelectorAll('input[type="file"]') : []).forEach(enhance);
  const start = () => {
    scan(document);
    new MutationObserver(records => records.forEach(r => r.addedNodes.forEach(node => node.nodeType === 1 && scan(node)))).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
