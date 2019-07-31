
  const DEBOUNCE_CACHE_SYMBOL = Symbol()
  const DEFAULT_CACHE_CONTEXT = {}
  export function debounce(func, wait) {
    return function (...args) {
      const context = this
      let cacheContext = typeof context === 'object' && context != null ? context : DEFAULT_CACHE_CONTEXT
      const cacheMap = (context[DEBOUNCE_CACHE_SYMBOL] = context[DEBOUNCE_CACHE_SYMBOL] || new WeakMap)
      let cache = cacheMap.get(func)
      if (!cache) {
        cache = {}
        cacheMap.set(func, cache)
      }
      
      if (!cache.timeout) {
        cache.timeout = setTimeout(() => {
          cache.timeout = null
        }, wait)
        cache.result = func.apply(context, args)
      } else {
        clearTimeout(cache.timeout);
        cache.timeout = setTimeout(() => {
          cache.timeout = null
          cache.result = func.apply(context, args);
        }, wait)
      }
      return cache.result
    }
  }
  export default debounce