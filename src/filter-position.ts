export function filterPosition(rect:{left:number;top:number;bottom:number},requestedWidth:number,viewportWidth:number,viewportHeight:number){
 const margin=12,width=Math.max(1,Math.min(requestedWidth,viewportWidth-2*margin));
 const below=Math.max(0,viewportHeight-rect.bottom-margin-4),above=Math.max(0,rect.top-margin-4),up=below<240&&above>below;
 const maxHeight=Math.max(1,Math.min(420,viewportHeight-2*margin,up?above:below));
 return {left:Math.max(margin,Math.min(rect.left,viewportWidth-width-margin)),top:Math.max(margin,Math.min(up?rect.top-maxHeight-4:rect.bottom+4,viewportHeight-maxHeight-margin)),width,maxHeight};
}
