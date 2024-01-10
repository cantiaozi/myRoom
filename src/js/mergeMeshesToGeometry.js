import { BufferGeometry, BufferAttribute } from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
//将所有mesh的顶点、uv、法向量数据整合到一个BufferGeometry对象中
export function mergeMeshesToGeometry(meshes) {

  let vertexCount = 0;
  let indexCount = 0;

  const geometryAndMaterialIndex = [];
  const materialIndexMap = new Map();

  for (const mesh of meshes) {
    if (!mesh.visible) {
      continue;
    }

    const geometry = mesh.geometry.isBufferGeometry ?
      cloneBufferGeometry(mesh.geometry, ['position', 'normal', 'uv']) : // BufferGeometry object
      new BufferGeometry().fromGeometry(mesh.geometry); // Geometry object

    // const index = geometry.getIndex();
    // if (!index) {
    //   addFlatGeometryIndices(geometry);
    // }
    //将模型矩阵作用到顶点和法向量上改变顶点和法向量
    mesh.updateMatrixWorld()
    geometry.applyMatrix4(mesh.matrixWorld);

    if (!geometry.getAttribute('normal')) {
      geometry.computeVertexNormals();
    } else {
      geometry.normalizeNormals();
    }

    vertexCount += geometry.getAttribute('position').count;
    indexCount += geometry.getIndex().count;

    const material = mesh.material;
    let materialIndex = materialIndexMap.get(material);
    if (materialIndex === undefined) {
      materialIndex = materialIndexMap.size;
      materialIndexMap.set(material, materialIndex);
    }

    geometryAndMaterialIndex.push({
      geometry,
      materialIndex
    });
  }

  const geometry = mergeGeometry(geometryAndMaterialIndex, vertexCount, indexCount);


  return {
    geometry,
    materials: Array.from(materialIndexMap.keys())
  };
}
//将逐顶点相关的数据写入缓存中
function mergeGeometry(geometryAndMaterialIndex, vertexCount, indexCount) {
  const positionAttrib = new BufferAttribute(new Float32Array(3 * vertexCount), 3, false);
  const normalAttrib = new BufferAttribute(new Float32Array(3 * vertexCount), 3, false);
  const uvAttrib = new BufferAttribute(new Float32Array(2 * vertexCount), 2, false);
  //materialMeshIndexAttrib中存储的一个是materialIndex下标，一个是当前mesh的下标+1
  const materialMeshIndexAttrib = new BufferAttribute(new Int32Array(2 * vertexCount), 2, false);
  const indexAttrib = new BufferAttribute(new Uint32Array(indexCount), 1, false);

  const mergedGeometry = new BufferGeometry();
  ////将上面生成的BufferAttribute对象放到mergedGeometry的position属性中，BufferGeometry对象的BufferGeometry
  //属性存储了逐顶点相关的数据
  mergedGeometry.setAttribute('position', positionAttrib);
  mergedGeometry.setAttribute('normal', normalAttrib);
  mergedGeometry.setAttribute('uv', uvAttrib);
  // mergedGeometry.setAttribute('materialMeshIndex', materialMeshIndexAttrib);
  mergedGeometry.setIndex(indexAttrib);

  let currentVertex = 0;
  let currentIndex = 0;
  let currentMesh = 1;

  const bufferArrs = []
  geometryAndMaterialIndex.forEach(item => {
    bufferArrs.push(item.geometry)
  })
  const copy = BufferGeometryUtils.mergeGeometries(bufferArrs, false)
  mergedGeometry.copy(copy)
  mergedGeometry.setAttribute('materialMeshIndex', materialMeshIndexAttrib);

  for (const { geometry, materialIndex } of geometryAndMaterialIndex) {
    const vertexCount = geometry.getAttribute('position').count;
    //将每个mesh对象的顶点、法线和uv等数据都塞到mergedGeometry中去
    // mergedGeometry.clone(geometry, currentVertex);

    const meshIndex = geometry.getIndex();
    //所有mesh对象的顶点合并到一起后，需要重新计算顶点下标
    // for (let i = 0; i < meshIndex.count; i++) {
    //   indexAttrib.setX(currentIndex + i, currentVertex + meshIndex.getX(i));
    // }

    for (let i = 0; i < vertexCount; i++) {
      materialMeshIndexAttrib.setXY(currentVertex + i, materialIndex, currentMesh);
    }

    currentVertex += vertexCount;
    currentIndex += meshIndex.count;
    currentMesh++;
  }

  return mergedGeometry;
}
//生成一个BufferGeometry对象，将原来的bufferGeometry对象里面的顶点，法线，uv和顶点下标拷贝到新对象中
// Similar to buffergeometry.clone(), except we only copy
// specific attributes instead of everything
function cloneBufferGeometry(bufferGeometry, attributes) {
  const newGeometry = new BufferGeometry();

  for (const name of attributes) {
    const attrib = bufferGeometry.getAttribute(name);
    if (attrib) {
      newGeometry.setAttribute(name, attrib.clone());
    }
  }

  const index = bufferGeometry.getIndex();
  if (index) {
    newGeometry.setIndex(index);
  }

  return newGeometry;
}

