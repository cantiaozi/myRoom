// Create a bounding volume hierarchy of scene geometry
// Uses the surface area heuristic (SAH) algorithm for efficient partitioning
// http://www.pbr-book.org/3ed-2018/Primitives_and_Intersection_Acceleration/Bounding_Volume_Hierarchies.html

import { Box3, Vector3 }  from 'three';
import { partition, nthElement } from './bvhUtil';

const size = new Vector3();

export function bvhAccel(geometry) {
  const primitiveInfo = makePrimitiveInfo(geometry);//为每个三角形生成一个包围盒，返回所有的包围盒
  //将所有三角形的包围盒进行划分，生成一个树结构
  const node = recursiveBuild(primitiveInfo, 0, primitiveInfo.length);
  //最后返回的叶子节点中都只包含一个三角形
  return node;
}

export function flattenBvh(bvh) {
  const flat = [];
  const isBounds = [];

  const splitAxisMap = {
    x: 0,
    y: 1,
    z: 2
  };

  let maxDepth = 1;
  const traverse = (node, depth = 1) => {

    maxDepth = Math.max(depth, maxDepth);
    //有primitives属性说明是叶子节点
    if (node.primitives) {
      for (let i = 0; i < node.primitives.length; i++) {
        const p = node.primitives[i];
        flat.push(
          p.indices[0], p.indices[1], p.indices[2], node.primitives.length,
          p.faceNormal.x, p.faceNormal.y, p.faceNormal.z, p.materialIndex
        );
        isBounds.push(false);
      }
    } else {
      const bounds = node.bounds;
      //将包围盒的右上和坐下两个点的坐标存入flat中
      flat.push(
        bounds.min.x, bounds.min.y, bounds.min.z, splitAxisMap[node.splitAxis],
        bounds.max.x, bounds.max.y, bounds.max.z, null // pointer to second shild
      );

      const i = flat.length - 1;
      isBounds.push(true);

      traverse(node.child0, depth + 1);
      //每个包围盒和三角形都有8个数据，要两个像素存储，这个树结构是深度遍历，
      //m=flat.length / 4表示一共存储了m个像素点，因此m表示该包围盒的右子节点在像素中的下标。
      //每个包围盒的左子节点都是在该包围盒的下一个像素
      flat[i] = flat.length / 4; // pointer to second child
      traverse(node.child1, depth + 1);
    }
  };

  traverse(bvh);
  //floatView和intView同用一块buffer空间，修改其中一个的值会影响另一个的值
  //flat中有整数，有小数，整数需要存到intView中，floatView会将相应的子节表示
  //转换成浮点数，在着色器中将浮点数转换成整数就是正真的需要寸的整数了
  const buffer = new ArrayBuffer(4 * flat.length);
  const floatView = new Float32Array(buffer);
  const intView = new Int32Array(buffer);

  for (let i = 0; i < isBounds.length; i++) {
    let k = 8 * i;

    if (isBounds[i]) {
      floatView[k] = flat[k];
      floatView[k + 1] = flat[k + 1];
      floatView[k + 2] = flat[k + 2];
      //这个数据是个整数，存到intView中，floatView会将相应整数的子节表示转化成浮点数
      intView[k + 3] = flat[k + 3];
    } else {
      intView[k] = flat[k];
      intView[k + 1] = flat[k + 1];
      intView[k + 2] = flat[k + 2];
      //这里的flat[k + 3]是 node.primitives.length，取负数会使floatView中相应位置的数据为NAN
      intView[k + 3] = -flat[k + 3]; // negative signals to shader that this node is a triangle
    }

    floatView[k + 4] = flat[k + 4];
    floatView[k + 5] = flat[k + 5];
    floatView[k + 6] = flat[k + 6];
    intView[k + 7] = flat[k + 7];
  }

  return {
    maxDepth,
    count: flat.length / 4,
    buffer: floatView
  };
}
//geometry是场景所有顶点、法向量等数据的集合
//计算所有三角形面的包围盒并存储在数组中，返回这个数组
function makePrimitiveInfo(geometry) {
  const primitiveInfo = [];
  const indices = geometry.getIndex().array;
  const position = geometry.getAttribute('position');
  const materialMeshIndex = geometry.getAttribute('materialMeshIndex');

  const v0 = new Vector3();
  const v1 = new Vector3();
  const v2 = new Vector3();
  const e0 = new Vector3();
  const e1 = new Vector3();

  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i];
    const i1 = indices[i + 1];
    const i2 = indices[i + 2];

    const bounds = new Box3();

    v0.fromBufferAttribute(position, i0);
    v1.fromBufferAttribute(position, i1);
    v2.fromBufferAttribute(position, i2);
    //将e0设置成v2-v0
    e0.subVectors(v2, v0);
    e1.subVectors(v1, v0);
    //入参是一个点，根据参数计算包围盒的边界，包围盒必须包含该点
    bounds.expandByPoint(v0);
    bounds.expandByPoint(v1);
    bounds.expandByPoint(v2);

    const info = {
      bounds: bounds,
      center: bounds.getCenter(new Vector3()),//计算包围盒的中心
      indices: [i0, i1, i2],
      faceNormal: new Vector3().crossVectors(e1, e0).normalize(),
      materialIndex: materialMeshIndex.getX(i0)
    };

    primitiveInfo.push(info);
  }

  return primitiveInfo;
}

function recursiveBuild(primitiveInfo, start, end) {
  const bounds = new Box3();
  for (let i = start; i < end; i++) {
    //参数也是一个box3对象，扩大bounds以包含box3
    bounds.union(primitiveInfo[i].bounds);
  }

  const nPrimitives = end - start;

  if (nPrimitives === 1) {
    return makeLeafNode(primitiveInfo.slice(start, end), bounds);
  } else {
    //生成一个包含所有最低层级盒子中心的盒子
    const centroidBounds = new Box3();
    for (let i = start; i < end; i++) {
      centroidBounds.expandByPoint(primitiveInfo[i].center);
    }
    //计算盒子的维度，即整个模型在哪个轴方向上分布最多，现在这个轴上划分，以尽可能保证划分后
    //的子盒子是个立方体
    const dim = maximumExtent(centroidBounds);


    let mid = Math.floor((start + end) / 2);

    // middle split method
    // const dimMid = (centroidBounds.max[dim] + centroidBounds.min[dim]) / 2;
    // mid = partition(primitiveInfo, p => p.center[dim] < dimMid, start, end);

    // if (mid === start || mid === end) {
    //   mid = Math.floor((start + end) / 2);
    //   nthElement(primitiveInfo, (a, b) => a.center[dim] < b.center[dim], start, end, mid);
    // }

    // surface area heuristic method
    if (nPrimitives <= 4) {
      nthElement(primitiveInfo, (a, b) => a.center[dim] < b.center[dim], start, end, mid);
    } else if (centroidBounds.max[dim] === centroidBounds.min[dim]) {
      // can't split primitives based on centroid bounds. terminate.
      return makeLeafNode(primitiveInfo.slice(start, end), bounds);
    } else {
      //划分成12个子包围盒
      const buckets = [];
      for (let i = 0; i < 12; i++) {
        buckets.push({
          bounds: new Box3(),
          count: 0,
        });
      }

      for (let i = start; i < end; i++) {
        //根据最底层包围盒a的中心到centroidBounds包围盒min的距离占比来决定将a划分到哪个上层包围盒中
        //例如在x维度上划分，a中心的x到centroidBounds的min的x的差值为3，centroidBounds的min和max
        //的x差值为4，则floor(12*3/4)为9，则将a划分到第9个盒子中去
        let b = Math.floor(buckets.length * boxOffset(centroidBounds, dim, primitiveInfo[i].center));
        if (b === buckets.length) {
          b = buckets.length - 1;
        }
        buckets[b].count++;
        buckets[b].bounds.union(primitiveInfo[i].bounds);
      }

      const cost = [];

      for (let i = 0; i < buckets.length - 1; i++) {
        const b0 = new Box3();
        const b1 = new Box3();
        let count0 = 0;
        let count1 = 0;
        for (let j = 0; j <= i; j++) {
          b0.union(buckets[j].bounds);
          count0 += buckets[j].count;
        }
        for (let j = i + 1; j < buckets.length; j++) {
          b1.union(buckets[j].bounds);
          count1 += buckets[j].count;
        }
        //surfaceArea获取包围盒的表面积
        cost.push(0.1 + (count0 * surfaceArea(b0) + count1 * surfaceArea(b1)) / surfaceArea(bounds));
      }
      //找出cost中的最小值及最小值在数组中的下标，minCost为最小值，minCostSplitBucket为下标
      let minCost = cost[0];
      let minCostSplitBucket = 0;
      for (let i = 1; i < cost.length; i++) {
        if (cost[i] < minCost) {
          minCost = cost[i];
          minCostSplitBucket = i;
        }
      }

      mid = partition(primitiveInfo, p => {
        let b = Math.floor(buckets.length * boxOffset(centroidBounds, dim, p.center));
        if (b === buckets.length) {
          b = buckets.length - 1;
        }
        return b <= minCostSplitBucket;
      }, start, end);
    }

    return makeInteriorNode(
      dim,
      recursiveBuild(primitiveInfo, start, mid),
      recursiveBuild(primitiveInfo, mid, end),
    );
  }
}

function makeLeafNode(primitives, bounds) {
  return {
    primitives,
    bounds
  };
}

function makeInteriorNode(splitAxis, child0, child1) {
  return {
    child0,
    child1,
    bounds: new Box3().union(child0.bounds).union(child1.bounds),
    splitAxis,
  };
}

function maximumExtent(box3) {
  box3.getSize(size);//返回盒子的长宽深，将结果保存在size中
  if (size.x > size.z) {
    return size.x > size.y ? 'x' : 'y';
  } else {
    return size.z > size.y ? 'z' : 'y';
  }
}

function boxOffset(box3, dim, v) {
  let offset = v[dim] - box3.min[dim];

  if (box3.max[dim] > box3.min[dim]){
    offset /= box3.max[dim] - box3.min[dim];
  }

  return offset;
}

function surfaceArea(box3) {
  box3.getSize(size);
  return 2 * (size.x * size.z + size.x * size.y + size.z * size.y);
}
