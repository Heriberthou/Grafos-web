// All thumbnails use the same geographic extent, including curved geometry.
export function geographicPreview(graph,route){
 const points=[...Object.values(graph.nodes).map(n=>n.coordinates),...Object.values(graph.edges).flatMap(e=>e.geometry)];
 if(!points.length)return '';
 const cos=Math.cos(points.reduce((s,p)=>s+p.lat,0)/points.length*Math.PI/180);
 const xs=points.map(p=>p.lng*cos),ys=points.map(p=>-p.lat);
 const minX=xs.reduce((a,b)=>Math.min(a,b),Infinity),maxX=xs.reduce((a,b)=>Math.max(a,b),-Infinity),minY=ys.reduce((a,b)=>Math.min(a,b),Infinity),maxY=ys.reduce((a,b)=>Math.max(a,b),-Infinity);
 const scale=Math.min(272/(maxX-minX||1e-9),152/(maxY-minY||1e-9));
 const project=p=>[150+(p.lng*cos-(minX+maxX)/2)*scale,90+(-p.lat-(minY+maxY)/2)*scale];
 const path=e=>e.geometry.map(p=>project(p).map(v=>v.toFixed(2)).join(',')).join(' ');
 const edges=Object.values(graph.edges),active=new Set(route.edges),visited=new Set(route.visited);
 const draw=(e,color,width)=>`<polyline points="${path(e)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
 const nodes=Object.values(graph.nodes).map(n=>{const [x,y]=project(n.coordinates),color=route.nodes.includes(n.id)?'#bb8015':visited.has(n.id)?'#96bbc2':'#638774';return n.type==='support'?`<rect x="${x-2.5}" y="${y-2.5}" width="5" height="5" fill="${color}"/>`:`<circle cx="${x}" cy="${y}" r="3.5" fill="${color}" stroke="white" stroke-width="1"/>`;}).join('');
 const ends=route.found?[route.nodes[0],route.nodes.at(-1)].map((id,i)=>{const [x,y]=project(graph.nodes[id].coordinates);return `<circle cx="${x}" cy="${y}" r="7" fill="none" stroke="${i?'#7353c5':'#226449'}" stroke-width="2"/><text x="${x+9}" y="${y-8}" font-size="10" fill="#233b33">${i?'D':'O'}</text>`;}).join(''):'';
 return `<svg viewBox="0 0 300 180" role="img" aria-label="Recorrido sobre la geometría geográfica del grafo"><rect width="300" height="180" fill="#f1f5ee"/>${edges.map(e=>draw(e,'#c5d3c6',1.5)).join('')}${edges.filter(e=>active.has(e.id)).map(e=>draw(e,'#bb8015',3)).join('')}${nodes}${ends}</svg>`;
}
