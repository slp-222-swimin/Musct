export class TempoLayer {
  constructor(virtualCanvas) {
    this.vc = virtualCanvas;
    this.color = null;
    this.offsetColor = '#ffcc00'; // Gold/Yellow for Offset
    
    // Hit test area for offset drag
    this.hitX = -1;
  }

  draw(ctx, startSec, endSec) {
    if (!this.vc.tempoSystem) return;

    if (!this.color) {
        this.color = getComputedStyle(document.body).getPropertyValue('--accent-color').trim() || '#00ffcc';
    }

    const { tempoSystem, height } = this.vc;

    for (let i = 0; i < tempoSystem.events.length; i++) {
        const event = tempoSystem.events[i];
        
        // Skip deletion markers in TempoLayer (they are handled by DeletionLayer)
        if (event.type === 'delete') continue;

        const isBase = i === 0;
        const sec = tempoSystem.getSecondsFromBeat(event.beat);
        if (sec < startSec - 1) continue;
        if (sec > endSec + 1) break;

        const x = this.vc.secToPixelLocal(sec);
        
        if (isBase) {
            this.hitX = x; // Update for hit test in main loop
            this.drawOffsetMarker(ctx, x, event);
        } else {
            this.drawTempoMarker(ctx, x, event);
        }
    }
  }

  drawOffsetMarker(ctx, x, event) {
    const { height } = this.vc;
    
    // Line
    ctx.strokeStyle = this.offsetColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    // Handle (Bottom)
    ctx.fillStyle = this.offsetColor;
    ctx.beginPath();
    ctx.moveTo(x - 10, height);
    ctx.lineTo(x + 10, height);
    ctx.lineTo(x, height - 15);
    ctx.fill();
    
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`OFFSET: ${(this.vc.tempoSystem.offsetSec).toFixed(3)}s`, x + 6, height - 25);
    ctx.fillText(`BPM: ${event.bpm}`, x + 6, height - 40);
  }

  drawTempoMarker(ctx, x, event) {
      const { height } = this.vc;
      ctx.strokeStyle = this.color;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = this.color;
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`BPM: ${event.bpm}`, x + 4, height - 20);
      ctx.fillText(`${event.signature_n}/${event.signature_d}`, x + 4, height - 8);
  }
}
