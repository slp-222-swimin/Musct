export class DeletionLayer {
  constructor(virtualCanvas) {
    this.vc = virtualCanvas;
    this.pattern = null;
    this.handles = []; // Store coordinates for hit-testing in main.js
  }

  createHatchPattern(ctx) {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 16;
    pCanvas.height = 16;
    const pCtx = pCanvas.getContext('2d');
    pCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    pCtx.fillRect(0, 0, 16, 16);
    pCtx.strokeStyle = 'rgba(255, 77, 77, 0.2)';
    pCtx.lineWidth = 2;
    pCtx.beginPath();
    pCtx.moveTo(0, 16); pCtx.lineTo(16, 0);
    pCtx.stroke();
    return ctx.createPattern(pCanvas, 'repeat');
  }

  draw(ctx, startSec, endSec) {
    if (!this.vc.tempoSystem) return;
    if (!this.pattern) this.pattern = this.createHatchPattern(ctx);

    const { tempoSystem, height } = this.vc;
    const deleteEvents = tempoSystem.events.filter(e => e.type === 'delete');
    this.handles = [];

    for (const event of deleteEvents) {
        const dStartSec = tempoSystem.getSecondsFromBeat(event.beat);
        const dEndSec = tempoSystem.getSecondsFromBeat(event.endBeat);

        const xStart = this.vc.secToPixelLocal(dStartSec);
        const xEnd = this.vc.secToPixelLocal(dEndSec);
        const w = xEnd - xStart;

        // Save handle positions for main.js (index refers to tempoSystem.events index)
        const realIdx = tempoSystem.events.indexOf(event);
        this.handles.push({ x: xStart, idx: realIdx, edge: 'start' });
        this.handles.push({ x: xEnd, idx: realIdx, edge: 'end' });

        if (dEndSec < startSec || dStartSec > endSec) continue;

        // Draw patterned overlay
        ctx.fillStyle = this.pattern;
        ctx.fillRect(xStart, 0, w, height);

        // Draw boundaries
        ctx.strokeStyle = 'rgba(255, 77, 77, 0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xStart, 0); ctx.lineTo(xStart, height);
        ctx.moveTo(xEnd, 0); ctx.lineTo(xEnd, height);
        ctx.stroke();

        // Draw Handles (Small rectangles at bottom)
        ctx.fillStyle = 'rgba(255, 77, 77, 1.0)';
        ctx.fillRect(xStart - 5, height - 20, 10, 20); // Start handle
        ctx.fillRect(xEnd - 5, height - 20, 10, 20);   // End handle
        
        // Label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('S', xStart, height - 8);
        ctx.fillText('E', xEnd, height - 8);
    }
  }
}
