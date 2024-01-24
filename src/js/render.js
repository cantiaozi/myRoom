import { bvhAccel, flattenBvh } from './accelBvh'
import { mergeMeshesToGeometry } from './mergeMeshesToGeometry'
import { makeDataTexture } from './createTexture'
import { meshMums } from './createMesh'
// import * as mat4 from 'gl-matrix/mat4'

let needInitData = true
let bvhTexture, positionTexture, normalTexture, uvTexture
let useTextures, colorAndMaterialTypes
let materialBuffer
let uniforms

export function render(gl, allModels, camera) {
  gl.clearColor(0.0, 0.0, 0.0, 1.0)
  gl.enable(gl.DEPTH_TEST)
  // gl.depthFunc(gl.LEQUAL);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.useProgram(gl.program)
  if (needInitData) {
    const mergedGeometry = mergeMeshesToGeometry(allModels)
    const bvhNodes = bvhAccel(mergedGeometry.geometry)
    //flatBvh中每个节点用两个像素来存储，如果是三角形的话，第一个像素存储的是顶点下标，第二个像素存储的是法
    //向量和材质下标materialIndex
    const flatBvh = flattenBvh(bvhNodes)
    bvhTexture = makeDataTexture(gl, flatBvh.buffer, 4)
    positionTexture = makeDataTexture(gl, mergedGeometry.geometry.getAttribute('position').array, 3)
    normalTexture = makeDataTexture(gl, mergedGeometry.geometry.getAttribute('normal').array, 3)
    uvTexture = makeDataTexture(gl, mergedGeometry.geometry.getAttribute('uv').array, 2)
    const materialObj = dealWithMaterial(allModels)
    useTextures = materialObj.useTextures
    colorAndMaterialTypes = materialObj.colorAndMaterialTypes
    materialBuffer = makeUniformBuffer(gl, gl.program, 'Materials')
    materialBuffer.set('Materials.colorAndMaterialType[0]', colorAndMaterialTypes)
    materialBuffer.set('Materials.usetexture[0]', useTextures)
  }
  if (allModels.length === meshMums) {
    needInitData = false
  }
  materialBuffer.bind(0)
  updateUniformData()
  gl.draw()

  function updateUniformData() {
    if (!uniforms) {
      uniforms = {}
      const count = gl.getProgramParameter(gl.program, gl.ACTIVE_UNIFORMS)
      for (let i = 0; i < count; i++) {
        const { name, type } = gl.getActiveUniform(gl.program, i)
        const location = gl.getUniformLocation(gl.program, name)
        if (location) {
          uniforms[name] = {
            type,
            location
          }
        }
      }
    }
    // const modelMatrix = gl
    const uniformObj = {}
    uniformObj['camera.matrixWorld'] = camera.matrixWorld.elements
    uniformObj['camera.fov'] = Math.tan((camera.fov * Math.PI) / (2 * 180))
    uniformObj['camera.aspect'] = camera.aspect
    uniformObj['BVH_COLUMNS'] = bvhTexture.columnsLog
    uniformObj['VERTEX_COLUMNS'] = positionTexture.columnsLog
    bindTexture(gl, 0, positionTexture.texture)
    uniformObj['positionBuffer'] = 0
    bindTexture(gl, 1, normalTexture.texture)
    uniformObj['normalBuffer'] = 1
    bindTexture(gl, 2, bvhTexture.texture)
    uniformObj['bvhBuffer'] = 2
    bindTexture(gl, 3, uvTexture.texture)
    uniformObj['uvBuffer'] = 3
    getTextureImageFromMaterial(gl, allModels, 'sofa', 4)
    uniformObj['sofaTexture'] = 4
    getTextureImageFromMaterial(gl, allModels, 'table', 5)
    uniformObj['tableTexture'] = 5
    getTextureImageFromMaterial(gl, allModels, 'cabinet1', 6)
    uniformObj['cabitTexture1'] = 6
    getTextureImageFromMaterial(gl, allModels, 'cabinet2', 7)
    uniformObj['cabitTexture2'] = 7

    Object.keys(uniformObj).forEach((name) => {
      if (uniforms[name].type === gl.FLOAT) {
        gl.uniform1f(uniforms[name].location, uniformObj[name])
      }
      if (uniforms[name].type === gl.INT) {
        gl.uniform1i(uniforms[name].location, uniformObj[name])
      }
      if (uniforms[name].type === gl.FLOAT_MAT4) {
        gl.uniformMatrix4fv(uniforms[name].location, false, uniformObj[name])
      }
      if (uniforms[name].type === gl.SAMPLER_2D) {
        gl.uniform1i(uniforms[name].location, uniformObj[name])
      }
    })
  }
}

function getTextureImageFromMaterial(gl, allModels, name, unit) {
  const model = allModels.find((item) => {
    return item.name === name
  })
  const image = model?.material?.map?.image
  if (image) {
    const texture = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGB8,
      image.width,
      image.height,
      0,
      gl.RGB,
      gl.UNSIGNED_BYTE,
      image
    )
  }
}

function bindTexture(gl, unit, texture) {
  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, texture)
}

function dealWithMaterial(allModels) {
  const useTextures = allModels.map((item) => {
    if (item.name === 'sofa') {
      return 1
    } else if (item.name === 'table') {
      return 2
    } else if (item.name === 'cabinet1') {
      return 3
    } else if (item.name === 'cabinet2') {
      return 4
    }
  })
  let colorAndMaterialTypes = []
  //materialType 1是光源，2非光源
  allModels.forEach((item) => {
    let arr
    if (['sofa', 'table', 'cabinet1', 'cabinet2'].includes(item.name)) {
      arr = [0, 0, 0, 2]
    } else {
      arr = [item.material.color.r, item.material.color.g, item.material.color.b, 2]
    }
    if (item.name === 'light') {
      arr[3] = 1
    }
    colorAndMaterialTypes = colorAndMaterialTypes.concat(...arr)
  })
  return {
    colorAndMaterialTypes,
    useTextures
  }
}

export function makeUniformBuffer(gl, program, blockName) {
  //返回结构体uniform的位置下标
  const blockIndex = gl.getUniformBlockIndex(program, blockName)
  //结构体uniform有两个元素，每个元素都是大小为8的数组，数组中每个值都是vec4，故大小是16*8*2=256
  const blockSize = gl.getActiveUniformBlockParameter(
    program,
    blockIndex,
    gl.UNIFORM_BLOCK_DATA_SIZE
  )
  //获取结构体中每个元素的大小，偏移等数据
  const structUniforms = getUniformBlockInfo(gl, program, blockIndex)

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.UNIFORM_BUFFER, buffer)
  gl.bufferData(gl.UNIFORM_BUFFER, blockSize, gl.STATIC_DRAW)

  const data = new DataView(new ArrayBuffer(blockSize))

  function set(name, value) {
    if (!structUniforms[name]) {
      // console.warn('No uniform property with name ', name);
      return
    }

    const { type, size, offset, stride } = structUniforms[name]

    switch (type) {
      case gl.FLOAT:
        setData(data, 'setFloat32', size, offset, stride, 1, value)
        break
      case gl.FLOAT_VEC2:
        setData(data, 'setFloat32', size, offset, stride, 2, value)
        break
      case gl.FLOAT_VEC3:
        setData(data, 'setFloat32', size, offset, stride, 3, value)
        break
      case gl.FLOAT_VEC4:
        setData(data, 'setFloat32', size, offset, stride, 4, value)
        break
      case gl.INT:
        setData(data, 'setInt32', size, offset, stride, 1, value)
        break
      case gl.INT_VEC2:
        setData(data, 'setInt32', size, offset, stride, 2, value)
        break
      case gl.INT_VEC3:
        setData(data, 'setInt32', size, offset, stride, 3, value)
        break
      case gl.INT_VEC4:
        setData(data, 'setInt32', size, offset, stride, 4, value)
        break
      case gl.BOOL:
        setData(data, 'setUint32', size, offset, stride, 1, value)
        break
      default:
        console.warn('UniformBuffer: Unsupported type')
    }
  }

  function bind(index) {
    gl.bindBuffer(gl.UNIFORM_BUFFER, buffer)
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, data)
    gl.bindBufferBase(gl.UNIFORM_BUFFER, index, buffer)
  }

  return {
    set, //将所有属于相同结构体的数据都塞入DataView实例中
    bind //将DataView示例中的数据上传给着色器
  }
}

function getUniformBlockInfo(gl, program, blockIndex) {
  //获取结构体uniform中每个元素的下标
  const indices = gl.getActiveUniformBlockParameter(
    program,
    blockIndex,
    gl.UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES
  )
  const offset = gl.getActiveUniforms(program, indices, gl.UNIFORM_OFFSET) //获取结构体uniform中每个元素的偏移量
  const stride = gl.getActiveUniforms(program, indices, gl.UNIFORM_ARRAY_STRIDE) //获取结构体uniform中每个元素占用空间大小
  //materialBuffer.glsl的Materials结构体中有两个uniform变量，且都是数组，数组大小为8。stride指的是数组中每个值的
  //空间大小都是16，offset指的是数组的偏移量，为0和16*8=128
  const structUniforms = {}
  for (let i = 0; i < indices.length; i++) {
    //这里获取的size是8，是数组长度
    const { name, type, size } = gl.getActiveUniform(program, indices[i])
    structUniforms[name] = {
      type,
      size,
      offset: offset[i],
      stride: stride[i]
    }
  }

  return structUniforms
}

function setData(dataView, setter, size, offset, stride, components, value) {
  const l = Math.min(value.length / components, size)
  for (let i = 0; i < l; i++) {
    for (let k = 0; k < components; k++) {
      dataView[setter](offset + i * stride + k * 4, value[components * i + k], true)
    }
  }
}
