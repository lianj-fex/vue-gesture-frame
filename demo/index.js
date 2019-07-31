import Component from './lianj-template-product-viewer.vue'
import instantiate from './instantiate'
import generateManyDimensionsArray from './generate-many-dimensions-array'

const baseUrl = 'https://image.lianj.com/for-huiyang/product/0/1/1221/image/'
const items = generateManyDimensionsArray([3, 36], ds => {
  return {
    url: `${baseUrl}${ds.map(i => i + 1).join('-')}.png`,
  }
})

const splites = items.splice(0, Math.ceil(items.length / 2))
const valueY = items.length
items.push(...splites)

const vm = instantiate(Component, {
  el: document.querySelector('div'),
  propsData: {
    value: [valueY, 0],
    items,
    maxScale: 3
  },
})
