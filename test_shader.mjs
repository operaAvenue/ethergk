import * as THREE from 'three';
// Mock simple shader string
const frag = `
  precision highp float;
  out vec4 fragColor;
  void main() {
    fragColor = vec4(1.0);
  }
`;
console.log(frag);
