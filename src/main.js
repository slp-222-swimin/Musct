import { AudioEngine } from './audio/AudioEngine.js';
import { TempoSystem } from './audio/TempoSystem.js';
import { VirtualCanvas } from './engine/VirtualCanvas.js';
import { WavEncoder } from './utils/WavEncoder.js';
import { HistoryManager } from './utils/HistoryManager.js';

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('audio-input');
  const fileNameDisplay = document.getElementById('file-name');
  const btnPlay = document.getElementById('btn-play');
  const btnStop = document.getElementById('btn-stop');
  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');
  const statusMsg = document.getElementById('export-status');
  
  const canvasEl = document.getElementById('waveform-canvas');
  const zoomSlider = document.getElementById('zoom-slider');
  const inOffset = document.getElementById('input-offset');

  const tempoEventList = document.getElementById('tempo-event-list');
  const btnAddEvent = document.getElementById('btn-add-event');
  const btnAddDelete = document.getElementById('btn-add-delete');

  const contextMenu = document.getElementById('context-menu');
  const ctxAddTempo = document.getElementById('ctx-add-tempo');
  const ctxAddDelete = document.getElementById('ctx-add-delete');
  const ctxClose = document.getElementById('ctx-close');

  const audioEngine = new AudioEngine();
  const tempoSystem = new TempoSystem();
  const virtualCanvas = new VirtualCanvas(canvasEl);
  const history = new HistoryManager(30);
  
  virtualCanvas.setDependencies(tempoSystem, audioEngine);

  // App State
  let isLoaded = false;
  let isDraggingCanvas = false;
  let isDraggingOffset = false;
  let dragDeleteEvent = null; // { idx: number, edge: 'start' | 'end' }
  let lastMouseX = 0;
  let contextBeat = 0; // Beat stored when right-clicking
  let hasDraggedState = false; // Flag for drag commits

  // Initialize
  history.setInitialState(tempoSystem.getState()); 
  renderTempoEvents();
  virtualCanvas.startRenderLoop();

  // --- History Management ---
  function commitState() {
    history.pushState(tempoSystem.getState());
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    btnUndo.disabled = !history.canUndo();
    btnRedo.disabled = !history.canRedo();
  }

  function performUndo() {
    if (!history.canUndo()) return;
    const previousState = history.undo();
    tempoSystem.loadState(previousState);
    inOffset.value = (-tempoSystem.offsetSec).toFixed(3);
    updateHistoryButtons();
    renderTempoEvents();
    virtualCanvas.draw();
  }

  function performRedo() {
    if (!history.canRedo()) return;
    const nextState = history.redo();
    tempoSystem.loadState(nextState);
    inOffset.value = (-tempoSystem.offsetSec).toFixed(3);
    updateHistoryButtons();
    renderTempoEvents();
    virtualCanvas.draw();
  }

  btnUndo.addEventListener('click', performUndo);
  btnRedo.addEventListener('click', performRedo);

  // --- Helpers ---
  function getValidIntervals(startFromSec, endAtSec = -1) {
    if (!isLoaded || !audioEngine.buffer) return [];
    const totalDuration = audioEngine.buffer.duration;
    const finalEndSec = endAtSec === -1 ? totalDuration : Math.min(endAtSec, totalDuration);
    const deleteKeys = tempoSystem.events.filter(e => e.type === 'delete').map(e => ({
        s: tempoSystem.getSecondsFromBeat(e.beat),
        e: tempoSystem.getSecondsFromBeat(e.endBeat)
    })).filter(d => d.e > d.s).sort((a, b) => a.s - b.s);
    const intervals = [];
    let currentPos = startFromSec;
    for (const d of deleteKeys) {
        if (d.e <= currentPos) continue;
        if (d.s >= finalEndSec) break;
        if (d.s > currentPos) { intervals.push({ startSec: currentPos, durationSec: d.s - currentPos }); }
        currentPos = Math.max(currentPos, d.e);
    }
    if (currentPos < finalEndSec) { intervals.push({ startSec: currentPos, durationSec: finalEndSec - currentPos }); }
    return intervals;
  }

  // --- History Management ---
  function commitState() {
    history.pushState(tempoSystem.getState());
    updateHistoryButtons();
  }

  function updateHistoryButtons() {
    btnUndo.disabled = !history.canUndo();
    btnRedo.disabled = !history.canRedo();
  }

  function performUndo() {
    if (!history.canUndo()) return;
    const previousState = history.undo(tempoSystem.getState());
    tempoSystem.loadState(previousState);
    inOffset.value = (-tempoSystem.offsetSec).toFixed(3);
    updateHistoryButtons();
    renderTempoEvents();
    virtualCanvas.draw();
  }

  function performRedo() {
    if (!history.canRedo()) return;
    const nextState = history.redo(tempoSystem.getState());
    tempoSystem.loadState(nextState);
    inOffset.value = (-tempoSystem.offsetSec).toFixed(3);
    updateHistoryButtons();
    renderTempoEvents();
    virtualCanvas.draw();
  }

  btnUndo.addEventListener('click', performUndo);
  btnRedo.addEventListener('click', performRedo);

  /**
   * Adjust zoom around the playhead (anchor)
   */
  function setZoomAnchored(newPxPerSec) {
    const playheadSec = audioEngine.getCurrentTime();
    // Position of playhead on screen before zoom change
    const playheadX = virtualCanvas.secToPixelLocal(playheadSec);
    
    // Perform zoom
    virtualCanvas.pxPerSec = newPxPerSec;
    
    // Recalculate scroll to keep playhead at the same screen position
    const newPlayheadX = playheadSec * newPxPerSec;
    virtualCanvas.setScroll(newPlayheadX - playheadX);
    virtualCanvas.draw();
  }

  // --- Tempo Event UI & Export ---
  function renderTempoEvents() {
    tempoEventList.innerHTML = '';
    let totalBeats = 0;
    if (isLoaded && audioEngine.buffer) { totalBeats = tempoSystem.getBeatFromSeconds(audioEngine.buffer.duration); }
    tempoSystem.events.forEach((ev, index) => {
        const item = document.createElement('div');
        item.className = 'event-item';
        if (ev.type === 'delete') {
            const startMB = tempoSystem.beatToMB(ev.beat);
            const endMB = tempoSystem.beatToMB(ev.endBeat);
            item.style.borderColor = 'rgba(255, 77, 77, 0.4)';
            item.innerHTML = `
                <div class="event-header" style="color: var(--danger)">
                    <span>DELETE RANGE</span>
                    <button class="btn-remove" data-index="${index}">REMOVE</button>
                </div>
                <div class="event-fields mb-fields" style="display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                        <span style="font-size:0.7em; grid-column: span 2;">Start (M, Beat)</span>
                        <input type="number" value="${startMB.m}" class="ev-m-start" data-index="${index}" />
                        <input type="number" step="0.25" value="${startMB.b}" class="ev-b-start" data-index="${index}" />
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                        <span style="font-size:0.7em; grid-column: span 2;">End (M, Beat)</span>
                        <input type="number" value="${endMB.m}" class="ev-m-end" data-index="${index}" />
                        <input type="number" step="0.25" value="${endMB.b}" class="ev-b-end" data-index="${index}" />
                    </div>
                </div>`;
        } else {
            const isBase = index === 0;
            let nextTempoEv = null;
            for (let j = index + 1; j < tempoSystem.events.length; j++) {
                if (tempoSystem.events[j].type === 'tempo') { nextTempoEv = tempoSystem.events[j]; break; }
            }
            const endBeat = nextTempoEv ? nextTempoEv.beat : totalBeats;
            const duration = Math.max(0, endBeat - ev.beat);
            item.innerHTML = `
                <div class="event-header">
                    <span>${isBase ? 'BASE' : `TEMPO BEAT: ${ev.beat}`}</span>
                    ${!isBase ? `<button class="btn-remove" data-index="${index}">REMOVE</button>` : ''}
                </div>
                <div class="event-fields">
                    <div class="field">${isBase ? '' : `<input type="number" step="0.25" value="${ev.beat}" class="ev-beat" data-index="${index}" />`}</div>
                    <input type="number" step="0.01" value="${ev.bpm}" class="ev-bpm" data-index="${index}" />
                    <div class="signature-input">
                        <input type="number" value="${ev.signature_n}" class="ev-sig-n" data-index="${index}" />
                        <span>/</span>
                        <input type="number" value="${ev.signature_d}" class="ev-sig-d" data-index="${index}" />
                    </div>
                </div>
                <div class="event-footer">
                    <span class="event-duration">Dur: ${duration.toFixed(3)} beats</span>
                    <button class="btn-ev-export" data-index="${index}" ${!isLoaded ? 'disabled' : ''}>Export Segment</button>
                </div>`;
        }
        tempoEventList.appendChild(item);
    });
    tempoEventList.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            const item = tempoSystem.events[idx];
            if (item.type === 'delete') {
                const mStart = parseInt(tempoEventList.querySelector(`.ev-m-start[data-index="${idx}"]`).value) || 1;
                const bStart = parseFloat(tempoEventList.querySelector(`.ev-b-start[data-index="${idx}"]`).value) || 0;
                const mEnd = parseInt(tempoEventList.querySelector(`.ev-m-end[data-index="${idx}"]`).value) || 1;
                const bEnd = parseFloat(tempoEventList.querySelector(`.ev-b-end[data-index="${idx}"]`).value) || 0;
                item.beat = tempoSystem.mbToBeat(mStart, bStart);
                item.endBeat = tempoSystem.mbToBeat(mEnd, bEnd);
            } else {
                if (e.target.classList.contains('ev-beat')) item.beat = parseFloat(e.target.value) || 0;
                if (e.target.classList.contains('ev-bpm')) item.bpm = parseFloat(e.target.value) || 120;
                if (e.target.classList.contains('ev-sig-n')) item.signature_n = parseInt(e.target.value) || 4;
                if (e.target.classList.contains('ev-sig-d')) item.signature_d = parseInt(e.target.value) || 4;
            }
            tempoSystem.calculateEventTimes(); renderTempoEvents(); virtualCanvas.draw();
            commitState();
        });
    });
    tempoEventList.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            tempoSystem.removeEvent(parseInt(e.target.dataset.index));
            renderTempoEvents(); virtualCanvas.draw();
            commitState();
        });
    });
    tempoEventList.querySelectorAll('.btn-ev-export').forEach(btn => {
        btn.addEventListener('click', (e) => { exportSegment(parseInt(e.target.dataset.index)); });
    });
  }

  async function exportSegment(index) {
    if (!isLoaded || !audioEngine.buffer) return;
    const ev = tempoSystem.events[index];
    if (ev.type !== 'tempo') return;
    let nextEv = null;
    for (let j = index + 1; j < tempoSystem.events.length; j++) {
        if (tempoSystem.events[j].type === 'tempo') { nextEv = tempoSystem.events[j]; break; }
    }
    
    // For the very first Base segment, we want to start from the beginning of the audio file (0.0s), 
    // so any intro before the Base Beat is included in the exported audio.
    let startSec = tempoSystem.getSecondsFromBeat(ev.beat);
    if (index === 0) {
        startSec = Math.min(0, startSec);
    }

    const endSec = nextEv ? tempoSystem.getSecondsFromBeat(nextEv.beat) : audioEngine.buffer.duration;
    const validIntervals = getValidIntervals(startSec, endSec);
    let totalValidDurationSec = validIntervals.reduce((sum, int) => sum + int.durationSec, 0);
    if (totalValidDurationSec <= 0) return;
    statusMsg.textContent = `Exporting Segment...`;
    try {
        const buffer = audioEngine.buffer;
        const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
            buffer.numberOfChannels, Math.ceil(buffer.sampleRate * totalValidDurationSec), buffer.sampleRate
        );
        let scheduleTime = 0;
        for (const interval of validIntervals) {
            let offsetInFile = interval.startSec;
            let playDuration = interval.durationSec;
            
            // If the start is before the audio file (negative), pad with silence
            if (offsetInFile < 0) {
                const silence = Math.abs(offsetInFile);
                scheduleTime += silence;
                offsetInFile = 0;
                playDuration -= silence;
            }

            if (playDuration > 0) {
                const source = offlineCtx.createBufferSource();
                source.buffer = buffer; 
                source.connect(offlineCtx.destination);
                source.start(scheduleTime, offsetInFile, playDuration);
                scheduleTime += playDuration;
            }
        }
        const renderedBuffer = await offlineCtx.startRendering();
        const blob = WavEncoder.encode(renderedBuffer);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `musct_seg_bpm${ev.bpm}_beat${ev.beat}.wav`; a.click();
        URL.revokeObjectURL(url);
        statusMsg.textContent = "Export complete!"; setTimeout(() => statusMsg.textContent = "", 3000);
    } catch (err) { statusMsg.textContent = "Export failed."; }
  }

  // --- Interaction (Context Menu) ---
  function closeContextMenu() { contextMenu.style.display = 'none'; }
  canvasEl.addEventListener('contextmenu', (e) => {
    e.preventDefault(); contextBeat = getClickedBeat(e.clientX);
    contextMenu.style.display = 'block'; contextMenu.style.left = `${e.clientX}px`; contextMenu.style.top = `${e.clientY}px`;
  });
  document.addEventListener('mousedown', (e) => { if (!contextMenu.contains(e.target)) closeContextMenu(); });
  ctxAddTempo.addEventListener('click', () => {
    const active = tempoSystem.getActiveEventAtBeat(contextBeat);
    tempoSystem.addTempoEvent(contextBeat, active.bpm, active.signature_n, active.signature_d);
    renderTempoEvents(); virtualCanvas.draw(); closeContextMenu();
    commitState();
  });
  ctxAddDelete.addEventListener('click', () => {
    const sig = tempoSystem.getSignatureAt(contextBeat);
    const measureLen = sig.signature_n * (4 / sig.signature_d);
    tempoSystem.addDeleteEvent(contextBeat, contextBeat + measureLen);
    renderTempoEvents(); virtualCanvas.draw(); closeContextMenu();
    commitState();
  });
  ctxClose.addEventListener('click', closeContextMenu);

  // --- Interaction (Dragging & Scrolling) ---
  function getClickedBeat(mouseX) {
    const rect = canvasEl.getBoundingClientRect();
    const scroll = virtualCanvas.scrollLeftPx;
    const pxPerSec = virtualCanvas.pxPerSec;
    const sec = (mouseX - rect.left + scroll) / pxPerSec;
    return tempoSystem.getBeatFromSeconds(sec);
  }
  function getMagnetBeat(mouseX) { return Math.round(getClickedBeat(mouseX)); }

  canvasEl.addEventListener('mousedown', (e) => {
    if (e.button === 2) return;
    const rect = canvasEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const tempoLayer = virtualCanvas.layers.find(l => l.drawOffsetMarker);
    if (tempoLayer && Math.abs(x - tempoLayer.hitX) < 15) {
        isDraggingOffset = true; lastMouseX = e.clientX; return;
    }
    const deletionLayer = virtualCanvas.layers.find(l => l.handles);
    if (deletionLayer) {
        const hitHandle = deletionLayer.handles.find(h => Math.abs(x - h.x) < 15);
        if (hitHandle) { dragDeleteEvent = hitHandle; return; }
    }
    isDraggingCanvas = true; lastMouseX = e.clientX;
  });

  window.addEventListener('mousemove', (e) => {
    const rect = canvasEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const tempoLayer = virtualCanvas.layers.find(l => l.drawOffsetMarker);
    const deletionLayer = virtualCanvas.layers.find(l => l.handles);
    if ((tempoLayer && Math.abs(x - tempoLayer.hitX) < 15) || 
        (deletionLayer && deletionLayer.handles.some(h => Math.abs(x - h.x) < 15))) {
        canvasEl.style.cursor = 'ew-resize';
    } else { canvasEl.style.cursor = 'crosshair'; }
    if (dragDeleteEvent) {
        const snappedBeat = getMagnetBeat(e.clientX);
        const event = tempoSystem.events[dragDeleteEvent.idx];
        if (dragDeleteEvent.edge === 'start') { event.beat = snappedBeat; } 
        else { event.endBeat = snappedBeat; }
        hasDraggedState = true;
        renderTempoEvents(); virtualCanvas.draw();
    } else if (isDraggingOffset) {
        const deltaX = e.clientX - lastMouseX; lastMouseX = e.clientX;
        const deltaSec = deltaX / virtualCanvas.pxPerSec;
        const newInternalSec = tempoSystem.offsetSec + deltaSec;
        tempoSystem.setOffset(newInternalSec);
        inOffset.value = (-newInternalSec).toFixed(3);
        hasDraggedState = true;
        renderTempoEvents(); virtualCanvas.draw();
    } else if (isDraggingCanvas) {
        const deltaX = lastMouseX - e.clientX; lastMouseX = e.clientX;
        virtualCanvas.setScroll(virtualCanvas.scrollLeftPx + deltaX);
    }
  });

  window.addEventListener('mouseup', () => { 
    isDraggingCanvas = false; 
    isDraggingOffset = false; 
    dragDeleteEvent = null; 
    if (hasDraggedState) {
        commitState();
        hasDraggedState = false;
    }
  });

  // --- Main Controls ---
  btnAddEvent.addEventListener('click', () => {
    let beat = tempoSystem.getNextKeyBeatSuggestion();
    const tempoEvents = tempoSystem.events.filter(e => e.type === 'tempo');
    const lastEvent = tempoEvents[tempoEvents.length - 1];
    tempoSystem.addTempoEvent(beat, lastEvent.bpm, lastEvent.signature_n, lastEvent.signature_d);
    renderTempoEvents(); virtualCanvas.draw();
    commitState();
  });
  btnAddDelete.addEventListener('click', () => {
    let beat = tempoSystem.getNextKeyBeatSuggestion();
    tempoSystem.addDeleteEvent(beat, beat + 4);
    renderTempoEvents(); virtualCanvas.draw();
    commitState();
  });
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      fileNameDisplay.textContent = file.name;
      try {
        const buffer = await audioEngine.loadFromFile(file);
        virtualCanvas.setAudio(buffer);
        isLoaded = true; btnPlay.disabled = false; btnStop.disabled = false;
        renderTempoEvents(); 
      } catch (err) { fileNameDisplay.textContent = "Error loading audio"; }
    }
  });
  btnPlay.addEventListener('click', () => {
    if (!isLoaded) return;
    if (audioEngine.isPlaying) { audioEngine.stop(); } 
    else {
      const startSec = virtualCanvas.scrollLeftPx / virtualCanvas.pxPerSec;
      const intervals = getValidIntervals(startSec);
      if (intervals.length > 0) { audioEngine.playSegments(intervals, startSec); }
    }
  });
  btnStop.addEventListener('click', () => audioEngine.stop());
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') { e.preventDefault(); btnPlay.click(); }
  });
  inOffset.addEventListener('input', () => {
    const uiVal = parseFloat(inOffset.value) || 0;
    tempoSystem.setOffset(-uiVal); renderTempoEvents(); virtualCanvas.draw();
  });
  inOffset.addEventListener('change', () => {
    commitState();
  });

  // --- Navigation (Zoom & Wheel Jump) ---
  zoomSlider.addEventListener('input', (e) => setZoomAnchored(parseFloat(e.target.value)));
  
  canvasEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.ctrlKey) {
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      let newZoom = virtualCanvas.pxPerSec * zoomFactor;
      newZoom = Math.max(10, Math.min(newZoom, 5000));
      zoomSlider.value = newZoom;
      setZoomAnchored(newZoom);
    } else {
      // Jump by 2 measures
      const currentScrollSec = virtualCanvas.scrollLeftPx / virtualCanvas.pxPerSec;
      const currentMB = tempoSystem.beatToMB(tempoSystem.getBeatFromSeconds(currentScrollSec));
      const direction = e.deltaY > 0 ? 1 : -1;
      
      // Calculate target measure (snap to measure boundary + offset)
      const targetM = Math.max(1, currentMB.m + (direction * 2));
      const targetBeat = tempoSystem.mbToBeat(targetM, 0);
      const targetSec = tempoSystem.getSecondsFromBeat(targetBeat);
      
      virtualCanvas.setScroll(targetSec * virtualCanvas.pxPerSec);
    }
  }, { passive: false });
});
