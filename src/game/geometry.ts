import data from './data/gunGeometry.json';
export const gunGeometry=(art:number)=>(data as Record<string,{length:number;tipX:number;tipY:number;ratio:number}>)[art];
export function muzzlePoint(art:number,x:number,y:number,angle:number){const d=gunGeometry(art),flip=Math.cos(angle)<0?-1:1;const dx=(d.tipX-.3)*d.length,dy=(d.tipY-.55)*d.length*d.ratio*flip;return {x:x+Math.cos(angle)*dx-Math.sin(angle)*dy,y:y+Math.sin(angle)*dx+Math.cos(angle)*dy};}
