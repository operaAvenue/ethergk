import { useGpuStore, AppNode, LogicNodeData } from '@/store/useGpuStore';

// Common SDF math library in GLSL
const SDF_LIBRARY = `
#define MAX_STEPS 150
#define MAX_DIST 100.0
#define SURF_DIST 0.001

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

// Booleans
float opUnion(float d1, float d2) { return min(d1,d2); }
float opSubtract(float d1, float d2) { return max(-d1,d2); }
float opIntersect(float d1, float d2) { return max(d1,d2); }

float opSmoothUnion(float d1, float d2, float k) {
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
}
float opSmoothSubtract(float d1, float d2, float k) {
    float h = clamp( 0.5 - 0.5*(d2+d1)/k, 0.0, 1.0 );
    return mix( d2, -d1, h ) + k*h*(1.0-h);
}
float opSmoothIntersect(float d1, float d2, float k) {
    float h = clamp( 0.5 - 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) + k*h*(1.0-h);
}

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
float sdGrid(vec3 p, float scale, float thickness) {
    p *= scale;
    vec3 q = abs(fract(p) - 0.5);
    float dX = max(q.y, q.z);
    float dY = max(q.x, q.z);
    float dZ = max(q.x, q.y);
    float val = min(dX, min(dY, dZ)) - 0.2;
    return (val - thickness) / scale;
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
    float c = cos(k*p.y);
    float s = sin(k*p.y);
    mat2  m = mat2(c,-s,s,c);
    vec3  q = vec3(m*p.xz,p.y);
    // Simple scaling by height
    float scale = 1.0 + p.y * k;
    return vec3(p.x / scale, p.y, p.z / scale);
}

vec3 opRepeat(vec3 p, vec3 c) {
    vec3 q = p;
    if(c.x > 0.0) q.x = mod(q.x+0.5*c.x,c.x)-0.5*c.x;
    if(c.y > 0.0) q.y = mod(q.y+0.5*c.y,c.y)-0.5*c.y;
    if(c.z > 0.0) q.z = mod(q.z+0.5*c.z,c.z)-0.5*c.z;
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
    
    // Sample texture
    float val = texture(tex, uvw).r;
    // DEBUG: return a sphere instead to see if the shader is actually running this code for the node
    vec3 center = (bboxMin + bboxMax) * 0.5;
    return length(p - center) - 3.0;
}
`;

// Build Map Function dynamically
export function compileGraphToGLSL(): string {
  const { nodes, edges } = useGpuStore.getState();
  
  const outputNode = nodes.find(n => n.type === 'outputNode' || n.data.type === 'output');
  if (!outputNode) return '';

  const getConnectedNodes = (targetId: string, handle?: string) => {
    const connectedEdges = edges.filter(e => e.target === targetId && (!handle || e.targetHandle === handle));
    return connectedEdges.map(e => nodes.find(n => n.id === e.source)).filter((n): n is AppNode => n !== undefined);
  };

  let mapBody = '';
  
  // To avoid redundant calculations and infinite recursion, we use a Post-Order Traversal
  // But for a DAG shader, we can just declare the node functions top down or resolve them recursively.
  // Instead of full DAG deduplication (complex), we'll do an inline tree expansion for the MVP.
  
  const generateNodeCode = (node: AppNode, pointVar: string): string => {
    const d = node.data as any;
    
    switch (node.data.type) {
      case 'primitive': {
        const pStr = `${d.position[0].toFixed(5)}, ${d.position[1].toFixed(5)}, ${d.position[2].toFixed(5)}`;
        const sStr = (d.scale || 1.0).toFixed(5);
        if (d.shape === 'box') return `sdBox(${pointVar} - vec3(${pStr}), vec3(${sStr}))`;
        if (d.shape === 'sphere') return `sdSphere(${pointVar} - vec3(${pStr}), ${sStr})`;
        if (d.shape === 'cylinder') return `sdCylinder(${pointVar} - vec3(${pStr}), vec3(${sStr}, ${sStr}, ${sStr}))`;
        return '10000.0';
      }

      case 'boolean': {
        const base = getConnectedNodes(node.id, 'base')[0];
        const shapeB = getConnectedNodes(node.id, 'shapeB')[0];
        if (!base) return '10000.0';
        const d1 = generateNodeCode(base, pointVar);
        const d2 = shapeB ? generateNodeCode(shapeB, pointVar) : '10000.0';
        
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
        const baseCode = base ? generateNodeCode(base, pointVar) : '10000.0';
        let latCode = '10000.0';
        const ls = (d.scale || 1.0).toFixed(5);
        const lt = (d.thickness || 0.1).toFixed(5);
        switch (d.pattern) {
          case 'gyroid': latCode = `sdGyroid(${pointVar}, ${ls}, ${lt})`; break;
          case 'schwarzP': latCode = `sdSchwarzP(${pointVar}, ${ls}, ${lt})`; break;
          case 'diamond': latCode = `sdDiamond(${pointVar}, ${ls}, ${lt})`; break;
          case 'grid': latCode = `sdGrid(${pointVar}, ${ls}, ${lt})`; break;
          default: latCode = `sdGyroid(${pointVar}, ${ls}, ${lt})`; break;
        }
        return `opIntersect(${baseCode}, ${latCode})`;
      }

      case 'transform': {
        const base = getConnectedNodes(node.id, 'base')[0] || getConnectedNodes(node.id)[0];
        if (!base) return '10000.0';
        
        // Inverse transform the point
        // Rotate then translate
        // In GLSL: pointVar is a string, so we need to create a temporary variable block, or use inline
        // Inline is cleaner:
        // p - translate, then rot()
        
        const tx = d.translate[0].toFixed(3);
        const ty = d.translate[1].toFixed(3);
        const tz = d.translate[2].toFixed(3);
        
        // Very basic inline transform (translate only for now to avoid huge inline strings)
        // A better way is to declare variables, but let's do simple translate:
        const tPoint = `(${pointVar} - vec3(${tx}, ${ty}, ${tz}))`;
        
        return generateNodeCode(base, tPoint);
      }

      case 'deform': {
        const base = getConnectedNodes(node.id, 'base')[0] || getConnectedNodes(node.id)[0];
        if (!base) return '10000.0';
        let dp = pointVar;
        if (d.deformType === 'twist') dp = `opTwist(${pointVar}, ${d.strength.toFixed(3)})`;
        if (d.deformType === 'taper') dp = `opTaper(${pointVar}, ${d.strength.toFixed(3)})`;
        return generateNodeCode(base, dp);
      }

      case 'repeat': {
        const base = getConnectedNodes(node.id, 'base')[0] || getConnectedNodes(node.id)[0];
        if (!base) return '10000.0';
        const dp = `opRepeat(${pointVar}, vec3(${d.spacing.map((v:any)=>v.toFixed(3)).join(',')}))`;
        return generateNodeCode(base, dp);
      }

      case 'symmetry': {
        const base = getConnectedNodes(node.id, 'base')[0] || getConnectedNodes(node.id)[0];
        if (!base) return '10000.0';
        let dp = pointVar;
        if (d.symType === 'symX') dp = `opSymX(${pointVar})`;
        if (d.symType === 'symY') dp = `opSymY(${pointVar})`;
        if (d.symType === 'symZ') dp = `opSymZ(${pointVar})`;
        if (d.symType === 'radial') dp = `opSymRadial(${pointVar}, ${(d.slices||6).toFixed(1)})`;
        return generateNodeCode(base, dp);
      }
      
      case 'mesh':
        console.log("Compiling mesh node. Data:", d);
        if (d.sdfTexture && d.bboxMin && d.bboxMax) {
          const texName = `u_meshTex_${node.id.replace(/-/g, '_')}`;
          const bMin = `vec3(${d.bboxMin[0].toFixed(5)}, ${d.bboxMin[1].toFixed(5)}, ${d.bboxMin[2].toFixed(5)})`;
          const bMax = `vec3(${d.bboxMax[0].toFixed(5)}, ${d.bboxMax[1].toFixed(5)}, ${d.bboxMax[2].toFixed(5)})`;
          return `sdMeshTexture(${pointVar}, ${texName}, ${bMin}, ${bMax})`;
        }
        return '10000.0';

      default:
        return '10000.0';
    }
  };

  const finalInputNodes = getConnectedNodes(outputNode.id);
  if (finalInputNodes.length === 0) {
    mapBody = 'return 10000.0;';
  } else {
    // Union all inputs to OutputNode
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
  ${meshUniforms}

  ${SDF_LIBRARY}

  float map(vec3 p) {
      ${mapBody}
  }

  vec3 getNormal(vec3 p) {
      float d = map(p);
      vec2 e = vec2(.001, 0);
      vec3 n = d - vec3(
          map(p-e.xyy),
          map(p-e.yxy),
          map(p-e.yyx));
      return normalize(n);
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

  out vec4 fragColor;

  void main() {
      // Screen coordinates from -1 to 1
      vec2 uv = vUv * 2.0 - 1.0;
      uv.x *= resolution.x / resolution.y;

      // Camera setup
      vec3 ro = cameraPos;
      vec3 rd = normalize(uv.x * cameraRight + uv.y * cameraUp + 1.0 * cameraDir);

      float d = rayMarch(ro, rd);

      if (d > MAX_DIST) {
          fragColor = vec4(0.035, 0.035, 0.043, 1.0); // bg-zinc-950
          return;
      }

      vec3 p = ro + rd * d;
      vec3 n = getNormal(p);
      
      // Basic lighting
      vec3 lightDir = normalize(vec3(10.0, 10.0, 5.0));
      float diff = max(dot(n, lightDir), 0.0);
      vec3 col = vec3(0.02, 0.7, 0.8) * diff; // Cyan color
      
      // Ambient
      col += vec3(0.1);

      fragColor = vec4(col, 1.0);
  }
  `;

  console.log("Compiled GLSL Shader:\n", shader);

  return shader;
}
