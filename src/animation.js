const raf = (...args) => (global.requestAnimationFrame || (fn => global.setTimeout(fn, 1000 / 60)))(...args)

export class Animation {
  constructor(fn) {
    this.fn = fn
  }
  _start(resolve, reject) {
    raf(() => {
      const currentTime = Date.now()
      const deltaTime = currentTime - this.startTime
      try {
        this.fn(deltaTime, currentTime, this.startTime)
      } catch(e) {
        reject(e)
      }
      if (this.isTicking) {
        this._start(resolve, reject)
      } else {
        resolve()
      }
    })
  }
  start() {
    this.startTime = Date.now()
    this.isTicking = true
    return new Promise((resolve, reject) => {this._start(resolve, reject)})
  }
  stop() {
    this.isTicking = false
  }
}
export default Animation