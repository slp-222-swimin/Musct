export class AudioEngine {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.buffer = null;
    this.sources = [];
    this.startTime = 0;
    this.isPlaying = false;
    this.validIntervals = []; // [{startSec, durationSec, scheduleStart}]
    this.initialBufferOffset = 0;
  }

  async loadFromFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
    }
    this.buffer = await this.ctx.decodeAudioData(arrayBuffer);
    return this.buffer;
  }

  getDuration() {
    return this.buffer ? this.buffer.duration : 0;
  }

  // Play a sequence of segments back to back
  playSegments(intervals, startFromBufferSec = 0) {
    if (!this.buffer) return;
    if (this.isPlaying) this.stop();

    this.initialBufferOffset = startFromBufferSec;
    this.startTime = this.ctx.currentTime;
    this.validIntervals = [];
    
    let currentScheduleTime = 0;

    for (const int of intervals) {
        // Skip intervals that end before our start point
        if (int.startSec + int.durationSec <= startFromBufferSec) continue;

        let segmentStart = int.startSec;
        let segmentDuration = int.durationSec;

        // If startFromBufferSec falls within this interval, trim the beginning
        if (startFromBufferSec > int.startSec) {
            const diff = startFromBufferSec - int.startSec;
            segmentStart += diff;
            segmentDuration -= diff;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = this.buffer;
        source.connect(this.ctx.destination);
        source.start(this.startTime + currentScheduleTime, segmentStart, segmentDuration);
        
        this.sources.push(source);
        this.validIntervals.push({
            bufferStart: segmentStart,
            duration: segmentDuration,
            scheduleStart: currentScheduleTime
        });

        currentScheduleTime += segmentDuration;
    }

    if (this.sources.length > 0) {
        this.isPlaying = true;
        // Last source ending means playback finished
        this.sources[this.sources.length - 1].onended = () => {
            if (this.isPlaying) this.isPlaying = false;
        };
    }
  }

  stop() {
    this.isPlaying = false;
    for (const source of this.sources) {
        try { source.stop(); } catch(e) {}
        try { source.disconnect(); } catch(e) {}
    }
    this.sources = [];
  }

  getCurrentTime() {
    if (!this.isPlaying) return this.initialBufferOffset;
    
    const elapsed = this.ctx.currentTime - this.startTime;
    
    // Find which interval we are currently in
    let timeInInterval = 0;
    for (const int of this.validIntervals) {
        if (elapsed >= int.scheduleStart && elapsed < int.scheduleStart + int.duration) {
            return int.bufferStart + (elapsed - int.scheduleStart);
        }
    }
    
    // If we are past the last interval, return the end of the last one
    if (this.validIntervals.length > 0) {
        const last = this.validIntervals[this.validIntervals.length - 1];
        if (elapsed >= last.scheduleStart + last.duration) {
            return last.bufferStart + last.duration;
        }
        return this.validIntervals[0].bufferStart;
    }

    return this.initialBufferOffset;
  }
}
