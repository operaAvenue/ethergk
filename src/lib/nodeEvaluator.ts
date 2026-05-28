import * as THREE from 'three';
import { useStore, LogicNodeData, AppNode } from '@/store/useStore';
import * as sdf from './sdfCore';
import { Edge } from '@xyflow/react';

export type SDFResult = { dist: number, color: THREE.Color };

// Compiles a node into a distance function
export function buildGraphSDF(): (p: THREE.Vector3) => SDFResult {
  const { nodes, edges } = useStore.getState();
  
  // Find the output node
  const outputNode = nodes.find(n => n.type === 'outputNode' || n.data.type === 'output');
  if (!outputNode) return () => ({ dist: 10000, color: new THREE.Color('#e879f9') });
  
  // Helper to find the node connected to a specific handle of a target node
  const getConnectedNode = (targetId: string, targetHandle?: string): AppNode | undefined => {
    const edge = edges.find(e => e.target === targetId && (!targetHandle || e.targetHandle === targetHandle));
    if (!edge) return undefined;
    return nodes.find(n => n.id === edge.source);
  };

  const defaultMissingColor = new THREE.Color('#e879f9');

  // Recursively compile the node into a distance function
  const compileNode = (node: AppNode): (p: THREE.Vector3) => SDFResult => {
    const data = node.data;
    
    switch (data.type) {
      case 'primitive': {
        const nodeColor = new THREE.Color(data.color || '#6366f1');
        return (p: THREE.Vector3) => {
          const transformedP = sdf.opTransform(p, new THREE.Vector3(...data.position));
          let dist = 10000;
          switch (data.shape) {
            case 'box': dist = sdf.sdBox(transformedP, new THREE.Vector3(data.scale, data.scale, data.scale)); break;
            case 'cylinder': dist = sdf.sdCylinder(transformedP, data.scale, data.scale / 2); break;
            case 'sphere':
            default: dist = sdf.sdSphere(transformedP, data.scale); break;
          }
          return { dist, color: nodeColor };
        };
      }
      
      case 'mesh': {
        const nodeColor = new THREE.Color(data.color || '#f97316');
        return (p: THREE.Vector3) => {
          if (!data.bvh || !data.geometry || !data.geometry.index) return { dist: 10000, color: nodeColor };
          
          const transformedP = sdf.opTransform(p, new THREE.Vector3(...data.position));
          const targetInfo: any = {};
          data.bvh.closestPointToPoint(transformedP, targetInfo);
          
          let signedDist = targetInfo.distance;
          if (targetInfo.faceIndex !== undefined) {
            const posAttr = data.geometry.attributes.position;
            const idxAttr = data.geometry.index;
            
            const a = new THREE.Vector3().fromBufferAttribute(posAttr, idxAttr.getX(targetInfo.faceIndex * 3));
            const b = new THREE.Vector3().fromBufferAttribute(posAttr, idxAttr.getX(targetInfo.faceIndex * 3 + 1));
            const c = new THREE.Vector3().fromBufferAttribute(posAttr, idxAttr.getX(targetInfo.faceIndex * 3 + 2));
            
            const cb = new THREE.Vector3().subVectors(c, b);
            const ab = new THREE.Vector3().subVectors(a, b);
            const faceNormal = cb.cross(ab).normalize();
            
            const dir = transformedP.clone().sub(targetInfo.point);
            if (dir.dot(faceNormal) < 0) {
              signedDist = -signedDist;
            }
          }
          return { dist: signedDist, color: nodeColor };
        };
      }
      
      case 'boolean': {
        const baseNode = getConnectedNode(node.id, 'base') || getConnectedNode(node.id); // fallback to any connection if no handle
        const toolNode = getConnectedNode(node.id, 'tool');
        
        const baseFunc = baseNode ? compileNode(baseNode) : () => ({ dist: 10000, color: defaultMissingColor });
        const toolFunc = toolNode ? compileNode(toolNode) : () => ({ dist: 10000, color: defaultMissingColor });
        
        return (p: THREE.Vector3) => {
          const r1 = baseFunc(p);
          const r2 = toolFunc(p);
          
          let finalDist = r1.dist;
          let finalColor = r1.color.clone();
          
          switch (data.operation) {
            case 'union':
              finalDist = sdf.opUnion(r1.dist, r2.dist);
              finalColor = r1.dist < r2.dist ? r1.color.clone() : r2.color.clone();
              break;
            case 'subtract':
              finalDist = sdf.opSubtract(r1.dist, r2.dist);
              finalColor = r1.dist > -r2.dist ? r1.color.clone() : r2.color.clone();
              break;
            case 'intersect':
              finalDist = sdf.opIntersect(r1.dist, r2.dist);
              finalColor = r1.dist > r2.dist ? r1.color.clone() : r2.color.clone();
              break;
            case 'smoothUnion': {
              finalDist = sdf.opSmoothUnion(r1.dist, r2.dist, data.smoothness);
              const h = THREE.MathUtils.clamp(0.5 + 0.5 * (r2.dist - r1.dist) / data.smoothness, 0.0, 1.0);
              finalColor = r2.color.clone().lerp(r1.color, h);
              break;
            }
            case 'smoothSubtract': {
              finalDist = sdf.opSmoothSubtract(r1.dist, r2.dist, data.smoothness);
              const h = THREE.MathUtils.clamp(0.5 - 0.5 * (-r2.dist - r1.dist) / data.smoothness, 0.0, 1.0);
              finalColor = r2.color.clone().lerp(r1.color, h);
              break;
            }
            case 'smoothIntersect': {
              finalDist = sdf.opSmoothIntersect(r1.dist, r2.dist, data.smoothness);
              const h = THREE.MathUtils.clamp(0.5 - 0.5 * (r2.dist - r1.dist) / data.smoothness, 0.0, 1.0);
              finalColor = r2.color.clone().lerp(r1.color, h);
              break;
            }
          }
          return { dist: finalDist, color: finalColor };
        };
      }
      
      case 'lattice': {
        const baseNode = getConnectedNode(node.id, 'base') || getConnectedNode(node.id);
        const baseFunc = baseNode ? compileNode(baseNode) : () => ({ dist: 10000, color: defaultMissingColor });
        const latticeColor = new THREE.Color(data.color || '#06b6d4');
        
        return (p: THREE.Vector3) => {
          const rBase = baseFunc(p);
          let latticeDist = 10000;
          switch (data.pattern) {
            case 'schwarzP': latticeDist = sdf.sdSchwarzP(p, data.scale, data.thickness); break;
            case 'diamond': latticeDist = sdf.sdDiamond(p, data.scale, data.thickness); break;
            case 'neovius': latticeDist = sdf.sdNeovius(p, data.scale, data.thickness); break;
            case 'iwp': latticeDist = sdf.sdIWP(p, data.scale, data.thickness); break;
            case 'frd': latticeDist = sdf.sdFRD(p, data.scale, data.thickness); break;
            case 'gyroid':
            default: latticeDist = sdf.sdGyroid(p, data.scale, data.thickness); break;
          }
          // Infill the base with lattice
          const finalDist = sdf.opIntersect(rBase.dist, latticeDist);
          const finalColor = rBase.dist > latticeDist ? rBase.color.clone() : latticeColor;
          return { dist: finalDist, color: finalColor };
        };
      }
      
      case 'modifier': {
        const baseNode = getConnectedNode(node.id, 'base') || getConnectedNode(node.id);
        const baseFunc = baseNode ? compileNode(baseNode) : () => ({ dist: 10000, color: defaultMissingColor });
        
        return (p: THREE.Vector3) => {
          const rBase = baseFunc(p);
          let finalDist = rBase.dist;
          if (data.modifierType === 'shell') {
            finalDist = sdf.opShell(rBase.dist, data.amount);
          } else {
            finalDist = sdf.opOffset(rBase.dist, data.amount);
          }
          return { dist: finalDist, color: rBase.color };
        };
      }
      
      default:
        return () => ({ dist: 10000, color: defaultMissingColor });
    }
  };

  // Start compilation from the node connected to Output
  const finalInputNode = getConnectedNode(outputNode.id);
  if (!finalInputNode) return () => ({ dist: 10000, color: defaultMissingColor });

  return compileNode(finalInputNode);
}
