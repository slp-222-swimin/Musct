export class GridLayer {
  constructor(virtualCanvas) {
    this.vc = virtualCanvas;
    this.colors = null;
  }

  draw(ctx, startSec, endSec) {
    if (!this.vc.tempoSystem) return;
    
    if (!this.colors) {
        const style = getComputedStyle(document.body);
        this.colors = {
            strong: style.getPropertyValue('--grid-line-strong').trim() || 'rgba(255, 255, 255, 0.3)',
            weak: style.getPropertyValue('--grid-line').trim() || 'rgba(255, 255, 255, 0.1)',
            text: style.getPropertyValue('--text-secondary').trim() || '#9aa0a6'
        };
    }

    const { tempoSystem, height } = this.vc;

    const startBeat = tempoSystem.getBeatFromSeconds(startSec);
    const endBeat = tempoSystem.getBeatFromSeconds(endSec);
    
    // 1. Draw Integer Beats (Sub-lines)
    const startDrawBeat = Math.floor(startBeat);
    const endDrawBeat = Math.ceil(endBeat);

    ctx.lineWidth = 1;
    for (let b = startDrawBeat; b <= endDrawBeat; b++) {
        const sec = tempoSystem.getSecondsFromBeat(b);
        const x = this.vc.secToPixelLocal(sec);
        if (x >= -1 && x <= this.vc.width + 1) {
            ctx.beginPath();
            ctx.moveTo(x, 0); ctx.lineTo(x, height);
            ctx.strokeStyle = this.colors.weak;
            ctx.stroke();
        }
    }

    // 2. Draw Measure Lines (Downbeats/M-Grids) precisely
    // We loop through signature sections and calculate measures
    const tsEvents = tempoSystem.events.filter(e => e.type === 'tempo');
    
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    for (let i = 0; i < tsEvents.length; i++) {
        const sig = tsEvents[i];
        const nextSig = tsEvents[i + 1];
        
        const sigStartBeat = sig.beat;
        const sigEndBeat = nextSig ? nextSig.beat : endBeat + 100; // Extend buffer
        
        // Skip if this signature section is entirely out of view
        if (sigEndBeat < startBeat) continue;
        if (sigStartBeat > endBeat) break;

        const sigN = sig.signature_n || 4;
        const sigD = sig.signature_d || 4;
        const measureLen = sigN * (4 / sigD);

        // Find the first measure in view for this section
        let currentMBeat = sigStartBeat;
        let measureCount = 1;

        // Efficiently skip measures before view
        if (sigStartBeat < startBeat) {
            const skipMeasures = Math.floor((startBeat - sigStartBeat) / measureLen);
            currentMBeat += skipMeasures * measureLen;
            measureCount += skipMeasures;
        }

        while (currentMBeat <= sigEndBeat && currentMBeat <= endBeat) {
            if (currentMBeat >= sigStartBeat) {
                const mSec = tempoSystem.getSecondsFromBeat(currentMBeat);
                const mx = this.vc.secToPixelLocal(mSec);

                if (mx >= -1 && mx <= this.vc.width + 1) {
                    ctx.beginPath();
                    ctx.moveTo(mx, 0); ctx.lineTo(mx, height);
                    ctx.strokeStyle = this.colors.strong;
                    ctx.stroke();

                    ctx.fillStyle = this.colors.text;
                    ctx.fillText(`M${measureCount}`, mx + 4, 4);
                }
            }
            currentMBeat += measureLen;
            measureCount++;
        }
    }
  }
}
