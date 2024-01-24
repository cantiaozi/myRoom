import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { Group } from 'three'
//优化点 glb模型过大时，可以使用blender将模型进行draco压缩。
const loadModel = async (url) => {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader()
    loader.load(
      // resource URL
      url,
      // called when the resource is loaded
      function (gltf) {
        resolve(gltf)
      },
      // called while loading is progressing
      function (xhr) {
        console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
      },
      // called when loading has errors
      function () {
        console.log('An error happened')
        reject()
      }
    )
  })
}

export const loadTable = async (scene, loadModelStatus) => {
  const table = await loadModel('static/model/table.glb')
  table.scene.traverse((child) => {
    if (child.isMesh) {
      if (!child.geometry) {
        console.warn(child, 'must have a geometry property')
      } else if (!child.material.isMeshStandardMaterial) {
        console.warn(child, 'must use MeshStandardMaterial in order to be rendered.')
      } else {
        // meshes.push(child);
        // child.translateX(-1.4)
        // child.translateZ(-1.5)
        child.translateY(-0.41)
        child.rotateY(Math.PI / 2)
        child.rotateX(-Math.PI / 2)
        child.scale.set(0.05, 0.05, 0.05)
        child.castShadow = true
        child.name = 'table'
        scene.push(child)
      }
    }
  })
  loadModelStatus.value.tableStatus = true
}

export const loadSofa = async (scene, loadModelStatus) => {
  const table = await loadModel('static/model/sofa.glb')
  table.scene.traverse((child) => {
    if (child.isMesh) {
      if (!child.geometry) {
        console.warn(child, 'must have a geometry property')
      } else if (!child.material.isMeshStandardMaterial) {
        console.warn(child, 'must use MeshStandardMaterial in order to be rendered.')
      } else {
        // meshes.push(child);
        child.translateX(1.6)
        // child.translateZ(-1.5)
        child.translateY(-1)
        child.rotateY(-Math.PI / 2)
        child.rotateX(-Math.PI / 2)
        child.scale.set(0.0008, 0.0008, 0.0008)
        child.name = 'sofa'
        scene.push(child)
      }
    }
  })
  loadModelStatus.value.sofaStatus = true
}

export const loadCabinet = async (scene, loadModelStatus) => {
  const table = await loadModel('static/model/cabinet.glb')
  let index = 1;
  table.scene.traverse((child) => {
    if (child.isMesh) {
      if (!child.geometry) {
        console.warn(child, 'must have a geometry property')
      } else if (!child.material.isMeshStandardMaterial) {
        console.warn(child, 'must use MeshStandardMaterial in order to be rendered.')
      } else {
        // meshes.push(child);
        child.translateX(-1)
        child.translateZ(-1.55)
        child.translateY(-0.32)
        child.rotateY(-Math.PI / 2)
        // child.rotateX(-Math.PI / 2)
        child.scale.set(0.5, 0.5, 0.5)
        child.name = 'cabinet' + index
        index++
        scene.push(child)
      }
    }
  })
  loadModelStatus.value.cabinetStatus = true
}