<template>
  <div class="vue-gesture-frame host">
    <div class="container" ref="container" :style="containerPosition">
      <div class="items" :style="{transform: objTransform(transform)}">
        <template v-for="(row, i1) in normalizeItems">
          <template v-for="(item, i2) in row">
            <div class="img" :key="`${i1}-${i2}`" :class="{current: currentItem === item}" :style="{ backgroundSize: mode, backgroundImage: url(getImageUrl(item, prevItem)) }"/>
          </template>
        </template>
      </div>
    </div>
    <slot name="loading" v-if="debounceCurrentItemLoading" :progress="progress" ></slot>
    <slot :showings="btnShowings" :bindings="btnBindings" :reload="reload.bind(this)" :errors="errors" ></slot>
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

  function getItemError(item) {
    return item.thumb ? item.thumbError : item.error
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
      // 同时容忍的最大错误的数量，大于此值中断队列的加载
      maxNumberOfError: {
        default: 1,
      },
      // 当前下标，类型 [number, number]
      value: {
        type: Array,
        default: () => [0, 0]
      },
      // 当放大后，左键作用变为拖动
      leftMouseButtonMovingAfterScale: {
        type: Boolean,
        default: true
      },
      // 一倍缩放情况是否允许拖动
      canMovingWhen1x: {
        type: Boolean,
        default: false,
      },
      // 拖动时判断拖动偏向，并锁定另一轴
      lockRotateDirection: {
        type: Boolean,
        default: false
      },
    },
    data() {
      const animation = new Animation()
      this._animation = animation
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
              try {
                vm.validateActionable()
                vm.stepAxis(axisIndex, step)
              } catch(e) {}
            }
          }
          return memo
        }

        async function down(e) {
          e.preventDefault()
          const document = e.target.ownerDocument
          if (!document) return

          const index = vm.value;

          animation.start((t) => {
            vm.validateActionable()
            // 第二个参数向上取整，是为了很快的单击也能切换一帧
            vm.setAxisValue(axisIndex, Math.ceil(index[axisIndex] + t * vm.autoSpeed[axisIndex] * step))
          }).catch((e) => {})
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
        debounceCurrentItemLoading: undefined,
        // 最后一次设置value的轴与方向 [ axis, direction ]
        lastSetAxis: [this.value.length - 1, 1]
      }
    },
    computed: {
      progress() {
        const items = [];
        const thumbLoadedItems = [];
        const loadedItems = [];
        let total = 0;
        let loaded = 0;
        let thumbTotal = 0;
        let thumbLoaded = 0;
        loop(this.normalizeItems, item => {
          items.push(item);
          if (item.thumb) {
            total ++;
          }
          total ++
          if (item.loaded) {
            loaded++;
            loadedItems.push(item);
          }
          if (item.thumbLoaded) {
            loaded ++;
            thumbLoadedItems.push(item);
          }
        })

        return {
          total, loaded, loadedItems, thumbLoadedItems, items
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
      currentItemLoading() {
        return this.currentItem.thumb ? this.currentItem.thumbLoading : this.currentItem.loading
      },
      currentItemError() {
        return this.currentItem.thumb ? this.currentItem.thumbError : this.currentItem.error
      },
      currentItemUrlLoaded() {
        return this.currentItem.loaded
      },
      prevItem() {
        return this.normalizeItems[this.prevIndex[0]][this.prevIndex[1]]
      },
      lengths() {
        return [this.normalizeItems.length, this.normalizeItems[0].length]
      },
      errors() {
        const errors = []
        loop(this.normalizeItems, (item) => {
          const e = getItemError(item)
          if (e)
            errors.push(e)
        })
        return errors
      },
    },
    methods: {
      reload() {
        return this._load(this._getLoadParams())
      },
      getImageUrl(item, prevItem) {
        return (
          item.loaded ? item.url :
          item.thumb && item.thumbLoaded ? item.thumb :
          prevItem.loaded ? prevItem.url :
          prevItem.thumb && prevItem.thumbLoaded ? prevItem.thumb :
          '_blank'
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
      validateActionable() {
        if (this.currentItemLoading) {
          throw new Error('当前图片正在加载中')
        }
      },
      stepAxis(axisIndex = 0, step = 1) {
        this.setValue(this.getValue(axisIndex, this.normalizeAxisValue(axisIndex, this.value[axisIndex] + step)))
      },
      normalizeAxisValue(axisIndex, value) {
        return getIndex(value, this.lengths[axisIndex], this.cycle[axisIndex])
      },
      getValue(axisIndex, axisValue) {
        const value = this.value.slice()
        value[axisIndex] = parseInt(axisValue)
        return value
      },
      setValue(value) {
        if (JSON.stringify(this.value) !== JSON.stringify(value)) {
          this.prevIndex = this.value
          this.$emit(this.$options.model.event, value)
        }
      },
      setAxisValue(axisIndex, axisValue) {
        axisValue = this.normalizeAxisValue(axisIndex, axisValue)
        const value = this.getValue(axisIndex, axisValue)
        const item = this.normalizeItems[value[0]][value[1]]
        this.setValue(value)
      }
    },
    mounted() {
      const el = this.$refs.container
      const mc = new Hammer.Manager(el)

      mc.add(new Hammer.Pan({ threshold: 13, pointers: 0 }))
      mc.add(new Hammer.Pinch({ threshold: 0 }))

      let initTransform
      let initIndex
      let initDerectionAxis = null
      let destoryTimeout = null

      const reset = () => {
        initIndex = this.value.slice()
        initDerectionAxis = null
        initTransform = null
        if (destoryTimeout) {
          clearTimeout(destoryTimeout)
        }
      }


      const initGesture = () => {
        reset()
        initTransform = clone(this.transform)
      }

      const destroyGesture = (ev) => {
        this._animation.stop()
        if (initTransform) {
          if (this.transform.scale === 1 && this.transform.translate.x !== 0 && this.transform.translate.y !== 0) {
            const duration = 200
            const oldTransform = { ...this.transform }
            this._animation.start((deltaTime) => {
              this.transform.translate.x = (0 - oldTransform.translate.x) * (deltaTime / duration) + oldTransform.translate.x
              this.transform.translate.y = (0 - oldTransform.translate.y) * (deltaTime / duration) + oldTransform.translate.y
            }, duration)
          }
        }
        reset()
      }
      reset()

      const scaleTo = (v) => {
        this.transform = {
          ...this.transform,
          scale: Math.min(Math.max(v, 1), this.maxScale)
        }
      }

      const moveImage = ({deltaX, deltaY}) => {
        let x = initTransform.translate.x + deltaX
        let y = initTransform.translate.y + deltaY
        if (initTransform.scale === 1 && !this.canMovingWhen1x) {
          if (!this.transform.translate.x) x = 0
          if (!this.transform.translate.y) y = 0
        }
        this.transform = {
          ...this.transform,
          translate: { x, y }
        };
      }

      
      const debounceDestroy = () => {
        if (destoryTimeout) {
          clearTimeout(destoryTimeout)
        }
        destoryTimeout = setTimeout(() => {
          destroyGesture()
        }, 500)
      }

      el.addEventListener('wheel', (ev) => {
        initGesture(ev)
        const oldScale = this.transform.scale
        scaleTo(this.transform.scale - ev.deltaY / 600, this.transform.scale)
        ev.preventDefault()
        debounceDestroy()
      })
      el.addEventListener('mousedown', (e) => {
        if (e.which === 3) {
          initGesture(e)
          let prevE = e;
          const _move = (e) => {
            const deltaX = e.screenX - prevE.screenX;
            const deltaY = e.screenY - prevE.screenY;
            moveImage({deltaX, deltaY});
          }
          const _up = (e) => {
            debounceDestroy();
            document.removeEventListener('mousemove', _move);
            document.removeEventListener('mouseup', _up);
          }
          document.addEventListener('mousemove', _move);
          document.addEventListener('mouseup', _up)
        }
      });
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      })

      mc.on('panstart pinchstart', initGesture)
      mc.on('panend pinchend', destroyGesture)

      mc.on('panmove', (ev) => {
        if (!initTransform) return
        if (initTransform.scale === 1 || !this.leftMouseButtonMovingAfterScale) {
          try {
            if (this.lockRotateDirection) {
              if (initDerectionAxis === null) {
                initDerectionAxis = Math.abs(ev.deltaY) < Math.abs(ev.deltaX) ? 1 : 0
              }
              const axis = initDerectionAxis
              const p = initDerectionAxis ? 'deltaX' : 'deltaY'
      
              this.validateActionable()
              this.setAxisValue(initDerectionAxis, initIndex[initDerectionAxis] + ev[p] * this.speed[initDerectionAxis])

            } else {
              this.setAxisValue(0, initIndex[0] + ev.deltaY * this.speed[0])
              this.setAxisValue(1, initIndex[1] + ev.deltaX * this.speed[1])
            }
          } catch(e) {
            reset()
          }
        } else {
          moveImage(ev)
        }
      })

      mc.on('pinchmove', (ev) => {
        if (!initTransform) return
        scaleTo(initTransform.scale * ev.scale, initTransform.scale)
      })
    },
    created() {
      this.$watch('items', items => {
        items = clone(items)
        loop(items, (item, indexs) => {
          item.thumbLoaded = false
          item.loaded = false
          item.thumbLoading = true
          item.loading = true
          item.thumbError = null
          item.error = null
        })
        this.normalizeItems = items
      }, {
        immediate: true
      })

      this.$watch('currentItemLoading', debounce(loading => {
        this.debounceCurrentItemLoading = loading
      }, 500), {
        immediate: true
      })

      this.$watch('currentItemError', error => {

        // this.stepAxis(...this.lastSetAxis)
      })

      const sortHandler = (a, b) => a.priority - b.priority

      this._load = async ([lengths, items, value, precacheRadius, cycle, thumbPriorityFactor]) => {
        const queue = []
        const otherQueue = []
        loop(items, (item, indexs) => {
          const dy = getIndexDistance(value[0], indexs[0], lengths[0], cycle[0])
          const dx = getIndexDistance(value[1], indexs[1], lengths[1], cycle[1])
          const priority = getPrecachePriority([dy, dx], precacheRadius)

          if (!item.loaded) {
            const loadImage = async () => {
              item.loading = true
              item.error = null
              try {
                await precacheImage(item.url)
                item.loaded = true
              } catch(e) {
                item.error = e
                if (this.errors.length >= this.maxNumberOfError) throw e
              } finally {
                item.loading = false
              }
            }
            loadImage.priority = priority
            loadImage.url = item.url
            if (loadImage.priority < 1) {
              queue.push(loadImage)
            } else {
              otherQueue.push(loadImage)
            }
          }

          if (item.thumb && !item.thumbLoaded) {
            const loadThumb = async () => {
              item.thumbLoading = true
              try {
                await precacheImage(item.thumb)
                item.thumbLoaded = true
              } catch(e) {
                item.thumbError = e
                if (this.errors.length >= this.maxNumberOfError) throw e
              } finally {
                item.thumbLoading = false
              }
            }
            loadThumb.priority = priority / thumbPriorityFactor
            loadThumb.url = item.thumb

            if (loadThumb.priority < 1) {
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
      }

      this._getLoadParams = () => [this.lengths, this.normalizeItems, this.value, this.precacheRadius, this.cycle, this.thumbPriorityFactor]

      let queueRunner = new QueueRunner([], 2)
      this.$watch(
        this._getLoadParams,
        this._load, {
        immediate: true
      })
    }
  }
</script>