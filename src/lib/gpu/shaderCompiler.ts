import { useGpuStore, AppNode, LogicNodeData } from '@/store/useGpuStore';

// Common SDF math library in GLSL
const SDF_LIBRARY = `
#define MAX_STEPS 150
#define MAX_DIST 100.0
#define SURF_DIST 0.0005

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

// Primitives
float sdSphere(vec3 p, float s) {
    return length(p) - s;
}

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

float sdCylinder(vec3 p, vec3 c) {
  return length(p.xz-c.xy)-c.z;
}

// Booleans (vec4 layout: xyz = color, w = distance)
vec4 opUnion(vec4 d1, vec4 d2) {
    return d1.w < d2.w ? d1 : d2;
}
vec4 opSubtract(vec4 d1, vec4 d2) {
    float d = max(d1.w, -d2.w);
    vec3 col = d1.w > -d2.w ? d1.xyz : d2.xyz;
    return vec4(col, d);
}
vec4 opIntersect(vec4 d1, vec4 d2) {
    float d = max(d1.w, d2.w);
    vec3 col = d1.w > d2.w ? d1.xyz : d2.xyz;
    return vec4(col, d);
}
vec4 opSmoothUnion(vec4 d1, vec4 d2, float k) {
    float h = clamp( 0.5 + 0.5*(d2.w-d1.w)/k, 0.0, 1.0 );
    float d = mix( d2.w, d1.w, h ) - k*h*(1.0-h);
    vec3 col = mix( d2.xyz, d1.xyz, h );
    return vec4(col, d);
}
vec4 opSmoothSubtract(vec4 d1, vec4 d2, float k) {
    float h = clamp( 0.5 - 0.5*(d1.w+d2.w)/k, 0.0, 1.0 );
    float d = mix( d1.w, -d2.w, h ) + k*h*(1.0-h);
    vec3 col = mix( d1.xyz, d2.xyz, h );
    return vec4(col, d);
}
vec4 opSmoothIntersect(vec4 d1, vec4 d2, float k) {
    float h = clamp( 0.5 - 0.5*(d2.w-d1.w)/k, 0.0, 1.0 );
    float d = mix( d2.w, d1.w, h ) + k*h*(1.0-h);
    vec3 col = mix( d2.xyz, d1.xyz, h );
    return vec4(col, d);
}

// Modifiers
float opOffset(float d, float offset) { return d - offset; }
float opShell(float d, float thickness) { return abs(d) - thickness; }

// Lattices
float sdGyroid(vec3 p, float scale, float thickness) {
    p *= scale;
    float dotP = sin(p.x)*cos(p.y) + sin(p.y)*cos(p.z) + sin(p.z)*cos(p.x);
    return (abs(dotP) - thickness) / scale;
}
float sdSchwarzP(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x) + cos(p.y) + cos(p.z);
    return (abs(val) - thickness) / scale;
}
float sdDiamond(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = sin(p.x)*sin(p.y)*sin(p.z) + sin(p.x)*cos(p.y)*cos(p.z) + cos(p.x)*sin(p.y)*cos(p.z) + cos(p.x)*cos(p.y)*sin(p.z);
    return (abs(val) - thickness) / scale;
}
float sdNeovius(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = 3.0 * (cos(p.x) + cos(p.y) + cos(p.z)) + 4.0 * cos(p.x) * cos(p.y) * cos(p.z);
    return (abs(val) - thickness) / scale;
}
float sdIWP(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = 2.0 * (cos(p.x)*cos(p.y) + cos(p.y)*cos(p.z) + cos(p.z)*cos(p.x)) - (cos(2.0*p.x) + cos(2.0*p.y) + cos(2.0*p.z));
    return (abs(val) - thickness) / scale;
}
float sdFRD(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = 4.0 * cos(p.x)*cos(p.y)*cos(p.z) - (cos(2.0*p.x)*cos(2.0*p.y) + cos(2.0*p.y)*cos(2.0*p.z) + cos(2.0*p.z)*cos(2.0*p.x));
    return (abs(val) - thickness) / scale;
}
float sdLidinoid(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = 0.5 * (sin(2.0*p.x)*cos(p.y)*sin(p.z) + sin(2.0*p.y)*cos(p.z)*sin(p.x) + sin(2.0*p.z)*cos(p.x)*sin(p.y)) - 0.5 * (cos(2.0*p.x)*cos(2.0*p.y) + cos(2.0*p.y)*cos(2.0*p.z) + cos(2.0*p.z)*cos(2.0*p.x)) + 0.15;
    return (abs(val) - thickness) / scale;
}
float sdSchwarzH(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x)*cos(p.y) + cos(p.y)*cos(p.z) + cos(p.z)*cos(p.x) - sin(p.x)*sin(p.y)*sin(p.z);
    return (abs(val) - thickness) / scale;
}
float sdGrid(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x) + cos(p.y) + cos(p.z);
    return (val - thickness) / scale;
}
float sdHoneycomb(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x) + cos(p.x/2.0 + p.y*0.866) + cos(p.x/2.0 - p.y*0.866);
    return (val - thickness) / scale;
}
float sdOctet(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = abs(cos(p.x)*cos(p.y)) + abs(cos(p.y)*cos(p.z)) + abs(cos(p.z)*cos(p.x)) - 1.0;
    return (val - thickness) / scale;
}
float sdSineWave(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = sin(p.x) * sin(p.y) * sin(p.z);
    return (abs(val) - thickness) / scale;
}
float sdFoam(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x)*cos(p.y) + cos(p.y)*cos(p.z) + cos(p.z)*cos(p.x) + 0.5;
    return (val - thickness) / scale;
}
float sdFractalNoise(vec3 p, float scale, float thickness) {
    p *= scale;
    float f = sin(p.x)*cos(p.y)*sin(p.z);
    f += 0.5 * sin(2.0*p.x)*cos(2.0*p.y)*sin(2.0*p.z);
    f += 0.25 * sin(4.0*p.x)*cos(4.0*p.y)*sin(4.0*p.z);
    return (f - thickness) / scale;
}
float sdCylindricalGrid(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = min(cos(p.x) + cos(p.y), min(cos(p.y) + cos(p.z), cos(p.z) + cos(p.x)));
    return (val - thickness) / scale;
}
float sdTubularGyroid(vec3 p, float scale, float thickness) {
    p *= scale;
    float g = sin(p.x)*cos(p.y) + sin(p.y)*cos(p.z) + sin(p.z)*cos(p.x);
    float val = abs(g) - 0.2;
    return (val - thickness) / scale;
}
float sdFischerKochS(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(2.0*p.x)*sin(p.y)*cos(p.z) + cos(2.0*p.y)*sin(p.z)*cos(p.x) + cos(2.0*p.z)*sin(p.x)*cos(p.y);
    return (abs(val) - thickness) / scale;
}
float sdFischerKochD(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = sin(2.0*p.x)*sin(p.y)*cos(p.z) + sin(2.0*p.y)*sin(p.z)*cos(p.x) + sin(2.0*p.z)*sin(p.x)*cos(p.y);
    return (abs(val) - thickness) / scale;
}
float sdSplitP(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = 1.5 * (sin(p.x)*cos(p.y) + sin(p.y)*cos(p.z) + sin(p.z)*cos(p.x)) - 0.5 * (sin(2.0*p.x)*sin(2.0*p.y) + sin(2.0*p.y)*sin(2.0*p.z) + sin(2.0*p.z)*sin(2.0*p.x));
    return (abs(val) - thickness) / scale;
}
float sdGPrime(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x)*sin(p.y) + cos(p.y)*sin(p.z) + cos(p.z)*sin(p.x);
    return (abs(val) - thickness) / scale;
}
float sdIWP2(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x)*cos(p.y) + cos(p.y)*cos(p.z) + cos(p.z)*cos(p.x) - 0.5 * (cos(2.0*p.x) + cos(2.0*p.y) + cos(2.0*p.z)) - 0.2;
    return (abs(val) - thickness) / scale;
}
float sdCarlyle(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x) + cos(p.y) + cos(p.z) - (cos(p.x)*cos(p.y) + cos(p.y)*cos(p.z) + cos(p.z)*cos(p.x));
    return (abs(val) - thickness) / scale;
}
float sdCrossedDecagons(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = sin(p.x)*cos(p.y) + sin(p.y)*cos(p.z) + sin(p.z)*cos(p.x) - 0.4;
    return (abs(val) - thickness) / scale;
}
float sdKelvin(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x)*cos(p.y) + cos(p.y)*cos(p.z) + cos(p.z)*cos(p.x) - 0.3 * sin(p.x)*sin(p.y)*sin(p.z) - 0.35;
    return (abs(val) - thickness) / scale;
}
float sdKagome(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x)*cos(p.y) + cos(p.y)*cos(p.z) + cos(p.z)*cos(p.x) + 0.25;
    return (abs(val) - thickness) / scale;
}
float sdWaffle(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x) * cos(p.y) + sin(p.z) * 0.5 - 0.2;
    return (abs(val) - thickness) / scale;
}
float sdChiral(vec3 p, float scale, float thickness) {
    p *= scale;
    float angle = 0.2 * p.z;
    float c = cos(angle);
    float s = sin(angle);
    float rx = p.x * c - p.y * s;
    float ry = p.x * s + p.y * c;
    float val = sin(rx) * cos(ry) + sin(ry) * cos(p.z) + sin(p.z) * cos(rx);
    return (abs(val) - thickness) / scale;
}
float sdRadialGrid(vec3 p, float scale, float thickness) {
    p *= scale;
    float r = length(p.xz);
    float val = cos(r) + cos(p.y);
    return (abs(val) - thickness) / scale;
}
float sdHerringbone(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = sin(p.x + sin(p.y)) * cos(p.z);
    return (abs(val) - thickness) / scale;
}
float sdWeairePhelan(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = sin(p.x)*cos(p.y) + sin(p.y)*cos(p.z) + sin(p.z)*cos(p.x) + 0.4 * (cos(2.0*p.x) + cos(2.0*p.y) + cos(2.0*p.z));
    return (abs(val) - thickness) / scale;
}
float sdBoxFrame(vec3 p, float scale, float thickness) {
    p *= scale;
    float pi2 = 6.28318530718;
    float qx = abs(p.x - round(p.x / pi2) * pi2) - 1.5;
    float qy = abs(p.y - round(p.y / pi2) * pi2) - 1.5;
    float qz = abs(p.z - round(p.z / pi2) * pi2) - 1.5;
    float d1 = max(qx, qy);
    float d2 = max(qy, qz);
    float d3 = max(qz, qx);
    float val = min(d1, min(d2, d3)) - thickness;
    return val / scale;
}
float sdOctahedral(vec3 p, float scale, float thickness) {
    p *= scale;
    float pi2 = 6.28318530718;
    float qx = abs(p.x - round(p.x / pi2) * pi2);
    float qy = abs(p.y - round(p.y / pi2) * pi2);
    float qz = abs(p.z - round(p.z / pi2) * pi2);
    float val = (qx + qy + qz) - 2.5;
    return (abs(val) - thickness) / scale;
}

float sdDoubleGyroid(vec3 p, float scale, float thickness) {
    p *= scale;
    float dotP = sin(p.x)*cos(p.y) + sin(p.y)*cos(p.z) + sin(p.z)*cos(p.x);
    return (abs(abs(dotP) - 0.5) - thickness) / scale;
}
float sdDoubleSchwarzP(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x) + cos(p.y) + cos(p.z);
    return (abs(abs(val) - 1.0) - thickness) / scale;
}
float sdDoubleDiamond(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = sin(p.x)*sin(p.y)*sin(p.z) + sin(p.x)*cos(p.y)*cos(p.z) + cos(p.x)*sin(p.y)*cos(p.z) + cos(p.x)*cos(p.y)*sin(p.z);
    return (abs(abs(val) - 0.5) - thickness) / scale;
}
float sdSchwarzCLP(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = sin(p.x)*sin(p.z) + cos(p.y);
    return (abs(val) - thickness) / scale;
}
float sdSchwarzT(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x)*cos(p.y) + cos(p.y)*cos(p.z) + cos(p.z)*cos(p.x) - sin(p.x)*sin(p.y)*sin(p.z);
    return (abs(val) - thickness) / scale;
}
float sdSchoenIQP(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = 17.0 * (cos(p.x)*cos(p.y)*cos(p.z)) - 3.0 * (cos(2.0*p.x)*cos(2.0*p.y) + cos(2.0*p.y)*cos(2.0*p.z) + cos(2.0*p.z)*cos(2.0*p.x));
    return (abs(val) - thickness) / scale;
}
float sdSchoenS(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x)*cos(p.y)*cos(p.z) - sin(p.x)*sin(p.y)*sin(p.z);
    return (abs(val) - thickness) / scale;
}
float sdSchoenM(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(2.0*p.x)*sin(p.y)*cos(p.z) + cos(2.0*p.y)*sin(p.z)*cos(p.x) + cos(2.0*p.z)*sin(p.x)*cos(p.y);
    return (abs(val) - thickness) / scale;
}
float sdSchoenY(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x)*sin(p.y)*cos(p.z) + cos(p.y)*sin(p.z)*cos(p.x) + cos(p.z)*sin(p.x)*cos(p.y);
    return (abs(val) - thickness) / scale;
}
float sdSchoenHT(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = 2.0*(cos(p.x) + cos(p.y))*cos(p.z) - cos(2.0*p.z);
    return (abs(val) - thickness) / scale;
}
float sdKarcherSchwarz(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = 3.0*(cos(p.x) + cos(p.y) + cos(p.z)) + 8.0*cos(p.x)*cos(p.y)*cos(p.z);
    return (abs(val) - thickness) / scale;
}
float sdNodal4Fold(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = sin(p.x)*sin(p.y) + sin(p.y)*sin(p.z) + sin(p.z)*sin(p.x);
    return (abs(val) - thickness) / scale;
}
float sdNodal8Fold(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = sin(2.0*p.x)*sin(2.0*p.y) + sin(2.0*p.y)*sin(2.0*p.z) + sin(2.0*p.z)*sin(2.0*p.x);
    return (abs(val) - thickness) / scale;
}
float sdComplementaryIWP(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = 2.0 * (cos(p.x)*cos(p.y) + cos(p.y)*cos(p.z) + cos(p.z)*cos(p.x)) - (cos(2.0*p.x) + cos(2.0*p.y) + cos(2.0*p.z));
    return (-val - thickness) / scale;
}
float sdSchoenSPrime(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x)*cos(p.y)*cos(p.z) + sin(p.x)*sin(p.y)*sin(p.z) - 0.5*(cos(2.0*p.x) + cos(2.0*p.y) + cos(2.0*p.z));
    return (abs(val) - thickness) / scale;
}
float sdBarthSextic(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = 4.0*(cos(p.x)*cos(p.x) + cos(p.y)*cos(p.y) + cos(p.z)*cos(p.z)) - 5.0;
    return (abs(val) - thickness) / scale;
}
float sdKummerQuartic(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x)*cos(p.y)*cos(p.z) - 0.25*(cos(2.0*p.x) + cos(2.0*p.y) + cos(2.0*p.z));
    return (abs(val) - thickness) / scale;
}
float sdTogliattiQuintic(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x)*cos(p.y) + cos(p.y)*cos(p.z) + cos(p.z)*cos(p.x) - 0.1*(cos(3.0*p.x) + cos(3.0*p.y) + cos(3.0*p.z));
    return (abs(val) - thickness) / scale;
}
float sdClebschCubic(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x)*cos(p.y)*cos(p.z) + 0.1*(cos(3.0*p.x) + cos(3.0*p.y) + cos(3.0*p.z));
    return (abs(val) - thickness) / scale;
}
float sdCayleyCubic(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x)*cos(p.y) + cos(p.y)*cos(p.z) + cos(p.z)*cos(p.x) - 1.0;
    return (abs(val) - thickness) / scale;
}
float sdTubularDiamond(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = sin(p.x)*sin(p.y)*sin(p.z) + sin(p.x)*cos(p.y)*cos(p.z) + cos(p.x)*sin(p.y)*cos(p.z) + cos(p.x)*cos(p.y)*sin(p.z);
    return (abs(abs(val) - 0.2) - thickness) / scale;
}
float sdTubularSchwarzP(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x) + cos(p.y) + cos(p.z);
    return (abs(abs(val) - 0.2) - thickness) / scale;
}
float sdTubularNeovius(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = 3.0 * (cos(p.x) + cos(p.y) + cos(p.z)) + 4.0 * cos(p.x) * cos(p.y) * cos(p.z);
    return (abs(abs(val) - 0.25) - thickness) / scale;
}
float sdTubularLidinoid(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = 0.5 * (sin(2.0*p.x)*cos(p.y)*sin(p.z) + sin(2.0*p.y)*cos(p.z)*sin(p.x) + sin(2.0*p.z)*cos(p.x)*sin(p.y)) - 0.5 * (cos(2.0*p.x)*cos(2.0*p.y) + cos(2.0*p.y)*cos(2.0*p.z) + cos(2.0*p.z)*cos(2.0*p.x)) + 0.15;
    return (abs(abs(val) - 0.15) - thickness) / scale;
}
float sdSuperGyroid(vec3 p, float scale, float thickness) {
    p *= (scale * 2.0);
    float dotP = sin(p.x)*cos(p.y) + sin(p.y)*cos(p.z) + sin(p.z)*cos(p.x);
    return (abs(dotP) - thickness) / (scale * 2.0);
}
float sdSuperSchwarzP(vec3 p, float scale, float thickness) {
    p *= (scale * 2.0);
    float val = cos(p.x) + cos(p.y) + cos(p.z);
    return (abs(val) - thickness) / (scale * 2.0);
}
float sdSuperDiamond(vec3 p, float scale, float thickness) {
    p *= (scale * 2.0);
    float val = sin(p.x)*sin(p.y)*sin(p.z) + sin(p.x)*cos(p.y)*cos(p.z) + cos(p.x)*sin(p.y)*cos(p.z) + cos(p.x)*cos(p.y)*sin(p.z);
    return (abs(val) - thickness) / (scale * 2.0);
}
float sdGyroidSchwarzHybrid(vec3 p, float scale, float thickness) {
    p *= scale;
    float valG = sin(p.x)*cos(p.y) + sin(p.y)*cos(p.z) + sin(p.z)*cos(p.x);
    float valS = cos(p.x) + cos(p.y) + cos(p.z);
    float val = mix(valG, valS, 0.5);
    return (abs(val) - thickness) / scale;
}
float sdGyroidDiamondHybrid(vec3 p, float scale, float thickness) {
    p *= scale;
    float valG = sin(p.x)*cos(p.y) + sin(p.y)*cos(p.z) + sin(p.z)*cos(p.x);
    float valD = sin(p.x)*sin(p.y)*sin(p.z) + sin(p.x)*cos(p.y)*cos(p.z) + cos(p.x)*sin(p.y)*cos(p.z) + cos(p.x)*cos(p.y)*sin(p.z);
    float val = mix(valG, valD, 0.5);
    return (abs(val) - thickness) / scale;
}
float sdSchwarzDiamondHybrid(vec3 p, float scale, float thickness) {
    p *= scale;
    float valS = cos(p.x) + cos(p.y) + cos(p.z);
    float valD = sin(p.x)*sin(p.y)*sin(p.z) + sin(p.x)*cos(p.y)*cos(p.z) + cos(p.x)*sin(p.y)*cos(p.z) + cos(p.x)*cos(p.y)*sin(p.z);
    float val = mix(valS, valD, 0.5);
    return (abs(val) - thickness) / scale;
}
float sdHelicoid(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = sin(p.z - atan(p.y, p.x));
    return (abs(val) - thickness) / scale;
}
float sdDoubleHelicoid(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = abs(sin(p.z - atan(p.y, p.x)));
    return (abs(val) - thickness) / scale;
}
float sdTriangularHoneycomb(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x) + cos(p.y) + cos(p.x-p.y);
    return (abs(val) - thickness) / scale;
}
float sdKagome3D(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x)*cos(p.y) + cos(p.y)*cos(p.z) + cos(p.z)*cos(p.x) + cos(p.x+p.y+p.z);
    return (abs(val) - thickness) / scale;
}
float sdBoricAcidLayer(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x)*cos(p.y)*cos(p.z) - 0.5;
    return (abs(val) - thickness) / scale;
}
float sdPoreNetwork(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = 1.0 - (cos(p.x)*cos(p.y) + cos(p.y)*cos(p.z) + cos(p.z)*cos(p.x));
    return (abs(val) - thickness) / scale;
}
float sdSaddle(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x) - cos(p.y) + cos(p.z);
    return (abs(val) - thickness) / scale;
}
float sdDoubleSaddle(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = abs(cos(p.x) - cos(p.y) + cos(p.z));
    return (abs(val) - thickness) / scale;
}
float sdComplementaryFRD(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = 4.0 * cos(p.x)*cos(p.y)*cos(p.z) - (cos(2.0*p.x)*cos(2.0*p.y) + cos(2.0*p.y)*cos(2.0*p.z) + cos(2.0*p.z)*cos(2.0*p.x));
    return (-val - thickness) / scale;
}
float sdStaircaseGyroid(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = sin(p.x+p.z)*cos(p.y) + sin(p.y+p.x)*cos(p.z) + sin(p.z+p.y)*cos(p.x);
    return (abs(val) - thickness) / scale;
}
float sdTwistedGyroid(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = sin(p.x*cos(p.z))*cos(p.y*sin(p.x)) + sin(p.y*cos(p.x))*cos(p.z*sin(p.y)) + sin(p.z*cos(p.y))*cos(p.x*sin(p.z));
    return (abs(val) - thickness) / scale;
}
float sdChiralDiamond(vec3 p, float scale, float thickness) {
    float baseD = sdDiamond(p, scale, thickness);
    p *= scale;
    return baseD + 0.1 * sin(p.x + p.y) / scale;
}
float sdOctetTrussVariant(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = abs(sin(p.x)*cos(p.y)) + abs(sin(p.y)*cos(p.z)) + abs(sin(p.z)*cos(p.x)) - 1.0;
    return (abs(val) - thickness) / scale;
}
float sdKelvinFoam(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x)*cos(p.y) + cos(p.y)*cos(p.z) + cos(p.z)*cos(p.x) - 0.2;
    return (abs(val) - thickness) / scale;
}
float sdSchwarzHPrime(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x)*cos(p.y) - cos(p.z);
    return (abs(val) - thickness) / scale;
}
float sdGyroidVariant(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = sin(p.x)*cos(p.y) + sin(p.y)*cos(p.z) + sin(p.z)*cos(p.x) + 0.5*cos(p.x)*cos(p.y)*cos(p.z);
    return (abs(val) - thickness) / scale;
}
float sdSchwarzPVariant(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = cos(p.x) + cos(p.y) + cos(p.z) + 0.5*sin(p.x)*sin(p.y)*sin(p.z);
    return (abs(val) - thickness) / scale;
}
float sdDiamondVariant(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = sin(p.x)*sin(p.y)*sin(p.z) + sin(p.x)*cos(p.y)*cos(p.z) + cos(p.x)*sin(p.y)*cos(p.z) + cos(p.x)*cos(p.y)*sin(p.z) + 0.2*cos(p.x)*cos(p.y)*cos(p.z);
    return (abs(val) - thickness) / scale;
}
float sdNeoviusVariant(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = 3.0 * (cos(p.x) + cos(p.y) + cos(p.z)) + 4.0 * cos(p.x) * cos(p.y) * cos(p.z) + 0.5*(cos(2.0*p.x) + cos(2.0*p.y) + cos(2.0*p.z));
    return (abs(val) - thickness) / scale;
}
float sdLidinoidVariant(vec3 p, float scale, float thickness) {
    p *= scale;
    float val = 0.5 * (sin(2.0*p.x)*cos(p.y)*sin(p.z) + sin(2.0*p.y)*cos(p.z)*sin(p.x) + sin(2.0*p.z)*cos(p.x)*sin(p.y)) - 0.5 * (cos(2.0*p.x)*cos(2.0*p.y) + cos(2.0*p.y)*cos(2.0*p.z) + cos(2.0*p.z)*cos(2.0*p.x)) + 0.3;
    return (abs(val) - thickness) / scale;
}


// Space Modifiers
vec3 opTwist(vec3 p, float k) {
    float c = cos(k*p.y);
    float s = sin(k*p.y);
    mat2  m = mat2(c,-s,s,c);
    vec3  q = vec3(m*p.xz,p.y);
    return vec3(q.x, q.z, q.y);
}
vec3 opTaper(vec3 p, float k) {
    float scale = 1.0 + p.y * k;
    return vec3(p.x / scale, p.y, p.z / scale);
}
vec3 opBend(vec3 p, float strength) {
    float c = cos(strength * p.y);
    float s = sin(strength * p.y);
    float x = p.x * c - p.y * s;
    float y = p.x * s + p.y * c;
    return vec3(x, y, p.z);
}
vec3 opQuantize(vec3 p, float stepVal) {
    if (stepVal <= 0.0) return p;
    return round(p / stepVal) * stepVal;
}
vec3 opRipple(vec3 p, float freq, float amp) {
    return vec3(p.x, p.y + sin(p.x * freq) * amp + cos(p.z * freq) * amp, p.z);
}
vec3 opElongateX(vec3 p, float len) {
    vec3 q = p;
    q.x -= clamp(p.x, -len, len);
    return q;
}
vec3 opElongateY(vec3 p, float len) {
    vec3 q = p;
    q.y -= clamp(p.y, -len, len);
    return q;
}
vec3 opBulge(vec3 p, float strength) {
    float r2 = dot(p, p);
    float f = 1.0 / (1.0 + strength * exp(-r2 * 0.05));
    return p * f;
}
vec3 opPinch(vec3 p, float strength) {
    float r2 = dot(p, p);
    float f = 1.0 + strength * exp(-r2 * 0.05);
    return p * f;
}

vec3 opRepeat(vec3 p, vec3 c) {
    vec3 q = p;
    if(c.x > 0.0) q.x = mod(q.x+0.5*c.x,c.x)-0.5*c.x;
    if(c.y > 0.0) q.y = mod(q.y+0.5*c.y,c.y)-0.5*c.y;
    if(c.z > 0.0) q.z = mod(q.z+0.5*c.z,c.z)-0.5*c.z;
    return q;
}

vec3 opRotateEuler(vec3 p, vec3 rad) {
    vec3 q = p;
    // Rotate X
    float cX = cos(-rad.x), sX = sin(-rad.x);
    q.yz = mat2(cX, -sX, sX, cX) * q.yz;
    
    // Rotate Y
    float cY = cos(-rad.y), sY = sin(-rad.y);
    q.xz = mat2(cY, -sY, sY, cY) * q.xz;
    
    // Rotate Z
    float cZ = cos(-rad.z), sZ = sin(-rad.z);
    q.xy = mat2(cZ, -sZ, sZ, cZ) * q.xy;
    
    return q;
}

vec3 opSymX(vec3 p) { p.x = abs(p.x); return p; }
vec3 opSymY(vec3 p) { p.y = abs(p.y); return p; }
vec3 opSymZ(vec3 p) { p.z = abs(p.z); return p; }
vec3 opSymRadial(vec3 p, float slices) {
    float a = atan(p.z, p.x);
    float r = length(p.xz);
    float b = 6.2831853 / slices;
    a = mod(a + b/2.0, b) - b/2.0;
    return vec3(cos(a)*r, p.y, sin(a)*r);
}

// 3D Texture Lookup for Baked STLs
float sdMeshTexture(vec3 p, sampler3D tex, vec3 bboxMin, vec3 bboxMax) {
    // Map point p to [0, 1] texture coordinates based on bounding box
    vec3 uvw = (p - bboxMin) / (bboxMax - bboxMin);
    
    // If point is outside the bounding box, return a positive distance to the box
    if (uvw.x < 0.0 || uvw.x > 1.0 || 
        uvw.y < 0.0 || uvw.y > 1.0 || 
        uvw.z < 0.0 || uvw.z > 1.0) {
        
        vec3 center = (bboxMin + bboxMax) * 0.5;
        vec3 halfExtents = (bboxMax - bboxMin) * 0.5;
        vec3 d = abs(p - center) - halfExtents;
        return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0)) + 0.1; // +0.1 padding to prevent artifacts
    }
    
    // Sample texture with manual trilinear filtering for compatibility with NearestFilter
    vec3 texSize = vec3(64.0);
    vec3 texel = uvw * (texSize - 1.0);
    vec3 texelMin = clamp(floor(texel), vec3(0.0), vec3(62.0));
    vec3 f = fract(texel);
    
    // Sample the 8 corners of the voxel cell
    float v000 = texture(tex, (texelMin + vec3(0.0, 0.0, 0.0)) / (texSize - 1.0)).r;
    float v100 = texture(tex, (texelMin + vec3(1.0, 0.0, 0.0)) / (texSize - 1.0)).r;
    float v010 = texture(tex, (texelMin + vec3(0.0, 1.0, 0.0)) / (texSize - 1.0)).r;
    float v110 = texture(tex, (texelMin + vec3(1.0, 1.0, 0.0)) / (texSize - 1.0)).r;
    float v001 = texture(tex, (texelMin + vec3(0.0, 0.0, 1.0)) / (texSize - 1.0)).r;
    float v101 = texture(tex, (texelMin + vec3(1.0, 0.0, 1.0)) / (texSize - 1.0)).r;
    float v011 = texture(tex, (texelMin + vec3(0.0, 1.0, 1.0)) / (texSize - 1.0)).r;
    float v111 = texture(tex, (texelMin + vec3(1.0, 1.0, 1.0)) / (texSize - 1.0)).r;
    
    // Linearly interpolate along each axis
    float v00 = mix(v000, v100, f.x);
    float v10 = mix(v010, v110, f.x);
    float v01 = mix(v001, v101, f.x);
    float v11 = mix(v011, v111, f.x);
    
    float v0 = mix(v00, v10, f.y);
    float v1 = mix(v01, v11, f.y);
    
    return mix(v0, v1, f.z);
}
`;

// Build Map Function dynamically
function hexToRgbFloat(hex: string): string {
  const cleanHex = (hex || '#6366f1').replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return `vec3(${r.toFixed(5)}, ${g.toFixed(5)}, ${b.toFixed(5)})`;
}

export function compileGraphToGLSL(): string {
  const { nodes, edges } = useGpuStore.getState();
  
  const outputNode = nodes.find(n => n.type === 'outputNode' || n.data.type === 'output');
  if (!outputNode) return '';

  const getConnectedNodes = (targetId: string, handle?: string) => {
    const connectedEdges = edges.filter(e => e.target === targetId && (!handle || e.targetHandle === handle));
    return connectedEdges.map(e => nodes.find(n => n.id === e.source)).filter((n): n is AppNode => n !== undefined);
  };

  let mapBody = '';
  
  const generateNodeCode = (node: AppNode, pointVar: string): string => {
    const d = node.data as any;
    
    switch (node.data.type) {
      case 'primitive': {
        const pStr = `${d.position[0].toFixed(5)}, ${d.position[1].toFixed(5)}, ${d.position[2].toFixed(5)}`;
        const sStr = (d.scale || 1.0).toFixed(5);
        const colStr = hexToRgbFloat(d.color || '#6366f1');
        if (d.shape === 'box') return `vec4(${colStr}, sdBox(${pointVar} - vec3(${pStr}), vec3(${sStr})))`;
        if (d.shape === 'sphere') return `vec4(${colStr}, sdSphere(${pointVar} - vec3(${pStr}), ${sStr}))`;
        if (d.shape === 'cylinder') return `vec4(${colStr}, sdCylinder(${pointVar} - vec3(${pStr}), vec3(${sStr}, ${sStr}, ${sStr})))`;
        return `vec4(${colStr}, 10000.0)`;
      }

      case 'boolean': {
        const base = getConnectedNodes(node.id, 'base')[0];
        const tool = getConnectedNodes(node.id, 'tool')[0];
        if (!base) return 'vec4(vec3(0.0), 10000.0)';
        const d1 = generateNodeCode(base, pointVar);
        const d2 = tool ? generateNodeCode(tool, pointVar) : 'vec4(vec3(0.0), 10000.0)';
        
        const sm = (d.smoothness || 0.1).toFixed(5);
        switch (d.operation) {
          case 'union': return `opUnion(${d1}, ${d2})`;
          case 'subtract': return `opSubtract(${d1}, ${d2})`;
          case 'intersect': return `opIntersect(${d1}, ${d2})`;
          case 'smoothUnion': return `opSmoothUnion(${d1}, ${d2}, ${sm})`;
          case 'smoothSubtract': return `opSmoothSubtract(${d1}, ${d2}, ${sm})`;
          case 'smoothIntersect': return `opSmoothIntersect(${d1}, ${d2}, ${sm})`;
          default: return d1;
        }
      }

      case 'lattice': {
        const base = getConnectedNodes(node.id, 'base')[0] || getConnectedNodes(node.id)[0];
        const baseCode = base ? generateNodeCode(base, pointVar) : 'vec4(vec3(0.91, 0.47, 0.98), 10000.0)';
        let latCode = '10000.0';
        const ls = (100.0 / (d.scale || 500.0)).toFixed(5);
        const lt = (d.thickness || 0.1).toFixed(5);
        switch (d.pattern) {
          case 'gyroid': latCode = `sdGyroid(${pointVar}, ${ls}, ${lt})`; break;
          case 'schwarzP': latCode = `sdSchwarzP(${pointVar}, ${ls}, ${lt})`; break;
          case 'diamond': latCode = `sdDiamond(${pointVar}, ${ls}, ${lt})`; break;
          case 'neovius': latCode = `sdNeovius(${pointVar}, ${ls}, ${lt})`; break;
          case 'iwp': latCode = `sdIWP(${pointVar}, ${ls}, ${lt})`; break;
          case 'frd': latCode = `sdFRD(${pointVar}, ${ls}, ${lt})`; break;
          case 'lidinoid': latCode = `sdLidinoid(${pointVar}, ${ls}, ${lt})`; break;
          case 'schwarzH': latCode = `sdSchwarzH(${pointVar}, ${ls}, ${lt})`; break;
          case 'grid': latCode = `sdGrid(${pointVar}, ${ls}, ${lt})`; break;
          case 'honeycomb': latCode = `sdHoneycomb(${pointVar}, ${ls}, ${lt})`; break;
          case 'octet': latCode = `sdOctet(${pointVar}, ${ls}, ${lt})`; break;
          case 'sineWave': latCode = `sdSineWave(${pointVar}, ${ls}, ${lt})`; break;
          case 'foam': latCode = `sdFoam(${pointVar}, ${ls}, ${lt})`; break;
          case 'fractalNoise': latCode = `sdFractalNoise(${pointVar}, ${ls}, ${lt})`; break;
          case 'cylindricalGrid': latCode = `sdCylindricalGrid(${pointVar}, ${ls}, ${lt})`; break;
          case 'tubularGyroid': latCode = `sdTubularGyroid(${pointVar}, ${ls}, ${lt})`; break;
          case 'fischerKochS': latCode = `sdFischerKochS(${pointVar}, ${ls}, ${lt})`; break;
          case 'fischerKochD': latCode = `sdFischerKochD(${pointVar}, ${ls}, ${lt})`; break;
          case 'splitP': latCode = `sdSplitP(${pointVar}, ${ls}, ${lt})`; break;
          case 'gPrime': latCode = `sdGPrime(${pointVar}, ${ls}, ${lt})`; break;
          case 'iwp2': latCode = `sdIWP2(${pointVar}, ${ls}, ${lt})`; break;
          case 'carlyle': latCode = `sdCarlyle(${pointVar}, ${ls}, ${lt})`; break;
          case 'crossedDecagons': latCode = `sdCrossedDecagons(${pointVar}, ${ls}, ${lt})`; break;
          case 'kelvin': latCode = `sdKelvin(${pointVar}, ${ls}, ${lt})`; break;
          case 'kagome': latCode = `sdKagome(${pointVar}, ${ls}, ${lt})`; break;
          case 'waffle': latCode = `sdWaffle(${pointVar}, ${ls}, ${lt})`; break;
          case 'chiral': latCode = `sdChiral(${pointVar}, ${ls}, ${lt})`; break;
          case 'radialGrid': latCode = `sdRadialGrid(${pointVar}, ${ls}, ${lt})`; break;
          case 'herringbone': latCode = `sdHerringbone(${pointVar}, ${ls}, ${lt})`; break;
          case 'weairePhelan': latCode = `sdWeairePhelan(${pointVar}, ${ls}, ${lt})`; break;
          case 'boxFrame': latCode = `sdBoxFrame(${pointVar}, ${ls}, ${lt})`; break;
          case 'octahedral': latCode = `sdOctahedral(${pointVar}, ${ls}, ${lt})`; break;
          case 'doubleGyroid': latCode = `sdDoubleGyroid(${pointVar}, ${ls}, ${lt})`; break;
          case 'doubleSchwarzP': latCode = `sdDoubleSchwarzP(${pointVar}, ${ls}, ${lt})`; break;
          case 'doubleDiamond': latCode = `sdDoubleDiamond(${pointVar}, ${ls}, ${lt})`; break;
          case 'schwarzCLP': latCode = `sdSchwarzCLP(${pointVar}, ${ls}, ${lt})`; break;
          case 'schwarzT': latCode = `sdSchwarzT(${pointVar}, ${ls}, ${lt})`; break;
          case 'schoenIQP': latCode = `sdSchoenIQP(${pointVar}, ${ls}, ${lt})`; break;
          case 'schoenS': latCode = `sdSchoenS(${pointVar}, ${ls}, ${lt})`; break;
          case 'schoenM': latCode = `sdSchoenM(${pointVar}, ${ls}, ${lt})`; break;
          case 'schoenY': latCode = `sdSchoenY(${pointVar}, ${ls}, ${lt})`; break;
          case 'schoenHT': latCode = `sdSchoenHT(${pointVar}, ${ls}, ${lt})`; break;
          case 'karcherSchwarz': latCode = `sdKarcherSchwarz(${pointVar}, ${ls}, ${lt})`; break;
          case 'nodal4Fold': latCode = `sdNodal4Fold(${pointVar}, ${ls}, ${lt})`; break;
          case 'nodal8Fold': latCode = `sdNodal8Fold(${pointVar}, ${ls}, ${lt})`; break;
          case 'complementaryIWP': latCode = `sdComplementaryIWP(${pointVar}, ${ls}, ${lt})`; break;
          case 'schoenSPrime': latCode = `sdSchoenSPrime(${pointVar}, ${ls}, ${lt})`; break;
          case 'barthSextic': latCode = `sdBarthSextic(${pointVar}, ${ls}, ${lt})`; break;
          case 'kummerQuartic': latCode = `sdKummerQuartic(${pointVar}, ${ls}, ${lt})`; break;
          case 'togliattiQuintic': latCode = `sdTogliattiQuintic(${pointVar}, ${ls}, ${lt})`; break;
          case 'clebschCubic': latCode = `sdClebschCubic(${pointVar}, ${ls}, ${lt})`; break;
          case 'cayleyCubic': latCode = `sdCayleyCubic(${pointVar}, ${ls}, ${lt})`; break;
          case 'tubularDiamond': latCode = `sdTubularDiamond(${pointVar}, ${ls}, ${lt})`; break;
          case 'tubularSchwarzP': latCode = `sdTubularSchwarzP(${pointVar}, ${ls}, ${lt})`; break;
          case 'tubularNeovius': latCode = `sdTubularNeovius(${pointVar}, ${ls}, ${lt})`; break;
          case 'tubularLidinoid': latCode = `sdTubularLidinoid(${pointVar}, ${ls}, ${lt})`; break;
          case 'superGyroid': latCode = `sdSuperGyroid(${pointVar}, ${ls}, ${lt})`; break;
          case 'superSchwarzP': latCode = `sdSuperSchwarzP(${pointVar}, ${ls}, ${lt})`; break;
          case 'superDiamond': latCode = `sdSuperDiamond(${pointVar}, ${ls}, ${lt})`; break;
          case 'gyroidSchwarzHybrid': latCode = `sdGyroidSchwarzHybrid(${pointVar}, ${ls}, ${lt})`; break;
          case 'gyroidDiamondHybrid': latCode = `sdGyroidDiamondHybrid(${pointVar}, ${ls}, ${lt})`; break;
          case 'schwarzDiamondHybrid': latCode = `sdSchwarzDiamondHybrid(${pointVar}, ${ls}, ${lt})`; break;
          case 'helicoid': latCode = `sdHelicoid(${pointVar}, ${ls}, ${lt})`; break;
          case 'doubleHelicoid': latCode = `sdDoubleHelicoid(${pointVar}, ${ls}, ${lt})`; break;
          case 'triangularHoneycomb': latCode = `sdTriangularHoneycomb(${pointVar}, ${ls}, ${lt})`; break;
          case 'kagome3D': latCode = `sdKagome3D(${pointVar}, ${ls}, ${lt})`; break;
          case 'boricAcidLayer': latCode = `sdBoricAcidLayer(${pointVar}, ${ls}, ${lt})`; break;
          case 'poreNetwork': latCode = `sdPoreNetwork(${pointVar}, ${ls}, ${lt})`; break;
          case 'saddle': latCode = `sdSaddle(${pointVar}, ${ls}, ${lt})`; break;
          case 'doubleSaddle': latCode = `sdDoubleSaddle(${pointVar}, ${ls}, ${lt})`; break;
          case 'complementaryFRD': latCode = `sdComplementaryFRD(${pointVar}, ${ls}, ${lt})`; break;
          case 'staircaseGyroid': latCode = `sdStaircaseGyroid(${pointVar}, ${ls}, ${lt})`; break;
          case 'twistedGyroid': latCode = `sdTwistedGyroid(${pointVar}, ${ls}, ${lt})`; break;
          case 'chiralDiamond': latCode = `sdChiralDiamond(${pointVar}, ${ls}, ${lt})`; break;
          case 'octetTrussVariant': latCode = `sdOctetTrussVariant(${pointVar}, ${ls}, ${lt})`; break;
          case 'kelvinFoam': latCode = `sdKelvinFoam(${pointVar}, ${ls}, ${lt})`; break;
          case 'schwarzHPrime': latCode = `sdSchwarzHPrime(${pointVar}, ${ls}, ${lt})`; break;
          case 'gyroidVariant': latCode = `sdGyroidVariant(${pointVar}, ${ls}, ${lt})`; break;
          case 'schwarzPVariant': latCode = `sdSchwarzPVariant(${pointVar}, ${ls}, ${lt})`; break;
          case 'diamondVariant': latCode = `sdDiamondVariant(${pointVar}, ${ls}, ${lt})`; break;
          case 'neoviusVariant': latCode = `sdNeoviusVariant(${pointVar}, ${ls}, ${lt})`; break;
          case 'lidinoidVariant': latCode = `sdLidinoidVariant(${pointVar}, ${ls}, ${lt})`; break;
          default: latCode = `sdGyroid(${pointVar}, ${ls}, ${lt})`; break;
        }
        return `vec4(${baseCode}.xyz, opIntersect(${baseCode}, vec4(vec3(0.0), ${latCode})).w)`;
      }

      case 'modifier': {
        const base = getConnectedNodes(node.id, 'base')[0] || getConnectedNodes(node.id)[0];
        if (!base) return 'vec4(vec3(0.0), 10000.0)';
        const d1 = generateNodeCode(base, pointVar);
        const amt = (d.amount || 0).toFixed(5);
        if (d.modifierType === 'shell') {
          return `vec4(${d1}.xyz, opShell(${d1}.w, ${amt}))`;
        } else {
          return `vec4(${d1}.xyz, opOffset(${d1}.w, ${amt}))`;
        }
      }

      case 'morph': {
        const base = getConnectedNodes(node.id, 'base')[0] || getConnectedNodes(node.id)[0];
        const shapeB = getConnectedNodes(node.id, 'shapeB')[0];
        if (!base) return 'vec4(vec3(0.0), 10000.0)';
        const d1 = generateNodeCode(base, pointVar);
        const d2 = shapeB ? generateNodeCode(shapeB, pointVar) : 'vec4(vec3(0.0), 10000.0)';
        const amt = (d.amount || 0).toFixed(5);
        return `mix(${d1}, ${d2}, ${amt})`;
      }

      case 'transform': {
        const base = getConnectedNodes(node.id, 'base')[0] || getConnectedNodes(node.id)[0];
        if (!base) return 'vec4(vec3(0.0), 10000.0)';
        
        const tx = (d.translate?.[0] || 0).toFixed(5);
        const ty = (d.translate?.[1] || 0).toFixed(5);
        const tz = (d.translate?.[2] || 0).toFixed(5);
        
        const rx = ((d.rotate?.[0] || 0) * Math.PI / 180.0).toFixed(5);
        const ry = ((d.rotate?.[1] || 0) * Math.PI / 180.0).toFixed(5);
        const rz = ((d.rotate?.[2] || 0) * Math.PI / 180.0).toFixed(5);
        
        const sx = (d.scale?.[0] || 1.0).toFixed(5);
        const sy = (d.scale?.[1] || 1.0).toFixed(5);
        const sz = (d.scale?.[2] || 1.0).toFixed(5);
        
        const minScale = Math.min(d.scale?.[0] || 1.0, d.scale?.[1] || 1.0, d.scale?.[2] || 1.0).toFixed(5);
        
        const localPoint = `(opRotateEuler(${pointVar} - vec3(${tx}, ${ty}, ${tz}), vec3(${rx}, ${ry}, ${rz})) / vec3(${sx}, ${sy}, ${sz}))`;
        const baseExpr = generateNodeCode(base, localPoint);
        
        return `vec4(${baseExpr}.xyz, ${baseExpr}.w * ${minScale})`;
      }

      case 'deform': {
        const base = getConnectedNodes(node.id, 'base')[0] || getConnectedNodes(node.id)[0];
        if (!base) return 'vec4(vec3(0.0), 10000.0)';
        let dp = pointVar;
        const str = (d.strength || 0).toFixed(3);
        const absStr = Math.abs(d.strength || 0).toFixed(3);
        const doubleStr = ((d.strength || 0) * 2).toFixed(3);
        const halfAbsStr = (Math.abs(d.strength || 0) * 0.5).toFixed(3);
        
        switch (d.deformType) {
          case 'twist': dp = `opTwist(${pointVar}, ${str})`; break;
          case 'taper': dp = `opTaper(${pointVar}, ${str})`; break;
          case 'bend': dp = `opBend(${pointVar}, ${str})`; break;
          case 'quantize': dp = `opQuantize(${pointVar}, ${str})`; break;
          case 'ripple': dp = `opRipple(${pointVar}, ${doubleStr}, ${halfAbsStr})`; break;
          case 'elongateX': dp = `opElongateX(${pointVar}, ${absStr})`; break;
          case 'elongateY': dp = `opElongateY(${pointVar}, ${absStr})`; break;
          case 'bulge': dp = `opBulge(${pointVar}, ${str})`; break;
          case 'pinch': dp = `opPinch(${pointVar}, ${str})`; break;
        }
        return generateNodeCode(base, dp);
      }

      case 'repeat': {
        const base = getConnectedNodes(node.id, 'base')[0] || getConnectedNodes(node.id)[0];
        if (!base) return 'vec4(vec3(0.0), 10000.0)';
        const dp = `opRepeat(${pointVar}, vec3(${d.spacing.map((v:any)=>v.toFixed(3)).join(',')}))`;
        return generateNodeCode(base, dp);
      }

      case 'symmetry': {
        const base = getConnectedNodes(node.id, 'base')[0] || getConnectedNodes(node.id)[0];
        if (!base) return 'vec4(vec3(0.0), 10000.0)';
        let dp = pointVar;
        if (d.symType === 'symX') dp = `opSymX(${pointVar})`;
        if (d.symType === 'symY') dp = `opSymY(${pointVar})`;
        if (d.symType === 'symZ') dp = `opSymZ(${pointVar})`;
        if (d.symType === 'radial') dp = `opSymRadial(${pointVar}, ${(d.slices||6).toFixed(1)})`;
        return generateNodeCode(base, dp);
      }
      
      case 'mesh':
        console.log("Compiling mesh node. Data:", d);
        const meshColor = d.color || '#f97316';
        const colStr = hexToRgbFloat(meshColor);
        if (d.sdfTexture && d.bboxMin && d.bboxMax) {
          const texName = `u_meshTex_${node.id.replace(/-/g, '_')}`;
          const bMin = `vec3(${d.bboxMin[0].toFixed(5)}, ${d.bboxMin[1].toFixed(5)}, ${d.bboxMin[2].toFixed(5)})`;
          const bMax = `vec3(${d.bboxMax[0].toFixed(5)}, ${d.bboxMax[1].toFixed(5)}, ${d.bboxMax[2].toFixed(5)})`;
          
          const px = (d.position?.[0] || 0).toFixed(5);
          const py = (d.position?.[1] || 0).toFixed(5);
          const pz = (d.position?.[2] || 0).toFixed(5);
          const sc = (d.scale || 1.0).toFixed(5);
          
          const localPoint = `((${pointVar} - vec3(${px}, ${py}, ${pz})) / ${sc})`;
          return `vec4(${colStr}, sdMeshTexture(${localPoint}, ${texName}, ${bMin}, ${bMax}) * ${sc})`;
        }
        return `vec4(${colStr}, 10000.0)`;

      default:
        return 'vec4(vec3(0.0), 10000.0)';
    }
  };

  const finalInputNodes = getConnectedNodes(outputNode.id);
  if (finalInputNodes.length === 0) {
    mapBody = 'return vec4(vec3(0.0), 10000.0);';
  } else {
    const inputs = finalInputNodes.map(n => generateNodeCode(n, 'p'));
    let combined = inputs[0];
    for (let i = 1; i < inputs.length; i++) {
      combined = `opUnion(${combined}, ${inputs[i]})`;
    }
    mapBody = `return ${combined};`;
  }

  // Find all mesh textures to declare as uniforms
  const meshUniforms = nodes
    .filter(n => (n.type === 'meshNode' || n.data.type === 'mesh') && (n.data as any).sdfTexture)
    .map(n => `uniform sampler3D u_meshTex_${n.id.replace(/-/g, '_')};`)
    .join('\n');

  const shader = `
  in vec3 vPosition;
  in vec2 vUv;
  uniform vec3 cameraPos;
  uniform vec3 cameraDir;
  uniform vec3 cameraUp;
  uniform vec3 cameraRight;
  uniform vec2 resolution;

  uniform float uShowGround;
  uniform float uShowShadows;
  uniform float uShowAO;
  uniform vec3 uLightDir;
  uniform float uLightIntensity;
  uniform float uAmbientIntensity;
  uniform float uFocalLength;

  ${meshUniforms}

  ${SDF_LIBRARY}

  vec4 mapScene(vec3 p) {
      ${mapBody}
  }

  float map(vec3 p) {
      float dScene = mapScene(p).w;
      if (uShowGround > 0.5) {
          float dGround = p.y + 4.0;
          return min(dScene, dGround);
      }
      return dScene;
  }

  vec3 getNormal(vec3 p) {
      vec2 e = vec2(0.003, -0.003);
      return normalize(
          e.xyy * map(p + e.xyy) + 
          e.yyx * map(p + e.yyx) + 
          e.yxy * map(p + e.yxy) + 
          e.xxx * map(p + e.xxx)
      );
  }

  float rayMarch(vec3 ro, vec3 rd) {
      float dO=0.;
      for(int i=0; i<MAX_STEPS; i++) {
          vec3 p = ro + rd*dO;
          float dS = map(p);
          dO += dS;
          if(dO>MAX_DIST || abs(dS)<SURF_DIST) break;
      }
      return dO;
  }

  float getShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
      float res = 1.0;
      float t = mint;
      for(int i=0; i<30; i++) {
          float h = mapScene(ro + rd*t).w;
          if(h < 0.001) return 0.0;
          res = min(res, k*h/t);
          t += clamp(h, 0.05, 0.5);
          if(t > maxt) break;
      }
      return clamp(res, 0.0, 1.0);
  }

  float getAO(vec3 p, vec3 n) {
      float occ = 0.0;
      float sca = 1.0;
      for(int i=0; i<5; i++) {
          float hr = 0.01 + 0.12*float(i)/4.0;
          vec3 aopos = n * hr + p;
          float dd = map(aopos);
          occ += -(dd-hr)*sca;
          sca *= 0.95;
      }
      return clamp(1.0 - 3.0*occ, 0.0, 1.0);
  }

  out vec4 fragColor;

  void main() {
      // Screen coordinates from -1 to 1
      vec2 uv = vUv * 2.0 - 1.0;
      uv.x *= resolution.x / resolution.y;

      // Camera setup
      vec3 ro = cameraPos;
      vec3 rd = normalize(uv.x * cameraRight + uv.y * cameraUp + uFocalLength * cameraDir);

      float d = rayMarch(ro, rd);

      if (d > MAX_DIST) {
          fragColor = vec4(0.035, 0.035, 0.043, 1.0); // bg-zinc-950
          return;
      }

      vec3 p = ro + rd * d;
      vec3 n = getNormal(p);
      
      vec3 baseColor = vec3(0.02, 0.7, 0.8); // Default cool cyan for scene
      bool isGround = false;
      
      float dScene = mapScene(p).w;
      float dGround = p.y + 4.0;
      if (uShowGround > 0.5 && dGround < dScene && dGround < 0.02) {
          isGround = true;
          n = vec3(0.0, 1.0, 0.0);
          
          // Grid pattern on ground
          float gridScale = 1.0;
          vec2 gridCoord = fract(p.xz / gridScale - 0.5) - 0.5;
          float gridLine = smoothstep(0.04, 0.0, min(abs(gridCoord.x), abs(gridCoord.y)));
          vec3 groundColor = mix(vec3(0.08, 0.08, 0.1), vec3(0.15, 0.15, 0.18), gridLine);
          
          // Radial fade to match background
          float distToCenter = length(p.xz);
          float fade = smoothstep(25.0, 5.0, distToCenter);
          baseColor = mix(vec3(0.035, 0.035, 0.043), groundColor, fade);
          
          // Glossy reflection of the 3D model onto the ground
          vec3 reflectDir = reflect(rd, vec3(0.0, 1.0, 0.0));
          // Start raymarching slightly above ground to avoid hitting the ground itself
          float dReflect = rayMarch(p + vec3(0.0, 0.02, 0.0), reflectDir);
          
          vec3 reflectCol = vec3(0.035, 0.035, 0.043); // default background color
          if (dReflect < MAX_DIST) {
              vec3 pReflect = (p + vec3(0.0, 0.02, 0.0)) + reflectDir * dReflect;
              vec3 nReflect = getNormal(pReflect);
              vec3 lDir = normalize(uLightDir);
              float diffReflect = max(dot(nReflect, lDir), 0.0);
              
              float shadowReflect = 1.0;
              if (uShowShadows > 0.5) {
                  shadowReflect = getShadow(pReflect + nReflect * 0.02, lDir, 0.05, 15.0, 16.0);
              }
              
              float aoReflect = 1.0;
              if (uShowAO > 0.5) {
                  aoReflect = getAO(pReflect, nReflect);
              }
              
              vec3 modelColor = mapScene(pReflect).xyz; // get dynamic color of reflected point!
              vec3 diffuseReflect = modelColor * diffReflect * uLightIntensity * shadowReflect;
              vec3 ambientReflect = modelColor * uAmbientIntensity * aoReflect;
              reflectCol = (diffuseReflect + ambientReflect) * aoReflect;
          }
          // Blend glossy reflection
          baseColor = mix(baseColor, reflectCol, 0.25 * fade);
      } else {
          // If we hit the scene, get the scene color dynamically!
          baseColor = mapScene(p).xyz;
      }
      
      // Dynamic Lighting
      vec3 lightDir = normalize(uLightDir);
      float diff = max(dot(n, lightDir), 0.0);
      
      // Specular highlight (Blinn-Phong)
      vec3 viewDir = normalize(cameraPos - p);
      vec3 halfDir = normalize(lightDir + viewDir);
      float spec = pow(max(dot(n, halfDir), 0.0), 32.0) * 0.4;
      
      float shadow = 1.0;
      if (uShowShadows > 0.5) {
          shadow = getShadow(p + n * 0.02, lightDir, 0.05, 15.0, 16.0);
      }
      
      float ao = 1.0;
      if (uShowAO > 0.5) {
          ao = getAO(p, n);
      }
      
      vec3 diffuse = baseColor * diff * uLightIntensity * shadow;
      vec3 specular = vec3(1.0) * spec * uLightIntensity * shadow;
      vec3 ambient = baseColor * uAmbientIntensity * ao;
      
      vec3 col = (diffuse + specular + ambient) * ao;
 
      fragColor = vec4(col, 1.0);
  }
  `;

  console.log("Compiled GLSL Shader:\n", shader);

  return shader;
}
