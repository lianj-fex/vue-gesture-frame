
  const DEBOUNCE_CACHE_SYMBOL = Symbol()
  const DEFAULT_CACHE_CONTEXT = {}
  export function debounce(func, wait, later) {
    return function (...args) {
      const context = this
      let cacheContext = typeof context === 'object' && context != null ? context : DEFAULT_CACHE_CONTEXT
      const cacheMap = (cacheContext[DEBOUNCE_CACHE_SYMBOL] = cacheContext[DEBOUNCE_CACHE_SYMBOL] || new WeakMap)
      let cache = cacheMap.get(func)
      if (!cache) {
        cache = {}
        cacheMap.set(func, cache)
      }
      if (cache.timeout) clearTimeout(cache.timeout)
      if (later || cache.timeout) {
        cache.timeout = setTimeout(() => {
          cache.timeout = null
          cache.result = func.apply(context, args);
        }, wait)
      } else {
        cache.timeout = setTimeout(() => {
          cache.timeout = null
        }, wait)
        cache.result = func.apply(context, args)
      }
      return cache.result
    }
  }
  export default debounce