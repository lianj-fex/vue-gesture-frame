
export class QueueRunner {
  static breakError = new Error('加载被打断，加载优先队列的数据')
  // list 运行列表，size 同时运行数
  constructor(list, size = 3) {
    this.size = size
    this._cache = new WeakMap()
    this.run(list || [])
  }
  async run(newList) {
    if (newList) {
      this.list = newList.slice()
    }
    this.isRuning = true
    let list = this.list
    while (list.length) {
      let i = this.size
      const cacheList = []
      while(list.length && i) {
        const fn = list[0]
        let cache = this._cache.get(fn)
        if (!cache) {
          cache = fn()
          this._cache.set(fn, cache)
        }
        list.shift()
        cacheList.push(cache)
        i--
      }

      await Promise.all(cacheList)
      if (list !== this.list) {
        throw this.constructor.breakError
      }
    }
    this.isRuning = false
  }
}
export default QueueRunner