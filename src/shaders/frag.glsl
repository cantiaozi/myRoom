#version 300 es
precision mediump float;
layout(location = 0) out vec4 out_light;

#define PI 3.14159265359
#define TWOPI 6.28318530718
#define INVPI 0.31830988618
#define INVPI2 0.10132118364
#define EPS 0.0005
#define INF 1.0e6
#define NUM_BOUNCES 2//todo 2
#define NUM_SAMPLES 200//todo 32
#define STACK_SIZE 13//包围盒节点深度，即有20层 todo
#define NUM_MATERIALS 7 //todo:5个平面和4个加载的模型加一个光源

#define noTexture 0
  #define sofa 1
  #define table 2
  #define cabit1 3
  #define cabit2 4

in vec2 vCoord;

struct Ray {
	vec3 origin; 
  vec3 dir;
}
getRay(vec3 origin, vec3 direction) {
  return Ray(origin, normalize(direction));
}

const vec3 light_position = vec3(0, 0.98, 0);
const float light_size = 0.5;
const float light_area = light_size * light_size;//如果这个全局变量是“常量”的话，前面加一个const；如果不是“常量”的话，可以将这个变量转移到main函数中去
const vec3 light_normal = vec3(0, -1, 0);
const vec3 light_albedo = vec3(3, 3, 3);
int flat_idx;

struct Camera {
    float fov;//垂直视角一半的正切
    float aspect;
    mat4 matrixWorld;//相机坐标系变换到世界坐标系的矩阵
};
uniform Camera camera;
uniform int BVH_COLUMNS;
uniform int VERTEX_COLUMNS;
uniform sampler2D positionBuffer;
uniform sampler2D normalBuffer;
uniform sampler2D bvhBuffer;
uniform sampler2D uvBuffer;//顶点的纹理坐标
uniform sampler2D sofaTexture;
uniform sampler2D tableTexture;
uniform sampler2D cabitTexture1;
uniform sampler2D cabitTexture2;
uniform Materials {
  vec4 colorAndMaterialType[NUM_MATERIALS];
  // vec4 roughnessMetalnessNormalScale[NUM_MATERIALS];
  int usetexture[NUM_MATERIALS];
} materials;

struct Box {
  vec3 min;
  vec3 max;
};
struct Triangle {
  vec3 v0;
  vec3 v1;
  vec3 v2;
};
struct SurfaceInteraction {
    bool hit;
    float t;
    vec3 position;
    vec3 normal; // smoothed normal from the three triangle vertices
    vec3 faceNormal; // normal of the triangle
    vec3 color;
    // float roughness;
    // float metalness;
    int materialType;//1是光源，2是非光源
    int materialIndex;
};

// float seed = 1.0;
int seed;//todo
//生成随机数
float random(float x){
    return fract(sin(x)*12561.1516);//不一定非要是12561.1516，只要是很大的一个数就行
}
// vec2 get_random2() {
//     float first = random(seed);
//     seed += 1.0;
//     float second = random(seed);
//     seed += 1.0;
//     return vec2(first, second);
// }
void encrypt_tea(inout uvec2 arg)
{
	uvec4 key = uvec4(0xa341316c, 0xc8013ea4, 0xad90777d, 0x7e95761e);
	uint v0 = arg[0], v1 = arg[1];
	uint sum = 0u;
	uint delta = 0x9e3779b9u;

	for(int i = 0; i < 32; i++) {
		sum += delta;
		v0 += ((v1 << 4) + key[0]) ^ (v1 + sum) ^ ((v1 >> 5) + key[1]);
		v1 += ((v0 << 4) + key[2]) ^ (v0 + sum) ^ ((v0 >> 5) + key[3]);
	}
	arg[0] = v0;
	arg[1] = v1;
}
vec2 get_random2()
{
  	uvec2 arg = uvec2(flat_idx, seed++);
  	encrypt_tea(arg);
  	return fract(vec2(arg) / vec2(0xffffffffu));
}

//返回向量的三个分量哪个最大，0，1，2分别代表x，y，z轴分量最大
int maxDimension(vec3 v) {
  return v.x > v.y ? (v.x > v.z ? 0 : 2) : (v.y > v.z ? 1 : 2);
}

//i是像素从左到右，从上到下的排列顺序的下标，将i转换成像素坐标
  // given the index from a 1D array, retrieve corresponding position from packed 2D texture
ivec2 unpackTexel(int i, int columnsLog2) {
    ivec2 u;
    u.y = i >> columnsLog2; // equivalent to (i / 2^columnsLog2)
    //取余
    u.x = i - (u.y << columnsLog2); // equivalent to (i % 2^columnsLog2)
    return u;
}

vec4 fetchData(sampler2D s, int i, int columnsLog2) {
    return texelFetch(s, unpackTexel(i, columnsLog2), 0);
}

float getMatType(int materialIndex) {
  return materials.colorAndMaterialType[materialIndex].w;
}
vec3 getMatColor(int materialIndex, vec2 uv) {
    int usetexture = materials.usetexture[materialIndex];
    vec3 color;
    if(usetexture == noTexture) {
      color = materials.colorAndMaterialType[materialIndex].rgb;
    } else if(usetexture == sofa) {
      color = texture(sofaTexture, uv).rgb;
    } else if(usetexture == table) {
      color = texture(tableTexture, uv).rgb;
    } else if(usetexture == cabit1) {
      color = texture(cabitTexture1, uv).rgb;
    } else if(usetexture == cabit2) {
      color = texture(cabitTexture2, uv).rgb;
    }
    return color;
}

mat3 construct_ONB_frisvad(vec3 normal)
{
	mat3 ret;
	ret[1] = normal;
	if(normal.z < -0.999805696) {
		ret[0] = vec3(0.0, -1.0, 0.0);
		ret[2] = vec3(-1.0, 0.0, 0.0);
	}
	else {
		float a = 1.0 / (1.0 + normal.z);
		float b = -normal.x * normal.y * a;
		ret[0] = vec3(1.0 - normal.x * normal.x * a, b, -normal.x);
		ret[2] = vec3(b, 1.0 - normal.y * normal.y * a, -normal.y);
	}
	return ret;
}

//采样光源上的点
vec3 sample_light(vec2 rng)
{
	return light_position + vec3(rng.x - 0.5, 0, rng.y - 0.5) * light_size;
}
vec2 sample_disk(vec2 uv)
{
	float theta = 2.0 * 3.141592653589 * uv.x;
	float r = sqrt(uv.y);
	return vec2(cos(theta), sin(theta)) * r;
}

vec3 sample_cos_hemisphere(vec2 uv)
{
	vec2 disk = sample_disk(uv);
	return vec3(disk.x, sqrt(max(0.0, 1.0 - dot(disk, disk))), disk.y);
}

//判断光线是否和box包围盒相交
float intersectBox(Ray r, Box b) {
    vec3 invD = 1.0/r.dir;
    vec3 tBot = (b.min - r.origin) * invD;
    vec3 tTop = (b.max - r.origin) * invD;
    vec3 tNear = min(tBot, tTop);
    vec3 tFar = max(tBot, tTop);
    float t0 = max(tNear.x, max(tNear.y, tNear.z));
    float t1 = min(tFar.x, min(tFar.y, tFar.z));

    return (t0 > t1 || t0 > INF) ? -1.0 : (t0 > 0.0 ? t0 : t1);
}

float tripleProduct(vec3 a, vec3 b, vec3 c)
{
    return dot(a, cross(b, c));
}
bool intersectTriangle(Ray ray, Triangle triangle, inout float min_t, out vec3 barycentric)
{   
    vec3 pos = ray.origin;
    vec3 dir = ray.dir;
    vec3 v0 = triangle.v0;
    vec3 v1 = triangle.v1;
    vec3 v2 = triangle.v2;
    vec3 e1 = v1 - v0;
    vec3 e2 = v2 - v0;
    vec3 s = pos - v0;
    vec3 s1 = cross(dir, e2);
    vec3 s2 = cross(s, e1);
    float inv = 1.0 / dot(s1, e1);
    float t = dot(s2, e2) * inv;
    float b1 = dot(s1, s) * inv;
    float b2 = dot(s2, dir) * inv;
    float b0 = 1.0 - b1 -b2;
    if(b0 > 0.0 && b0 < 1.0 && b1 > 0.0 && b1 < 1.0 && b2 > 0.0 && b2 < 1.0) {
        if(t < min_t) {//取最近的交点
            min_t = t;
            barycentric = vec3(b0, b1, b2);
            return true;
        }
    }
    // if(tripleProduct(v0 - pos, v1 - pos, dir) < 0.0 && tripleProduct(v1 - pos, v2 - pos, dir) < 0.0 && tripleProduct(v2 - pos, v0 - pos, dir) < 0.0)
    // {
    //     //光线与三角形所在平面求交公式
    //     vec3 normal = normalize(cross(v1 - v0, v2 - v0));
    //     float t = -dot(pos - v0, normal) / dot(dir, normal);
    //     if(t < min_t)
    //     {
    //         min_t = t;
    //     }
    //     return true;
    // }
    return false;
}

//获取光线与三角形相交点的各种参数，交点坐标，交点法向量，交点颜色金属性粗糙度等
void surfaceInteractionFromBVH(inout SurfaceInteraction si, Triangle tri, vec3 barycentric, ivec3 index, vec3 faceNormal, int materialIndex, float t) {
  si.hit = true;
  si.t = t;
  si.faceNormal = normalize(faceNormal);
  si.position = barycentric.x * tri.v0 + barycentric.y * tri.v1 + barycentric.z * tri.v2;
  ivec2 i0 = unpackTexel(index.x, VERTEX_COLUMNS);
  ivec2 i1 = unpackTexel(index.y, VERTEX_COLUMNS);
  ivec2 i2 = unpackTexel(index.z, VERTEX_COLUMNS);

  vec3 n0 = texelFetch(normalBuffer, i0, 0).xyz;
  vec3 n1 = texelFetch(normalBuffer, i1, 0).xyz;
  vec3 n2 = texelFetch(normalBuffer, i2, 0).xyz;
  vec3 normal = normalize(barycentric.x * n0 + barycentric.y * n1 + barycentric.z * n2);

  vec2 uv0 = texelFetch(uvBuffer, i0, 0).xy;
  vec2 uv1 = texelFetch(uvBuffer, i1, 0).xy;
  vec2 uv2 = texelFetch(uvBuffer, i2, 0).xy;
  vec2 uv = barycentric.x * uv0 + barycentric.y * uv1 + barycentric.z * uv2;

  si.materialType = int(getMatType(materialIndex));
  si.color = getMatColor(materialIndex, uv);
  si.materialIndex = materialIndex;
//   si.roughness = getMatRoughness(materialIndex, uv);
//   si.metalness = getMatMetalness(materialIndex, uv);

  si.normal = normalize(normal);
}

bool intersect(Ray ray, out SurfaceInteraction si) {
  si.hit = false;
  float t = INF;
  int nodesToVisit[STACK_SIZE];
  int stack = 0;

  nodesToVisit[0] = 0;

  while(stack >= 0) {
    int i = nodesToVisit[stack--];//i是像素排列的下标
    //r1和r2是一个包围盒的2个点max和min
    vec4 r1 = fetchData(bvhBuffer, i, BVH_COLUMNS);
    vec4 r2 = fetchData(bvhBuffer, i + 1, BVH_COLUMNS);
    //按照字节存储的表示转换成整数，当是NAN时，转换后就不会>= 0，表明这是一个三角形而不是包围盒
    int splitAxisOrNumPrimitives = floatBitsToInt(r1.w);

    if (splitAxisOrNumPrimitives >= 0) {
      int splitAxis = splitAxisOrNumPrimitives;

      Box bbox = Box(r1.xyz, r2.xyz);

      if (intersectBox(ray, bbox) > 0.0) {//光线与包围盒相交
        //当光线在划分轴方向大于0则从左子节点开始找，因为左子节点如果有交点肯定是较近的交点
        if (ray.dir[splitAxis] > 0.0) {
          nodesToVisit[++stack] = floatBitsToInt(r2.w);//该包围盒右子节点的像素下标
          //每个包围盒和三角形都要2个像素存储，所以加2就是该包围盒左子节点的像素位置
          nodesToVisit[++stack] = i + 2;
        } else {
          nodesToVisit[++stack] = i + 2;
          nodesToVisit[++stack] = floatBitsToInt(r2.w);
        }
      }
    } else {
      ivec3 index = floatBitsToInt(r1.xyz);//三角形存储的是顶点的下标，即positionBuffer中顶点的像素下标
      Triangle tri = Triangle(
        fetchData(positionBuffer, index.x, VERTEX_COLUMNS).xyz,
        fetchData(positionBuffer, index.y, VERTEX_COLUMNS).xyz,
        fetchData(positionBuffer, index.z, VERTEX_COLUMNS).xyz
      );
      vec3 barycentric;
      //当与三角形有交点且交点比当前的交点要近的话则更新相交si信息
      if (intersectTriangle(ray, tri, t, barycentric)) {
        // ray.tMax = hit.t;
        int materialIndex = floatBitsToInt(r2.w);
        vec3 faceNormal = r2.xyz;
        surfaceInteractionFromBVH(si, tri, barycentric, index, faceNormal, materialIndex, t);
      }
    }
  }

  return si.hit;
}

bool
test_visibility(vec3 p1, vec3 p2)
{
	const float eps = 1e-5;

	Ray r = getRay(p1, p2 - p1);
	r.origin += eps * r.dir;

    SurfaceInteraction si;
	bool hit = intersect(r, si);

	return hit &&  (si.t < distance(p1, p2) - 2.0 * eps);
}

vec3 pt_mis(Ray ray) {
	vec3 contrib = vec3(0);
	vec3 tp = vec3(1.0);

    SurfaceInteraction si;
	bool hit = intersect(ray, si);
    // vec3 position, normal;
	// vec4 albedo;
  // return vec3(hit ? 1 : 0, 1, 0);//todo

	if(!hit)
		return vec3(0.0);
    //从像素发出的光线如果打到光源上，该像素直接展示光源的颜色
	if(si.materialType == 1) {
		return si.color;
	}

	for(int i = 0; i < NUM_BOUNCES; i++) {
		mat3 onb = construct_ONB_frisvad(si.normal);//类似于tbn矩阵，可以将局部坐标系转化为世界坐标系

		{ /* NEE */
			vec3 pos_ls = sample_light(get_random2());
      // return si.normal;//todo
			vec3 l_nee = pos_ls - si.position;
			float rr_nee = dot(l_nee, l_nee);//光源到着色点距离的平方
			l_nee /= sqrt(rr_nee);//单位向量
			float G = max(0.0, dot(si.normal, l_nee)) * max(0.0, -dot(l_nee, light_normal)) / rr_nee;
      // return vec3(G, 1, 0);

			if(G > 0.0) {
        // return vec3(0.5, 1, 0);
				// float light_pdf = 1.0 / (light_area * G);
        float light_pdf = light_area / G;
				float brdf_pdf = 1.0 / PI;

				// float w = light_pdf / (light_pdf + brdf_pdf);

				vec3 brdf = si.color / PI;

				if(!test_visibility(si.position, pos_ls)) {
					vec3 Le = light_albedo;
                    //光源上采样的pdf应该是1/area，这里为什么是area
					contrib += tp * (Le * brdf) / light_pdf;
				}
			}
		}
		
		{ /* brdf */
			vec3 dir = onb * sample_cos_hemisphere(get_random2());

			vec3 brdf = si.color / PI;

			Ray ray_next = getRay(si.position, dir);
			ray_next.origin += ray_next.dir * 1e-5;

      SurfaceInteraction next_si;
			bool hit = intersect(ray_next, next_si);

			if(hit == false)
				break;

			float brdf_pdf = 1.0 / TWOPI;
            //这部分计算的是间接光照，如果直接打到光源上直接忽略，效果几乎差不多
			if(next_si.materialType == 1) { /* hit light_source */
				float G = max(0.0, dot(ray_next.dir, si.normal)) * max(0.0, -dot(ray_next.dir, next_si.normal)) / (next_si.t * next_si.t);
				if(G <= 0.0) /* hit back side of light source */
					break;

				float light_pdf = 1.0 / (light_area * G);

				// float w = brdf_pdf / (light_pdf + brdf_pdf);

				vec3 Le = light_albedo;
				contrib += tp * (Le * brdf) / brdf_pdf;

				break;
			}
            //这里应该乘以一个dot(ray_next.dir, normal)，效果一样
			tp *= brdf / brdf_pdf;
      si = next_si;
		}
	}

	return contrib;
}

void main() {
    flat_idx = int(dot(gl_FragCoord.xy, vec2(1, 4096)));
    seed = 0;
    vec3 s = vec3(0);
    float heightScale = 2.0 * camera.fov;
    float widthScale = 2.0 * camera.fov * camera.aspect;
    vec2 screenPoint = vec2((vCoord.x - 0.5)*widthScale, (vCoord.y - 0.5)*heightScale);//相机坐标系下的光线方向
    vec3 origin = vec3(0, 0, 0);
    origin = (camera.matrixWorld * vec4(origin, 1.0)).xyz;

    vec3 target;

    for(int i = 0; i < NUM_SAMPLES; i++) {
      vec2 r = get_random2();
          //这个方向是在相机坐标系下的方向，需要转换成世界坐标系，但是因为相机坐标系和世界坐标系的转换仅仅
          //涉及到平移，所以对于方向向量没有影响，因此这个也是在世界坐标系下的方向
      vec3 direction = vec3(screenPoint + r.x * dFdx(screenPoint) + r.y * dFdy(screenPoint), -1);
          direction = (camera.matrixWorld * vec4(direction, 0.0)).xyz;
      Ray ray = getRay(origin, direction);
      vec3 c = pt_mis(ray);
      s += c;
      target = direction;//todo
    }
  // out_light = vec4(s, 1.0);
	out_light = vec4(pow(s / float(NUM_SAMPLES), vec3(1.0 / 2.2)), 1.0);
  // out_light = vec4(vCoord, 0, 1.0);
  // out_light = vec4(-1, 1, 1, 1);
}