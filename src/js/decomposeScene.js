//分解场景，将scene对象中的mesh对象挑出来
export function decomposeScene(scene) {
  const meshes = [];

  scene.traverse(child => {
    if (child.isMesh) {
      if (!child.geometry) {
        console.warn(child, 'must have a geometry property');
      }
      else if (!(child.material.isMeshStandardMaterial)) {
        console.warn(child, 'must use MeshStandardMaterial in order to be rendered.');
      } else {
        meshes.push(child);
      }
    }
  });

  return meshes
}
