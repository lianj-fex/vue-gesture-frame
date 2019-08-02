// 阿里云oss文件缩略图地址获取

const alias = {
  'full': 1600,
  'large': 960,
  'medium': 480,
  'small': 280,
  'tiny': 120,
  'micro': 48
};

const widthReg = /\d+(?=w)/;
const heightReg = /\d+(?=h)/;

function normalizeParams(...args) {
  if (!args.length) {
    return { }
  }
  if (typeof args[0] === 'object') {
    return args[0]
  }
  let [size, crop, defaultImg] = args
  size = size || 'small'
  let mode = 'fix'
  if (alias[size]) {
    size = {
      width: alias[size],
      height: alias[size]
    }
  }
  if (typeof size === 'number' || `${+size}` === size) {
    size = {
      width: size,
      height: size
    }
  }
  if (size.substring) {
    size = {
      width: (size.match(widthReg) || [])[0],
      height: (size.match(heightReg) || [])[0]
    }
  }
  if (size.width) {
    size.width = + size.width
  }
  if (size.height) {
    size.height = + size.height
  }
  if (crop) {
    mode = 'cover'
  }
  return {
    default: defaultImg,
    ...size,
    mode
  }
}

const rQuery = /\?.*$/
const mode2commands = {
  fix: '0c',
  cover: '1c_1e'
}


function thumbByOldVersion(input = '', options) {
  // 修正域名，img-cn域名才可以接受缩略图参数
  input = input.replace('oss-cn', 'img-cn')
  let query = ''
  input = input.replace(rQuery, (_) => { query = _; return '' })

  const commands = []
  if (options.width) {
    commands.push(`${Math.round(options.width)}w`)
  }
  if (options.height) {
    commands.push(`${Math.round(options.height)}h`)
  }

  if (options.maxRatio) {
    commands.push('1l')
  }

  if (options.mode && options.mode !== 'fix') {
    if (mode2commands[options.mode]) {
      commands.push(mode2commands[options.mode])
    } else {
      throw new Error(`do not support mode ${options.mode}`)
    }
  }


  return `${input}${input.indexOf('@') === -1 ? '@' : '|'}${commands.join('_')}${query}`;
};

// https://help.aliyun.com/document_detail/32223.html
// https://help.aliyun.com/document_detail/44688.html

// fix => lfit
// cover => fill
// contain => pad
// fixed => stretch

const mode2m = {
  fix: 'lfit',
  cover: 'fill',
  contain: 'pad',
  fixed: 'stretch'
}
const r = /x-oss-process=[^?&]*/
const defaultOptions = {
  mode: 'fix',
  maxRatio: 1,
  width: alias.small,
  height: alias.small
}

export function thumb(input = '', ...args) {
  const options = Object.assign({}, defaultOptions, normalizeParams(...args))
  
  if (options.maxRatio && options.maxRatio !== 1) {
    throw new Error('maxRatio only suport 1')
  }

  if (!input) {
    return options.default;
  }
  if (input.indexOf('aliyuncs.com') < 0 && input.indexOf('lianj.com') < 0) {
    return input;
  }
  if (input.indexOf('/idCard/') >= 0) {
    return input;
  }
  // 表示是私有链接，不增加缩略图参数
  if (input.indexOf('OSSAccessKeyId') > 0) {
    return input;
  }

  if (input.indexOf('@') !== -1) {
    return thumbByOldVersion(input, options);
  }

  const commands = [`image/resize`]
  if (options.width) {
    commands.push(`w_${Math.round(options.width)}`)
  } 
  if (options.height) {
    commands.push(`h_${Math.round(options.height)}`)
  }

  if (!options.maxRatio) {
    commands.push('limit_0')
  }

  if (options.mode && options.mode !== 'fix') {
    if (mode2m[options.mode]) {
      commands.push(`m_${mode2m[options.mode]}`)
    } else {
      throw new Error(`do not support mode ${options.mode}`)
    }
  }
  if (options.backgroundColor) {
    commands.push(`color_${options.backgroundColor.replace(/^#/, '')}`)
  }

  if (r.test(input)) {
    return input.replace(r, (_) => {
      return `${_}|${commands.join(',')}`
    })
  } else {
    return `${input}${input.indexOf('?') === -1 ? '?' : '&' }x-oss-process=${commands.join(',')}`;
  }

};

export default thumb