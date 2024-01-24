import { FileLoader } from 'three'
export async function initWebgl(params) {
  const canvas = params.canvas
  const gl = canvas.getContext('webgl2')
  gl.viewport(0, 0, canvas.width, canvas.height);
  await initShaders(gl)
  createVAO(gl)
  return gl
}

async function initShaders(gl) {
  // const vshader = await getShaderString('../shaders/vert.glsl');
  // const fshader = await getShaderString('../shaders/frag.glsl');
  const vshader = await getShaderString('src/shaders/vert.glsl');
  const fshader = await getShaderString('src/shaders/frag.glsl');
  var program = createProgram(gl, vshader, fshader)
  if (!program) {
    console.log('Failed to create program')
    return false
  }

  gl.useProgram(program)
  gl.program = program
}

function createProgram(gl, vshader, fshader) {
  // Create shader object
  var vertexShader = loadShader(gl, gl.VERTEX_SHADER, vshader)
  var fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fshader)
  if (!vertexShader || !fragmentShader) {
    return null
  }

  // Create a program object
  var program = gl.createProgram()
  if (!program) {
    return null
  }

  // Attach the shader objects
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)

  // Link the program object
  gl.linkProgram(program)

  // Check the result of linking
  var linked = gl.getProgramParameter(program, gl.LINK_STATUS)
  if (!linked) {
    var error = gl.getProgramInfoLog(program)
    console.log('Failed to link program: ' + error)
    gl.deleteProgram(program)
    gl.deleteShader(fragmentShader)
    gl.deleteShader(vertexShader)
    return null
  }
  return program
}

function loadShader(gl, type, source) {
  // Create shader object
  var shader = gl.createShader(type)
  if (shader == null) {
    console.log('unable to create shader')
    return null
  }

  // Set the shader program
  gl.shaderSource(shader, source)

  // Compile the shader
  gl.compileShader(shader)

  // Check the result of compilation
  var compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS)
  if (!compiled) {
    var error = gl.getShaderInfoLog(shader)
    console.log('Failed to compile shader: ' + error)
    gl.deleteShader(shader)
    return null
  }

  return shader
}

async function loadShaderFile(filename) {

  return new Promise((resolve) => {
      const loader = new FileLoader();

      loader.load(filename, (data) => {
          resolve(data);
      });
  });
}

async function getShaderString(filename) {

  let val = ''
  await loadShaderFile(filename).then(result => {
      val = result;
  });
  return val;
}

function createVAO(gl) {
  const vao = gl.createVertexArray();

  gl.bindVertexArray(vao);
  //上传顶点坐标和uv坐标 对应于2*2投影平面的6个顶点
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

  // vertex shader should set layout(location = 0) on position attribute
  const posLoc = 0

  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);

  function draw() {
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  gl.draw = draw
  return draw;
}