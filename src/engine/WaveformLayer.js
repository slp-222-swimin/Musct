export class WaveformLayer {
  constructor(virtualCanvas) {
    this.vc = virtualCanvas;
    this.waveColor = null;
  }

  draw(ctx, startSec, endSec) {
    const buffer = this.vc.buffer;
    if (!buffer) return;

    if (!this.waveColor) {
        this.waveColor = getComputedStyle(document.body).getPropertyValue('--wave-color').trim() || '#3b82f6';
    }

    const channelData = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const pxPerSec = this.vc.pxPerSec;
    
    const cy = this.vc.height / 2;
    const amp = this.vc.height / 2;

    ctx.fillStyle = this.waveColor;
    
    const samplesPerPixel = sampleRate / pxPerSec;
    // Rounding samplesPerPixel can fluctuate as startSec moves.
    // Let's use a more stable LOD.
    const step = samplesPerPixel;

    ctx.fillStyle = this.waveColor;
    ctx.beginPath();

    for (let x = 0; x < this.vc.width; x++) {
        const pixelTime = startSec + (x / pxPerSec);
        const sIdx = Math.floor(pixelTime * sampleRate);
        
        if (sIdx >= channelData.length) break;
        
        // Find min/max for this pixel width
        let min = 1.0;
        let max = -1.0;
        
        // We use a fixed-size scan to prevent LOD jumping too much
        const lookAhead = Math.max(1, Math.ceil(step));
        for (let i = 0; i < lookAhead; i++) {
            const idx = sIdx + i;
            if (idx >= channelData.length) break;
            const val = channelData[idx];
            if (val < min) min = val;
            if (val > max) max = val;
        }
        
        const yPos = cy - (max * amp);
        const h = Math.max(1, (max - min) * amp);
        ctx.fillRect(x, yPos, 1, h);
    }
  }
}
