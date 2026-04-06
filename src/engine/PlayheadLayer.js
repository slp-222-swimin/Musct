export class PlayheadLayer {
  constructor(virtualCanvas) {
    this.vc = virtualCanvas;
    this.color = null;
  }

  draw(ctx, startSec, endSec) {
    if (!this.vc.audioEngine) return;

    if (!this.color) {
        this.color = getComputedStyle(document.body).getPropertyValue('--playhead').trim() || '#ff3366';
    }

    const currentTime = this.vc.audioEngine.getCurrentTime();

    if (currentTime >= startSec && currentTime <= endSec) {
        const x = this.vc.secToPixelLocal(currentTime);
        
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.vc.height);
        ctx.stroke();

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(x - 6, 0);
        ctx.lineTo(x + 6, 0);
        ctx.lineTo(x, 8);
        ctx.fill();
    }
  }
}
