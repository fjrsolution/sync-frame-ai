/* Keep the media decoder running; seek only on cuts, scrubs or real drift. */
(function (root) {
  'use strict';
  function createVideoPlaybackController(clock = () => performance.now()) {
    let clipKey = null, pendingPlay = false, lastSeek = -Infinity;
    let currentVideo = null, latest = null, needsSeek = true;
    function sync(video, options) {
      latest = options;
      if (currentVideo !== video) {
        currentVideo = video;
        video.addEventListener('loadedmetadata', () => {
          if (currentVideo === video && latest) { needsSeek = true; sync(video, latest); }
        });
      }
      const key = `${options.source}:${options.clipId}`;
      if (key !== clipKey) { clipKey = key; needsSeek = true; }
      if (video.dataset.src !== options.source) {
        video.dataset.src = options.source;
        video.src = options.source;
        needsSeek = true;
        video.load();
      }
      const duration = Math.max(.001, options.duration);
      const sourceLength = Math.max(.001, options.sourceEnd - options.sourceStart);
      const local = Math.max(0, Math.min(duration, options.time));
      const target = Math.min(options.sourceEnd, options.sourceStart + local / duration * sourceLength);
      const backwards = options.direction < 0;
      const playing = options.playing && !backwards;
      const rate = Math.max(.0625, Math.min(16, (options.rate || 1) * sourceLength / duration));
      if (Math.abs(video.playbackRate - rate) > .0001) video.playbackRate = rate;
      if (options.forceSeek) { needsSeek = true; options.forceSeek = false; }
      if (video.readyState >= 1 && !video.seeking) {
        const drift = Math.abs(video.currentTime - target);
        if ((needsSeek && drift > .001) || (!playing && drift > 1 / 60)
            || (playing && drift > .45 && clock() - lastSeek >= 1000)) {
          video.currentTime = Math.max(0, Math.min(video.duration, target));
          lastSeek = clock();
        }
        needsSeek = false;
      }
      if (!playing) { video.pause(); return; }
      if (video.paused && !pendingPlay && video.readyState >= 1) {
        pendingPlay = true;
        Promise.resolve(video.play()).catch(() => {}).finally(() => { pendingPlay = false; });
      }
    }
    function reset() { clipKey = null; needsSeek = true; latest = null; }
    return {sync, reset};
  }
  root.FrameSyncVideoPlayback = {createVideoPlaybackController};
  if (typeof module !== 'undefined' && module.exports) module.exports = root.FrameSyncVideoPlayback;
})(typeof window !== 'undefined' ? window : globalThis);
