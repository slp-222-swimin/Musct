export class SelectionLayer {
  constructor(virtualCanvas) {
    this.vc = virtualCanvas;
    this.colors = null;
  }

  draw(ctx, startSec, endSec) {
    if (!this.vc.tempoSystem) return;

    if (!this.colors) {
        const style = getComputedStyle(document.body);
        this.colors = {
            bg: style.getPropertyValue('--selection-bg').trim() || 'rgba(0, 255, 204, 0.2)',
            border: style.getPropertyValue('--selection-border').trim() || 'rgba(0, 255, 204, 0.6)'
        };
    }

    const { startBeat, endBeat } = this.vc.selection;
    if (startBeat === endBeat) return;

    const selStartSec = this.vc.tempoSystem.getSecondsFromBeat(startBeat);
    const selEndSec = Math.max(selStartSec, this.vc.tempoSystem.getSecondsFromBeat(endBeat));

    if (selEndSec < startSec || selStartSec > endSec) return;

    const xStart = this.vc.secToPixelLocal(selStartSec);
    const xEnd = this.vc.secToPixelLocal(selEndSec);
    const w = xEnd - xStart;

    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(xStart, 0, w, this.vc.height);

    ctx.strokeStyle = this.colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xStart, 0); ctx.lineTo(xStart, this.vc.height);
    ctx.moveTo(xEnd, 0); ctx.lineTo(xEnd, this.vc.height);
    ctx.stroke();
  }
}
