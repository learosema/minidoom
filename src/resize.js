export function initResize(canvas) {
  function resize() {
    canvas.width = window.innerWidth / 2;
    canvas.height = window.innerHeight / 2;
  }
  resize();
  window.addEventListener('resize', resize);
}
