export function runSerial(arrAsyncFunction, ...args) {
  let queue = Promise.resolve()
  return Promise.all(arrAsyncFunction.map(fn => queue = queue.then(() => fn(...args))))
}
export function runParallel(arrAsyncFunction, ...args) {
  return Promise.all(arrAsyncFunction.map(fn => fn(...args)))
}
export function loop(target, handler, __currentIndexs = []) {
  if (Array.isArray(target)) {
    target.forEach((item, i) => {
      loop(item, handler, __currentIndexs.concat(i))
    })
  } else {
    handler(target, __currentIndexs)
  }
}

export function clone(target) {
  return JSON.parse(JSON.stringify(target))
}