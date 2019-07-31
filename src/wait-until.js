export function waitUntil(elem, resolveEventTypes, rejectEventTypes = [], options = false) {
  return new Promise((resolve, reject) => {
    const _resolve = (e) => {
      unbind()
      resolve(e)
    }
    const _reject = (e) => {
      unbind()
      reject(e)
    }
    function unbind() {
      resolveEventTypes.forEach(eventType => {
        elem.removeEventListener(eventType, _resolve, options)
      })
      rejectEventTypes.forEach(eventType => {
        elem.removeEventListener(eventType, _reject, options)
      })
    }
    resolveEventTypes.forEach(eventType => {
      elem.addEventListener(eventType, _resolve, options)
    })
    rejectEventTypes.forEach(eventType => {
      elem.addEventListener(eventType, _reject, options)
    })
  })
}
export default waitUntil