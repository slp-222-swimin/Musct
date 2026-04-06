export class TempoSystem {
  constructor() {
    this.offsetSec = 0; // Internal time (seconds) relative to 0s of audio
    this.events = [
      { type: 'tempo', beat: 0, bpm: 120, signature_n: 4, signature_d: 4, startTime: 0 }
    ];
    this.calculateEventTimes();
  }

  setOffset(sec) {
    this.offsetSec = sec;
    this.calculateEventTimes();
  }

  calculateEventTimes() {
    this.events.sort((a, b) => a.beat - b.beat);
    let currentTime = this.offsetSec;
    
    const tempoEvents = this.events.filter(e => e.type === 'tempo');
    
    if (tempoEvents.length > 0) {
      tempoEvents[0].startTime = currentTime;
      for (let i = 1; i < tempoEvents.length; i++) {
          const prevEv = tempoEvents[i - 1];
          const currentEv = tempoEvents[i];
          const beatsInInterval = currentEv.beat - prevEv.beat;
          currentTime += beatsInInterval * (60 / prevEv.bpm);
          currentEv.startTime = currentTime;
      }
    }
  }

  addTempoEvent(beat, bpm, sigN, sigD) {
    const existing = this.events.find(e => e.beat === beat && e.type === 'tempo');
    if (existing) {
      existing.bpm = bpm;
      existing.signature_n = sigN;
      existing.signature_d = sigD;
    } else {
      this.events.push({ type: 'tempo', beat, bpm, signature_n: sigN, signature_d: sigD });
    }
    this.calculateEventTimes();
  }

  addDeleteEvent(startBeat, endBeat) {
    this.events.push({ type: 'delete', beat: startBeat, endBeat: endBeat });
    this.calculateEventTimes();
  }

  removeEvent(index) {
    if (index === 0) return;
    this.events.splice(index, 1);
    this.calculateEventTimes();
  }

  getNextKeyBeatSuggestion() {
    if (this.events.length === 0) return 0;
    let maxBeat = 0;
    for (const e of this.events) {
      const endB = e.type === 'delete' ? e.endBeat : e.beat;
      if (endB > maxBeat) maxBeat = endB;
    }
    return Math.floor(maxBeat) + 1;
  }

  getActiveEventAtBeat(beat) {
    const tempoEvents = this.events.filter(e => e.type === 'tempo');
    let active = tempoEvents[0];
    for (const e of tempoEvents) {
      if (e.beat > beat) break;
      active = e;
    }
    return active;
  }

  getActiveEventAtSeconds(seconds) {
    const tempoEvents = this.events.filter(e => e.type === 'tempo');
    let active = tempoEvents[0];
    for (const e of tempoEvents) {
      if (e.startTime > seconds) break;
      active = e;
    }
    return active;
  }

  getSecondsFromBeat(targetBeat) {
    const ev = this.getActiveEventAtBeat(targetBeat);
    const beatsSinceEvent = targetBeat - ev.beat;
    return ev.startTime + (beatsSinceEvent * (60 / ev.bpm));
  }

  getBeatFromSeconds(targetSeconds) {
    const tempoEvents = this.events.filter(e => e.type === 'tempo');
    if (targetSeconds < tempoEvents[0].startTime) {
        const dSec = targetSeconds - tempoEvents[0].startTime;
        return tempoEvents[0].beat + (dSec / (60 / tempoEvents[0].bpm));
    }
    const ev = this.getActiveEventAtSeconds(targetSeconds);
    const secondsSinceEvent = targetSeconds - ev.startTime;
    return ev.beat + (secondsSinceEvent / (60 / ev.bpm));
  }

  getSignatureAt(beat) {
    return this.getActiveEventAtBeat(beat);
  }

  // --- MB (Measure, Beat) Conversion Helpers ---

  beatToMB(totalBeat) {
    const tempoEvents = this.events.filter(e => e.type === 'tempo');
    let accumulatedMeasures = 1;

    for (let i = 0; i < tempoEvents.length; i++) {
        const sig = tempoEvents[i];
        const nextSig = tempoEvents[i + 1];
        const measureLen = sig.signature_n * (4 / sig.signature_d);
        
        if (!nextSig || totalBeat < nextSig.beat) {
            // totalBeat is within this signature section
            const beatsInThisSig = totalBeat - sig.beat;
            const fullMeasuresInThisSig = Math.floor(beatsInThisSig / measureLen + 0.000001);
            const beatInMeasure = Math.max(0, beatsInThisSig - (fullMeasuresInThisSig * measureLen));
            
            return {
                m: accumulatedMeasures + fullMeasuresInThisSig,
                b: Math.round(beatInMeasure * 1000) / 1000
            };
        } else {
            // Accumulate full measures in this closed section
            const sectionBeats = nextSig.beat - sig.beat;
            accumulatedMeasures += Math.floor(sectionBeats / measureLen + 0.000001);
        }
    }
    return { m: 1, b: 0 };
  }

  mbToBeat(measure, beatInMeasure) {
    const tempoEvents = this.events.filter(e => e.type === 'tempo');
    let accumulatedMeasures = 1;

    for (let i = 0; i < tempoEvents.length; i++) {
        const sig = tempoEvents[i];
        const nextSig = tempoEvents[i + 1];
        const measureLen = sig.signature_n * (4 / sig.signature_d);
        
        const sectionMeasures = nextSig 
            ? Math.floor((nextSig.beat - sig.beat) / measureLen + 0.000001)
            : Infinity;

        if (measure < accumulatedMeasures + sectionMeasures) {
            // Target measure is within this signature
            const measuresIntoThisSig = measure - accumulatedMeasures;
            return sig.beat + (measuresIntoThisSig * measureLen) + beatInMeasure;
        } else {
            accumulatedMeasures += sectionMeasures;
        }
    }
    return 0;
  }

  // --- State Management ---
  getState() {
    return JSON.stringify({
        offsetSec: this.offsetSec,
        events: this.events
    });
  }

  loadState(stateString) {
    if (!stateString) return;
    try {
        const state = JSON.parse(stateString);
        this.offsetSec = state.offsetSec;
        // Deep copy events to avoid reference issues
        this.events = JSON.parse(JSON.stringify(state.events));
        this.calculateEventTimes();
    } catch(e) {
        console.error("Failed to load state", e);
    }
  }
}
