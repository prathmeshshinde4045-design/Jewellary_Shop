// // ...existing code...
// // Simple Try-On script: start/stop camera, overlay drag and scale, capture

// (() => {
//   const tryOnBtn = document.getElementById('tryOnBtn');
//   if (!tryOnBtn) return;

//   const modal = document.getElementById('tryOnModal');
//   const video = document.getElementById('tryonVideo');
//   const overlay = document.getElementById('tryonOverlay');
//   const startBtn = document.getElementById('tryonStart');
//   const stopBtn = document.getElementById('tryonStop');
//   const captureBtn = document.getElementById('tryonCapture');
//   const downloadLink = document.getElementById('tryonDownload');
//   const closeBtn = document.getElementById('tryOnClose');
//   const canvas = document.getElementById('tryonCanvas');

//   let stream = null;
//   let isDragging = false;
//   let startX = 0, startY = 0;
//   let offsetX = 0, offsetY = 0;
//   let scale = 1;

//   function openModal() {
//     const imgUrl = tryOnBtn.dataset.imageUrl;
//     overlay.src = imgUrl;
//     overlay.style.transform = 'translate(0px,0px) scale(1)';
//     offsetX = 0; offsetY = 0; scale = 1;
//     modal.style.display = 'flex';
//     modal.setAttribute('aria-hidden', 'false');
//   }
//   function closeModal() {
//     stopCamera();
//     modal.style.display = 'none';
//     modal.setAttribute('aria-hidden', 'true');
//     downloadLink.style.display = 'none';
//   }

//   function startCamera() {
//     if (stream) return;
//     navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
//       .then(s => {
//         stream = s;
//         video.srcObject = s;
//         video.play();
//       }).catch(err => {
//         alert('Camera access denied or not available: ' + err.message);
//       });
//   }

//   function stopCamera() {
//     if (!stream) return;
//     stream.getTracks().forEach(t => t.stop());
//     stream = null;
//     video.pause();
//     video.srcObject = null;
//   }

//   // Drag handlers
//   overlay.addEventListener('pointerdown', (e) => {
//     isDragging = true;
//     startX = e.clientX;
//     startY = e.clientY;
//     overlay.setPointerCapture(e.pointerId);
//   });
//   overlay.addEventListener('pointermove', (e) => {
//     if (!isDragging) return;
//     const dx = e.clientX - startX;
//     const dy = e.clientY - startY;
//     startX = e.clientX;
//     startY = e.clientY;
//     offsetX += dx;
//     offsetY += dy;
//     overlay.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
//   });
//   overlay.addEventListener('pointerup', (e) => {
//     isDragging = false;
//     try { overlay.releasePointerCapture(e.pointerId); } catch (ex) {}
//   });
//   overlay.addEventListener('pointercancel', () => isDragging = false);

//   // Wheel to resize overlay
//   overlay.addEventListener('wheel', (e) => {
//     e.preventDefault();
//     const delta = -e.deltaY;
//     const factor = delta > 0 ? 1.05 : 0.95;
//     scale = Math.max(0.1, Math.min(5, scale * factor));
//     overlay.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
//   });

//   captureBtn.addEventListener('click', () => {
//     if (!video.videoWidth) return alert('Start the camera first.');
//     canvas.width = video.videoWidth;
//     canvas.height = video.videoHeight;
//     const ctx = canvas.getContext('2d');
//     // draw video
//     ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
//     // compute overlay position on canvas
//     const videoRect = video.getBoundingClientRect();
//     const overlayRect = overlay.getBoundingClientRect();
//     const sx = (overlayRect.left - videoRect.left) / videoRect.width * canvas.width;
//     const sy = (overlayRect.top - videoRect.top) / videoRect.height * canvas.height;
//     const sWidth = overlayRect.width / videoRect.width * canvas.width;
//     const sHeight = overlayRect.height / videoRect.height * canvas.height;

//     // draw overlay respecting its current opacity and transform
//     const tempImg = new Image();
//     tempImg.crossOrigin = 'anonymous';
//     tempImg.onload = () => {
//       ctx.drawImage(tempImg, sx, sy, sWidth, sHeight);
//       const dataURL = canvas.toDataURL('image/png');
//       downloadLink.href = dataURL;
//       downloadLink.style.display = 'inline-block';
//       // open in new tab for quick preview
//       window.open(dataURL);
//     };
//     tempImg.src = overlay.src;
//   });

//   startBtn.addEventListener('click', startCamera);
//   stopBtn.addEventListener('click', stopCamera);
//   tryOnBtn.addEventListener('click', openModal);
//   closeBtn.addEventListener('click', closeModal);

//   // cleanup on escape
//   document.addEventListener('keydown', (e) => {
//     if (e.key === 'Escape' && modal.style.display !== 'none') closeModal();
//   });
// })();

(() => {
  const MODEL_PATH = '/static/models';
  let modelsLoaded = false;
  let stream = null;
  let rafId = null;

  async function loadModels() {
    if (modelsLoaded) return;
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_PATH);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_PATH);
      modelsLoaded = true;
      console.log('Face detection models loaded');
    } catch (err) {
      console.error('Error loading models:', err);
      throw err;
    }
  }

  async function runDetectionLoop(videoEl, overlayImg, position = 'face') {
    if (!stream || !videoEl || !overlayImg) return;

    async function detectFace() {
      if (!stream) return;
      
      try {
        const detection = await faceapi
          .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks();

        if (detection) {
          const landmarks = detection.landmarks;
          let centerPoint = { x: 0, y: 0 };
          let scale = 1;

          // Position based on feature type
          switch(position) {
            case 'ears':
              const leftEar = landmarks.getLeftEye()[0];
              const rightEar = landmarks.getRightEye()[3];
              centerPoint = {
                x: (leftEar.x + rightEar.x) / 2,
                y: (leftEar.y + rightEar.y) / 2
              };
              scale = Math.abs(rightEar.x - leftEar.x) * 1.2;
              break;

            case 'neck':
              const nose = landmarks.getNose()[0];
              const chin = landmarks.getJawOutline()[8];
              centerPoint = {
                x: nose.x,
                y: chin.y + (chin.y - nose.y) * 0.3
              };
              scale = Math.abs(landmarks.getJawOutline()[16].x - landmarks.getJawOutline()[0].x) * 1.5;
              break;

            default: // face
              const leftEye = landmarks.getLeftEye()[0];
              const rightEye = landmarks.getRightEye()[3];
              centerPoint = {
                x: (leftEye.x + rightEye.x) / 2,
                y: (leftEye.y + rightEye.y) / 2
              };
              scale = Math.abs(rightEye.x - leftEye.x) * 2;
          }

          // Map coordinates to video element size
          const rect = videoEl.getBoundingClientRect();
          const scaleX = rect.width / videoEl.videoWidth;
          const scaleY = rect.height / videoEl.videoHeight;

          // Position overlay
          const left = (centerPoint.x * scaleX) - (scale * scaleX / 2);
          const top = (centerPoint.y * scaleY) - (scale * scaleY / 2);
          
          overlayImg.style.width = `${Math.max(40, scale * scaleX)}px`;
          overlayImg.style.left = `${left}px`;
          overlayImg.style.top = `${top}px`;
          overlayImg.style.visibility = 'visible';

          // Rotate based on face angle
          const angle = Math.atan2(
            landmarks.getRightEye()[3].y - landmarks.getLeftEye()[0].y,
            landmarks.getRightEye()[3].x - landmarks.getLeftEye()[0].x
          ) * 180 / Math.PI;
          overlayImg.style.transform = `rotate(${angle}deg)`;
        } else {
          overlayImg.style.visibility = 'hidden';
        }
      } catch (err) {
        console.error('Detection error:', err);
      }

      rafId = requestAnimationFrame(() => detectFace());
    }

    detectFace();
  }

  function createModalElements(tryonImgSrc) {
    const modal = document.getElementById('tryOnModal');
    const videoEl = document.getElementById('tryonVideo');
    const overlayImg = document.getElementById('tryonOverlayImg');
    
    if (!modal || !videoEl || !overlayImg) {
      console.error('Required modal elements not found');
      return null;
    }

    overlayImg.src = tryonImgSrc;
    overlayImg.style.visibility = 'hidden';
    
    modal.style.display = 'block';
    $(modal).modal('show');
    
    return { videoEl, overlayImg };
  }

  async function startCamera(videoEl) {
      if (stream) {
          stopCamera();
      }

      try {
          stream = await navigator.mediaDevices.getUserMedia({
              video: { 
                  facingMode: 'user',
                  width: { ideal: 1280 },
                  height: { ideal: 720 }
              },
              audio: false
          });
          
          videoEl.srcObject = stream;
          
          // Wait for video to be ready
          return new Promise((resolve) => {
              videoEl.onloadedmetadata = async () => {
                  try {
                      await videoEl.play();
                      resolve(true);
                  } catch (err) {
                      console.error('Video play error:', err);
                      stopCamera();
                      resolve(false);
                  }
              };
          });
      } catch (err) {
          console.error('Camera access error:', err);
          return false;
      }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  async function initTryOn() {
    const tryOnBtn = document.getElementById('tryOnBtn');
    const modal = document.getElementById('tryOnModal');
    if (!tryOnBtn || !modal) return;

    const closeBtn = modal.querySelector('.close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        stopCamera();
        $(modal).modal('hide');
      });
    }

    tryOnBtn.addEventListener('click', async () => {
      const tryonImgSrc = tryOnBtn.dataset.tryonImg;
      const position = tryOnBtn.dataset.tryonPosition || 'face';
      
      if (!tryonImgSrc) {
        console.error('No tryon image specified');
        return;
      }

      try {
        await loadModels();
        const elements = createModalElements(tryonImgSrc);
        if (!elements) return;

        const success = await startCamera(elements.videoEl);
        if (success) {
          runDetectionLoop(elements.videoEl, elements.overlayImg, position);
        } else {
          alert('Could not access camera');
        }
      } catch (err) {
        console.error('Try-on initialization error:', err);
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTryOn);
  } else {
    initTryOn();
  }
})();