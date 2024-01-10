import {
    Scene,
    WebGLRenderer,
    PerspectiveCamera,
    BoxGeometry,
    MeshStandardMaterial,
    Mesh,
    DoubleSide,
    PlaneGeometry,
    Group
  } from 'three'
export default {
    createWall() { 
        const materialKinds = {
            front: new MeshStandardMaterial({ color: 0x00ff00, side: DoubleSide }),
            back: new MeshStandardMaterial({ color: 0x00ff00, side: DoubleSide }),
            left: new MeshStandardMaterial({ color: 0x887799, side: DoubleSide }),
            right: new MeshStandardMaterial({ color: 0xaabbff, side: DoubleSide }),
            top: new MeshStandardMaterial({ color: 0xff0000, side: DoubleSide }),
            bottom: new MeshStandardMaterial({ color: 0xff0000, side: DoubleSide }),
        }
        
        let geometry = new PlaneGeometry( 4, 2 );
        const group = new Group();
        //前面
        // const frontWall = new Mesh(geometry, materialKinds.front)
        // frontWall.translateZ(2)
        //后面
        const backWall = new Mesh(geometry, materialKinds.back)
        backWall.translateZ(-2)
        //left
        const leftWall = new Mesh(geometry, materialKinds.left)
        leftWall.translateX(-2)//先执行平移操作后执行旋转操作，则平移矩阵*旋转矩阵
        leftWall.rotateY(Math.PI/2)
        //right
        const rightWall = new Mesh(geometry, materialKinds.right)
        rightWall.translateX(2)
        rightWall.rotateY(Math.PI/2)

        geometry = new PlaneGeometry( 4, 4 );

        //top
        const topWall = new Mesh(geometry, materialKinds.top)
        topWall.translateY(1)
        topWall.rotateX(Math.PI/2)
        //bottom
        const bottomWall = new Mesh(geometry, materialKinds.bottom)
        bottomWall.translateY(-1)
        bottomWall.rotateX(Math.PI/2)
        bottomWall.receiveShadow = true
        // group.add( frontWall );
        // group.add( backWall );
        // group.add( leftWall );
        // group.add( rightWall );
        // group.add( topWall );
        // group.add( bottomWall );
        // return group
        return [
            // backWall, 
            leftWall, 
            rightWall, 
            topWall, 
            bottomWall
        ]
    }
    // createSphere() {
        
    // }
}