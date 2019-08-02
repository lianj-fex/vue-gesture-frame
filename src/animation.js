const raf = (...args) => (global.requestAnimationFrame || (fn => global.setTimeout(fn, 1000 / 60)))(...args)

export class Animation {
  constructor(fn, duration) {
    this.fn = fn
    this.duration = duration
  }
  _tick(fn) {
    const currentTime = Date.now()
    let deltaTime = currentTime - this.startTime
    if (this.duration) {
      deltaTime = Math.min(deltaTime, this.duration)
      if (deltaTime === this.duration) {
        this.isTicking = false
      }
    }
    fn(deltaTime, currentTime, this.startTime)
  }
  _start(resolve, reject, fn) {
    raf(() => {
      if (this.isTicking) {
        try {
          this._tick(fn)
        } catch(e) {
          reject(e)
        }
        this._start(resolve, reject, fn)
      } else {
        resolve()
      }
    })
  }
  start(fn, duration) {
    if (fn) this.fn = fn
    if (duration) {
      this.duration = duration
    } else {
      duration = null
    }
    this.startTime = Date.now()
    this.isTicking = true
    return new Promise((resolve, reject) => {this._start(resolve, reject, fn)})
  }
  stop() {
    this.isTicking = false
    this._tick
  }
}
export default Animation