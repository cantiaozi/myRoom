import { makeTexture } from './texture'
//需要将count个数据存到纹理中，计算需要columns*rows个像素的纹理，实际能存储的像素个数size比实际count要大
function textureDimensionsFromArray(count) {
  const columnsLog = Math.round(Math.log2(Math.sqrt(count)))
  const columns = 2 ** columnsLog
  const rows = Math.ceil(count / columns)
  return {
    columnsLog,
    columns,
    rows,
    size: rows * columns
  }
}

export function makeDataTexture(gl, dataArray, channels) {
  const textureDim = textureDimensionsFromArray(dataArray.length / channels)
  const texture = makeTexture(gl, {
    data: padArray(dataArray, channels * textureDim.size), //将实际的数据扩展成纹理总共能储存的大小，不足的用0补充
    width: textureDim.columns,
    height: textureDim.rows
  })
  return {
    texture,
    columnsLog: textureDim.columnsLog
  }
}

// expand array to the given length
function padArray(typedArray, length) {
  const newArray = new typedArray.constructor(length)
  newArray.set(typedArray)
  return newArray
}

export function createVertexToTexture(gl, geometry) {
 	const positionTexture = makeDataTexture(gl, geometry.getAttribute('position').array, 3)
	const normalTexture = makeDataTexture(gl, geometry.getAttribute('normal').array, 3)
	const uvTexture = makeDataTexture(gl, geometry.getAttribute('uv').array, 2)
}
