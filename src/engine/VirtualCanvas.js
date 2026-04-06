import { WaveformLayer } from './WaveformLayer.js';
import { GridLayer } from './GridLayer.js';
import { PlayheadLayer } from './PlayheadLayer.js';
import { TempoLayer } from './TempoLayer.js';
import { DeletionLayer } from './DeletionLayer.js';

export class VirtualCanvas {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    
    // Virtual Coordinate System
    this.pxPerSec = 100; // zoom
    this.scrollLeftPx = 0; // scroll
    
    // Resize handling
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    
    window.addEventListener('resize', () => this.handleResize());
    
    // Dependencies
    this.buffer = null;
    this.tempoSystem = null;
    this.audioEngine = null;
    
    this.selection = { startBeat: 0, endBeat: 4 };

    // Layers
    this.layers = [
        new WaveformLayer(this),
        new DeletionLayer(this),
        new GridLayer(this),
        new TempoLayer(this),
        new PlayheadLayer(this)
    ];
    
    this.isRendering = false;
  }

  handleResize() {
    this.width = this.canvas.parentElement.clientWidth;
    this.height = this.canvas.parentElement.clientHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.draw();
  }

  setAudio(buffer) {
    this.buffer = buffer;
    this.draw();
  }

  setDependencies(tempoSystem, audioEngine) {
    this.tempoSystem = tempoSystem;
    this.audioEngine = audioEngine;
  }

  setZoom(val) {
    this.pxPerSec = Math.max(10, val);
    this.draw();
  }

  setScroll(px) {
    this.scrollLeftPx = Math.max(0, px);
    this.draw();
  }

  setSelection(startBeat, endBeat) {
    this.selection.startBeat = startBeat;
    this.selection.endBeat = endBeat;
    this.draw();
  }

  pixelToSec(x) {
    return (this.scrollLeftPx + x) / this.pxPerSec;
  }

  secToPixelLocal(sec) {
    return (sec * this.pxPerSec) - this.scrollLeftPx;
  }

  // Animation Loop
  startRenderLoop() {
    if (this.isRendering) return;
    this.isRendering = true;
    const loop = () => {
      this.draw();
      if (this.isRendering) {
        requestAnimationFrame(loop);
      }
    };
    requestAnimationFrame(loop);
  }

  stopRenderLoop() {
    this.isRendering = false;
    this.draw(); // One last draw
  }

  draw() {
    // Auto-scroll during playback
    if (this.audioEngine && this.audioEngine.isPlaying) {
        const playheadSec = this.audioEngine.getCurrentTime();
        const playheadX = (playheadSec * this.pxPerSec) - this.scrollLeftPx;
        
        const rightMarginPx = 100;
        if (playheadX > this.width - rightMarginPx) {
            this.scrollLeftPx = Math.max(0, playheadSec * this.pxPerSec - (this.width - rightMarginPx));
        } else if (playheadX < 0) {
            this.scrollLeftPx = Math.max(0, playheadSec * this.pxPerSec - 100);
        }
    }

    // Clear
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    const startSec = this.scrollLeftPx / this.pxPerSec;
    const endSec = (this.scrollLeftPx + this.width) / this.pxPerSec;

    // Render layers
    for (const layer of this.layers) {
      this.ctx.save();
      layer.draw(this.ctx, startSec, endSec);
      this.ctx.restore();
    }
  }
}
