<template>
  <div class="vue-gesture-frame host">
    <div class="container" ref="container" :style="containerPosition">
      <div class="items" :style="{transform: objTransform(transform)}">
        <template v-for="(row, i1) in normalizeItems">
          <template v-for="(item, i2) in row">
            <div class="img" :key="`${i1}-${i2}`" :class="{current: currentItem === item}" :style="{ backgroundSize: mode, backgroundImage: url(getImageUrl(item, prevItem)) }"/>
          </template>
        </template>
        <slot name="loading" v-if="!debounceCurrentItemLoaded" :progress="progress" />
      </div>
    </div>
    <slot :showings="btnShowings" :bindings="btnBindings"></slot>
  </div>
</template>
<style lang="stylus" scoped>
  .host
    position relative
   .container
    position absolute
  .items, .img
    width 100%
    height 100%
    position absolute
  .container
    overflow hidden
  .img
    
    background-position center center
    background-repeat no-repeat
    visibility hidden
    &.current
      visibility visible
  .loading
    position absolute
    top 50%
    left 50%
    transform translate(-50%, -50%)
    z-index 1

</style>
<script>
  import Hammer from 'hammerjs' 
  import Animation from './animation'
  import QueueRunner from './queue-runner'
  import waitUntil from './wait-until'
  import precacheImage from './precache-image'
  import { loop, clone } from './utils'
  import debounce from './debounce'

  const DEFAULT_TRANSFORM = {
    scale: 1,
    translate: {
      x: 0,
      y: 0
    },
  }

 
  function getPrecachePriority([dy, dx], [ry, rx]) {
    // https://math.stackexchange.com/questions/76457/check-if-a-point-is-within-an-ellipse
    return (dx / rx) ** 2 + (dy / ry) ** 2
  }

  function getIndex(index, length, isCycle) {
    if (isCycle) {
      return (index % length + length) % length
    } else {
      const lastIndex = length - 1
      return index > lastIndex ? lastIndex : index < 0 ? 0 : index
    }
  }

  function getIndexDistance(i1, i2, length, isCycle) {
    if (isCycle) {
      return Math.min((i1 - i2 + length) % length, (i2 - i1 + length) % length)
    } else {
      return Math.max(i1, i2) - Math.min(i1, i2)
    }
  }


  export default {
    model: {
      prop: 'value',
      event: 'update:value'
    },
    props: {
      // 图片的布局类型
      // 参考 background-size
      mode: {
        default: 'contain'
      },
      // 内容区域的padding, 
      // size = string | number, 类型为
      // size | [size] | [size, size] | [size, size, size] | [size, size, size, size]
      padding: {
        default: 0
      },
      // 预加载的椭圆半径，在这个范围内（开区间）才会进行预加载，类型 [number, number]
      precacheRadius: {
        default: () => [1, 3]
      },
      // 预览图的优先级因子，范围 0 - 正无穷，两边为开区间，越大，预览图优先级越高
      // 如果想效果比较流畅，设置为value最大轴的长度两倍以上
      thumbPriorityFactor: {
        default: 72
      },
      // 旋转的速度，张/px, [number, number]
      speed: {
        default: () => [1 / 150, 18 / 375]
      },
      // 自动旋转的速度，张/ms，如果是false，则每次一帧
      autoSpeed: {
        default: () => [false, 12/1000]
      },
      // 最大缩放值，相对于当前视图
      maxScale: {
        default: () => 3
      },
      // 数据源，类型 [[{ url: string, thumb: string }]]
      items: {
        type: Array
      },
      // 两个方向是否可循环, 类型 [boolean, boolean]
      cycle: {
        default: () => [false, true]
      },
      // 当前下标，类型 [number, number]
      value: {
        type: Array,
        default: () => [0, 0]
      },
    },
    data() {
      let animation
      const vm = this

      const btnParams = { 
        up: [0, -1],
        down: [0, 1],
        left: [1, -1],
        right: [1, 1]
      }
      const btnBindings = Object.keys(btnParams).reduce((memo, k) => {
        const [axisIndex, step] = btnParams[k]
        if (vm.autoSpeed[axisIndex] === false) {
          memo[k] = {
            click() {
              vm.stepAxis(axisIndex, step)
            }
          }
          return memo
        }

        async function down(e) {
          const document = e.target.ownerDocument
          if (!document) return
          const index = vm.value
          animation = new Animation((t) => {
            const speed = 12/1000 // 12 frame/ms
            vm.setAxisValue(axisIndex, index[axisIndex] + t * vm.autoSpeed[axisIndex] * step)
          })
          animation.start().catch((e) => {
            // console.info(e.message)
          })
          await waitUntil(document, ['mouseup', 'touchend'])
          animation.stop()
        }
        memo[k] = {
          mousedown: down,
          touchstart: down
        }
        return memo

      }, {})

      return {
        prevIndex: this.value,
        btnBindings,
        transform: DEFAULT_TRANSFORM,
        normalizeItems: undefined,
        debounceCurrentItemTotallyLoaded: false,
        debounceCurrentItemLoaded: false,
      }
    },
    computed: {
      progress() {
        let total = 0
        let loaded = 0
        this.normalizeItems.forEach(arr => {
          arr.forEach((item) => {
            if (item.thumb) {
              total ++
            }
            total ++
            if (item.loaded) {
              loaded++
            }
            if (item.thumbLoaded) {
              loaded ++
            }
          })
        })
        return {
          total, loaded
        }
      },
      btnShowings() {
        return {
          down: this.cycle[0] || (this.value[0] !== this.lengths[0] - 1),
          right: this.cycle[1] || (this.value[1] !== this.lengths[1] - 1),
          up: this.cycle[0] || (this.value[0] !== 0),
          left: this.cycle[1] || (this.value[1] !== 0)
        }
      },
      containerPosition() {
        return this._padding
      },
      _padding() {
        let padding = this.padding
        if (!Array.isArray(padding)) {
          padding = [padding]
        }
        padding = padding.map(i => typeof i === 'number' ? `${i}px` : i)
        if (!padding.length) {
          throw new Error('Padding length can\'t not be 0')
        }
        if (padding.length === 1) {
          padding = [padding[0], padding[0]]
        }
        if (padding.length === 2) {
          padding = [padding[0], padding[1], padding[0], padding[1]]
        }
        if (padding.length === 3) {
          padding = [padding[0], padding[1], padding[2], padding[1]]
        }
        return {
          left: padding[3],
          right: padding[1],
          top: padding[0],
          bottom: padding[2]
        }
      },
      currentItem() {
        return this.normalizeItems[this.value[0]][this.value[1]]
      },
      currentItemLoaded() {
        return !(this.currentItem.thumb && !this.currentItem.thumbLoaded ||
          !this.currentItem.thumb && !this.currentItem.loaded)
      },
      currentItemTotallyLoaded() {
        return this.currentItem.loaded
      },
      prevItem() {
        return this.normalizeItems[this.prevIndex[0]][this.prevIndex[1]]
      },
      lengths() {
        return [this.normalizeItems.length, this.normalizeItems[0].length]
      }
    },
    methods: {
      getImageUrl(item, prevItem) {
        return (
          item.loaded ? item.url : 
          item.thumb && item.thumbLoaded ? item.thumb :
          prevItem.loaded ? prevItem.url :
          prevItem.thumb && prevItem.thumbLoaded ? item.thumb :
          '__blank'
        )
      },
      url(url) {
        return `url("${url}")`
      },
      objTransform(transform) {
        return [
          'translate3d(' + transform.translate.x + 'px, ' + transform.translate.y + 'px, 0)',
          'scale(' + transform.scale + ', ' + transform.scale + ')'
        ].join(" ");
      },
      reset() {
        this.transform = DEFAULT_TRANSFORM
      },
      stepAxis(axisIndex = 0, step = 1) {
        this.setAxisValue(axisIndex, this.value[axisIndex] + step)
      },
      setAxisValue(axisIndex, value) {
        if (!this.currentItemLoaded) {
          throw new Error('当前图片正在加载中')
        }
        const valueArr = this.value.slice()
        valueArr[axisIndex] = parseInt(value)
        this.setValue(valueArr)
      },
      setValue(value) {
        value = value.slice()
        this.value.forEach((_, axis) => {
          value[axis] = getIndex(value[axis], this.lengths[axis], this.cycle[axis])
        })
        if (JSON.stringify(this.value) !== JSON.stringify(value)) {
          this.prevIndex = this.value
          this.$emit(this.$options.model.event, value)
        }
      }
    },
    mounted() {
      const el = this.$refs.container
      const mc = new Hammer.Manager(el)

      mc.add(new Hammer.Pan({ threshold: 0, pointers: 0 }))
      mc.add(new Hammer.Pinch({ threshold: 0 }))

      let initTransform
      let initIndex
      let initDerection = null

      const reset = () => {
        initIndex = this.value.slice()
        initTransform = null
        initDerection = null
      }
      reset()

      const scaleTo = (v) => {
        this.transform = {
          ...this.transform,
          scale: Math.min(Math.max(v, 1), this.maxScale)
        }
      }
      
      el.addEventListener('wheel', (ev) => {
        scaleTo(this.transform.scale - ev.deltaY / 600)
        ev.preventDefault()
      })

      mc.on('panstart pinchstart', (ev) => {
        reset()
        initTransform = clone(this.transform)
      })
      mc.on('panend pinchend', (ev) => {
        reset()
      })

      mc.on('panmove', (ev) => {
        if (!initTransform) return
        if (initTransform.scale === 1) {
          if (initDerection === null) {
            initDerection = Math.abs(ev.deltaY) < Math.abs(ev.deltaX)
          }
          const axis = initDerection ? 1 : 0
          const p = initDerection ? 'deltaX' : 'deltaY'
          try {
            this.setAxisValue(axis, initIndex[axis] + ev[p] * this.speed[axis])
          } catch(e) {
            reset()
          }
        } else {
          this.transform = {
            ...this.transform,
            translate: {
              x: initTransform.translate.x + ev.deltaX,
              y: initTransform.translate.y + ev.deltaY
            }
          };
        }
      })

      mc.on('pinchmove', (ev) => {
        if (!initTransform) return
        scaleTo(initTransform.scale * ev.scale)
      })
    },
    created() {
      this.$watch('items', items => {
        items = clone(items)
        loop(items, (item, indexs) => {
          item.thumbLoaded = false
          item.loaded = false
        })
        this.normalizeItems = items
      }, {
        immediate: true
      })

      this.$watch('currentItemTotallyLoaded', debounce(loaded => {
        this.debounceCurrentItemTotallyLoaded = loaded
      }, 1000), {
        immediate: true
      })

      this.$watch('currentItemLoaded', debounce(loaded => {
        this.debounceCurrentItemLoaded = loaded
      }, 1000), {
        immediate: true
      })

      const sortHandler = (a, b) => a.priority - b.priority

      let queueRunner = new QueueRunner([], 2)
      this.$watch(
        () => [this.lengths, this.normalizeItems, this.value, this.precacheRadius, this.cycle, this.thumbPriorityFactor], 
        async ([lengths, items, value, precacheRadius, cycle, thumbPriorityFactor]) => {
          const queue = []
          const otherQueue = []
          loop(items, (item, indexs) => {
            const dy = getIndexDistance(value[0], indexs[0], lengths[0], cycle[0])
            const dx = getIndexDistance(value[1], indexs[1], lengths[1], cycle[1])
            const priority = getPrecachePriority([dy, dx], precacheRadius)

            if (!item.loaded) {
              const loadImage = async () => {
                await precacheImage(item.url)
                item.loaded = true
              }
              loadImage.priority = priority
              if (loadImage.priority < 1) {
                queue.push(loadImage)
              } else {
                otherQueue.push(loadImage)
              }
            }

            if (item.thumb && !item.thumbLoaded) {
              const loadThumb = async () => {
                await precacheImage(item.thumb)
                item.thumbLoaded = true
              }
              loadThumb.priority = priority / thumbPriorityFactor
              if (loadThumb.prototype < 1) {
                queue.push(loadThumb)
              } else {
                otherQueue.push(loadThumb)
              }
            }

          })
          queue.sort(sortHandler)
          try {
            await queueRunner.run(queue)
            otherQueue.sort(sortHandler)
            await queueRunner.run(otherQueue)
          } catch(e) {
            if (e === QueueRunner.breakError) {
              // console.info(e.message)
            } else {
              throw e
            }
          }
        // console.log(flattenItems)
      }, {
        immediate: true
      })
    }
  }
</script>