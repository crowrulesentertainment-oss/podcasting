(()=>{
  "use strict";
  if(window.CROW_AUDIO_V20_GUARD)return;
  window.CROW_AUDIO_V20_GUARD=true;

  const KEY="crowrules-audio-queue-v20";
  let q=[];
  try{q=JSON.parse(localStorage.getItem(KEY)||"[]")}catch(_){q=[]}

  window.CROW_AUDIO_V20_API={
    queue:q,
    add(x){
      if(!x?.audio_url&&!x?.url)return false;
      q.push(x);
      try{localStorage.setItem(KEY,JSON.stringify(q))}catch(_){ }
      return true;
    },
    clear(){q=[];try{localStorage.setItem(KEY,"[]")}catch(_){}},
    next(){
      q.shift();
      try{localStorage.setItem(KEY,JSON.stringify(q))}catch(_){ }
      return q[0]||null;
    }
  };

  function pauseAudio(){
    const audio=document.getElementById("cr13Audio")||document.querySelector("audio");
    if(!audio)return;
    audio.autoplay=false;
    try{audio.pause()}catch(_){ }
  }

  function install(){
    const player=window.CROW_PLAYER;
    if(!player||typeof player.load!=="function")return false;
    if(player.load.__crowV20AutoplayGuard)return true;

    const original=player.load;
    const guarded=function(item,autoplay){
      const explicitPlay=autoplay===true;
      const result=original.call(this,item,explicitPlay);
      if(!explicitPlay){
        pauseAudio();
        requestAnimationFrame(pauseAudio);
        setTimeout(pauseAudio,0);
        setTimeout(pauseAudio,50);
      }
      return result;
    };
    guarded.__crowV20AutoplayGuard=true;
    guarded.__crowV20Original=original;
    player.load=guarded;
    window.CROW_AUDIO_V20_AUTOPLAY_GUARD=true;
    pauseAudio();
    return true;
  }

  function boot(){
    pauseAudio();
    if(install())return;
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      if(install()||attempts>80)clearInterval(timer);
    },100);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();
