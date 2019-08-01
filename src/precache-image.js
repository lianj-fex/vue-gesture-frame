const imagePrecachePromise = {}

export function precacheImage(url) {
  return imagePrecachePromise[url] = imagePrecachePromise[url] || new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(url)
    img.onerror = () => {
      const error = new Error(`Can\'t not load image: ${url}, please validate provided url and check network status`)
      rej(error)
    }
    img.src = url
  })
}

export default precacheImage