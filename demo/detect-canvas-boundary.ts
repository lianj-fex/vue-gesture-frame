
import precacheImage from '../src/precache-image'

function detectCanvasBoundary(canvas) {
  const context = canvas.getContext('2d')
  const width = canvas.width
  const height = canvas.height
  let top
  let bottom
  let left
  let right

  function getAlpha(x, y) {
    return context.getImageData(x, y, 1, 1).data[3]
  }

  top: for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (getAlpha(x, y)) {
        top = y
        break top
      }
    }
  }

  right: 
  for (let x = height - 1; x > -1; x--) {
    for (let y = top; y < height; y++) {
      if (getAlpha(x, y)) {
        right = y
        break right
      }
    }
  }

  bottom: for (let y = height - 1; y > top; y--) {
    for (let x = right - 1; x > -1; x--) {
      if (getAlpha(x, y)) {
        bottom = y
        break bottom
      }
    }
  }

  left: for (let x = 0; x < right; x++) {
    for (let y = bottom - 1; y > top; y--) {
      if (getAlpha(x, y)) {
        left = x
        break left
      }
    }
  }

  
  return {
    top, left, right, bottom
  }
}


function cropCanvas(targetCanvas, x, y, width, height) {
  const imageData = targetCanvas.getContext('2d').getImageData(x, y, width, height)

  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')

  c.width = width
  c.height = height

  ctx.putImageData(imageData, 0, 0)

  return c.toDataURL('image/png')
}

