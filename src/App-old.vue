<template>
  <!-- <header>
    <img alt="Vue logo" class="logo" src="@/assets/logo.svg" width="125" height="125" />

    <div class="wrapper">
      <HelloWorld msg="You did it!" />

      <nav>
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/about">About</RouterLink>
      </nav>
    </div>
  </header>

  <RouterView /> -->
  <div ref="canvas" class="scene">
    <!-- <canvas ref="canvas"></canvas> -->
  </div>
</template>

<script setup>
//three的坐标系和webgl的应该是一样的，都是z轴正方向朝向屏幕外的
import { ref, onMounted, computed } from 'vue'
import {
  Scene,
  WebGLRenderer,
  PerspectiveCamera,
  AmbientLight,
  PointLight,
  PCFSoftShadowMap,
  BoxGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Mesh,
  DoubleSide,
  PlaneGeometry
} from 'three'

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import createMesh from './js/createMesh.js'
import { loadTable, loadSofa, loadCabinet } from './js/loadModel'
import { mergeMeshesToGeometry } from './js/mergeMeshesToGeometry'
import { createVertexToTexture } from './js/createTexture'
import { bvhAccel, flattenBvh } from './js/accelBvh'
import { initWebgl } from './js/initWebgl'
// canvas 容器
const canvas = ref()
const scene = new Scene()
const allModels = []

const walls = createMesh.createWall()
const ambientLight = new AmbientLight( 0x404040, 5.0); // 柔和的白光
scene.add( ambientLight )
const light = new PointLight( 0xffffff, 4, 100 );
light.position.set( 1, 0.9, 0.5 );
light.castShadow = true
// scene.add( light );
allModels.push(...walls)
const loadModelStatus = ref({
  tableStatus: false,
  sofaStatus: false,
  cabinetStatus: false
})
const allModelStatus = computed(() => {
  return loadModelStatus.value.tableStatus && loadModelStatus.value.sofaStatus && loadModelStatus.value.cabinetStatus
})
loadTable(allModels, loadModelStatus)
loadSofa(allModels, loadModelStatus)
loadCabinet(allModels, loadModelStatus)
const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(0,0,0.5)//为了确保OrbitControls工作，position不能设置成原点
camera.lookAt(0, 0, -1)
camera.up.set(0, 1, 0)

let renderer = new WebGLRenderer()
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap
renderer.setSize(window.innerWidth, window.innerHeight)
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

const controls = new OrbitControls(camera, renderer.domElement);
// 如果OrbitControls改变了相机参数，重新调用渲染器渲染三维场景
controls.addEventListener('change', function () {
    renderer.render(scene, camera); //执行渲染操作
});//监听鼠标、键盘事件

const addMeshToScene = (mergedGeometry) => {
  const material = new MeshStandardMaterial({ color: 0x00ff00, side: DoubleSide })
  const mesh = new Mesh(mergedGeometry, material)
  scene.add(mesh)
}

onMounted(() => {
  const animate = () => {
    requestAnimationFrame( animate );
    // const meshes = decomposeScene(allModels)
    const mergedGeometry = mergeMeshesToGeometry(allModels)
    const bvhNodes = bvhAccel(mergedGeometry.geometry)
    const flatBvh = flattenBvh(bvhNodes);
    // createVertexToTexture(mergedGeometry)
    addMeshToScene(mergedGeometry.geometry)
    renderer.render( scene, camera );
  }
  canvas.value.appendChild(renderer.domElement)
  animate()
})
</script>

<style scoped></style>