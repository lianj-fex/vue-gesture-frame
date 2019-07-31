const imagePrecachePromise = {}
  
export function precacheImage(url) {
  return imagePrecachePromise[url] = imagePrecachePromise[url] || new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(url)
    img.onerror = rej
    img.src = url
  })
}
export default precacheImage