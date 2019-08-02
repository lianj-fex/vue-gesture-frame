<template>
  <div class="lianj-template-product-viewer">
    <gesture-frame 
      v-if="gestureFrameParams.items" 
      v-bind="gestureFrameParams" 
      :style="{width: `${width}px`, height: `${height}px`}"
      v-on="{ [$options.model.event]: (v) => { $emit($options.model.event, v) } }"
    >
    <template slot="loading">
      <div class="spinner">
        <div class="rect1"></div>
        <div class="rect2"></div>
        <div class="rect3"></div>
        <div class="rect4"></div>
        <div class="rect5"></div>
      </div>
    </template>
    <template slot-scope="{ showings, bindings, errors }">
      {{ errors.length > 2 && errors[0].message }}
      <button type="button" v-if="showings.down" v-on="bindings.down" class="btn-down">向下</button>
      <button type="button" v-if="showings.up" v-on="bindings.up" class="btn-up">向上</button>
      <button type="button" v-if="showings.right" v-on="bindings.right" class="btn-right">向右</button>
      <button type="button" v-if="showings.left" v-on="bindings.left" class="btn-left">向左</button>
    </template>
    </gesture-frame>
  </div>
</template>
<style lang="stylus" scpoed>
  .lianj-template-product-viewer
    overflow hidden

  [class^=btn], [class*=" btn"]
    position absolute
    z-index 1
    user-select none
  .btn-left
    left 5px
    top 50%
    transform translateY(-50%)
  .btn-up
    top 5px
    left 50%
    transform translateX(-50%)
  .btn-right
    right 5px
    top 50%
    transform translateY(-50%)
  .btn-down
    bottom 5px
    left 50%
    transform translateX(-50%)

  .spinner
    $from = .5
    $to = 0
    $color = #fff
    position fixed
    top 0
    left 0
    bottom 0
    right 0
    margin auto
    width 50px
    height 40px
    text-align center
    font-size 14px
    [class^=rect]
      background-color $color
      opacity $from
      height 100%
      width 6px
      display inline-block
      animation sk-stretchdelay 1.2s infinite ease-in-out
    .rect2
      animation-delay -1.1s
    .rect3
      animation-delay -1.0s
    .rect4
      animation-delay -0.9s
    .rect5
      animation-delay -0.8s

  @keyframes sk-stretchdelay
    0%, 40%, 100%
      transform scaleY(0.4)
      opacity $to
    20%
      transform scaleY(1.0)
      opacity $from
  
</style>
<script>
  import GestureFrame from '../src/index.vue'
  import thumb from './thumb'
  import debounce from '../src/debounce'
  import { loop, clone } from '../src/utils'

  const maxDpr = 2
  const dpr = Math.min(global.devicePixelRatio || 1, maxDpr)

  function calcSize(size, factor) {
    return size * dpr * factor
  }

  function getUrl(url, { width, height, factor }) {
    return thumb(url, { 
      width: calcSize(width, factor), 
      height: calcSize(height, factor)
    })
  }

  // !!!布局要求，宿主不能被设置padding和border
  

  export default {
    components: {
      GestureFrame
    },
    model: GestureFrame.model,
    props: {
      // 参数主要产考GestureFrame
      ...GestureFrame.props,
      items: {},
      // 缩略图的长宽缩放比例
      thumbScaleFactor: {
        default: 0.2
      },
      keepLoadingWhenError: {
        default: true
      }
    },
    data: () => ({
      width: null,
      height: null
    }),
    computed: {
      gestureFramsParamsItems() {
        if (!this.width || !this.height) return null
        const items = clone(this.items)
        const size = { width: this.width, height: this.height }
        loop(items, (item) => {
          const url = item.url
          item.url = getUrl(url, { ...size, factor: 1})
          if (this.thumbScaleFactor) {
            const thumb = getUrl(url, { ...size, factor: this.thumbScaleFactor })
            if (thumb !== url) {
              item.thumb = thumb
            }            
          }

        })
        return items
      },
      gestureFrameParams() {
        const s = {
          ...this.$props,
          items: this.gestureFramsParamsItems
        }
        delete s.thumbScaleFactor
        return s
      }
    },
    methods: {
      resize: debounce(function() {
        this.width = this.$el.clientWidth
        this.height = this.$el.clientHeight
      }, 500)
    },
    mounted() {
      this.resize()
      global.addEventListener('resize', () => {
        this.resize()
      })
    }
  }
</script>