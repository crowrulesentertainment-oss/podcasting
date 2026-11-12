
import{challengeData}from"./challenge-data.js";const root=document.querySelector("#challenge-calendar");
const order=["thankful-voices","christmas-voices","new-year","valentines","easter","mothers-day","fathers-day","independence-day","back-to-school","halloween","veterans-day"];
root.innerHTML=order.map(k=>{const c=challengeData[k],href=k==="thankful-voices"?"../thankful-voices/index.html":k==="christmas-voices"?"../christmas-voices/index.html":"../"+k+"/index.html";return '<article class="calendar-card"><small>'+c.status+' · '+c.season+'</small><h3>'+c.title+'</h3><p>'+c.dates+'</p><p>'+c.description+'</p><a href="'+href+'">Explore challenge →</a></article>'}).join("");
