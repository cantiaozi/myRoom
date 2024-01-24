# MyRoom

这是一个光线追踪渲染的房间，目前只有一个桌子.项目用webgl+threejs开发。
![image](https://github.com/cantiaozi/myRoom/assets/30336438/2cdc9a60-ae10-46ee-854f-3ca96907e7b1)

技术要点有：
➢ 使用光线追踪算法渲染场景
➢ 编写顶点着色器和片元着色器，基于屏幕空间的方法进行渲染
➢ 构建 BVH 加速结构，加速寻找光线与场景模型交点
➢ 将模型的相关顶点、法线和uv数据写入到纹理中传递给着色器
➢ 使用threejs生成平面等基础模型以及计算相机矩阵
