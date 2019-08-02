import Vue from 'vue'
export default function getInst(Component, initParams) {
  if (typeof Component !== 'function') {
    Component = Vue.extend(Component)
  }
  const listeners = {}
  const vm = new Component(initParams)
  Object.keys(Component.options.props).forEach(key => {
    listeners[`update:${key}`] = (v) => {
      vm[key] = v
    }
  })

  const model = {
    prop: 'value',
    event: 'input',
    ...Component.options.model || {}
  }
  
  if (Component.options.model) {
    listeners[model.event] = (v) => {
      vm[model.prop] = v 
    }
  }

  Object.keys(listeners).forEach(key => {
    vm.$on(key, listeners[key])
  })
  return vm
}
export { getInst }