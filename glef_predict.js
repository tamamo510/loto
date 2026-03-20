// GLEF v6.3 Prediction Engine - Node.js port for round 669
// Uses only data up to round 668

// Load data
const fs=require('fs');
const dataContent=fs.readFileSync('./data.js','utf8');
// Extract LOTO7_DATA value
const loto7Line=dataContent.split('\n').find(l=>l.startsWith('const LOTO7_DATA'));
const loto7Val=loto7Line.replace(/^const LOTO7_DATA\s*=\s*/,'').replace(/;$/,'');
const LOTO7_DATA=JSON.parse(loto7Val);

const CFG={
  loto7:{max:37,pick:7,bCnt:2,zones:{A:[1,10],B:[11,19],C:[20,28],D:[29,37]},mean:133,sumR:[100,200],renKill:5,conFilt:3,label:'Loto7'}
};
const WL=0.5,WM=0.3,WS=0.2;
const GA_CFG={popSize:100,generations:200,eliteCount:5,tournamentSize:3,mutationRate:0.1};
let gameType='loto7';
let learnedParams={depthMult:1,vertMult:1,horzMult:1,crossMult:1,coMult:1};
let waveEntropyMode='neutral';

function zone(n){
  const z=CFG.loto7.zones;
  for(const[k,[lo,hi]] of Object.entries(z)){if(n>=lo&&n<=hi)return k;}
  return 'D';
}
function zoneCnt(nums){
  const c={A:0,B:0,C:0,D:0};
  nums.forEach(n=>c[zone(n)]++);
  return c;
}
function zoneEntropy(numbers){
  const zc=zoneCnt(numbers);
  const total=numbers.length;
  if(total===0)return 0;
  let H=0;
  Object.values(zc).forEach(c=>{if(c>0){const p=c/total;H-=p*Math.log2(p);}});
  return H;
}
function entropyTrend(draws){
  const w=Math.min(20,draws.length);
  if(w<5)return{mode:'neutral',avg:1.0,trend:0,recent:[]};
  const recent=draws.slice(-w);
  const entropies=recent.map(d=>zoneEntropy(d.numbers));
  const avg=entropies.reduce((a,b)=>a+b,0)/entropies.length;
  const half=Math.floor(w/2);
  const firstHalf=entropies.slice(0,half).reduce((a,b)=>a+b,0)/half;
  const secondHalf=entropies.slice(half).reduce((a,b)=>a+b,0)/(w-half);
  const trend=secondHalf-firstHalf;
  let mode='neutral';
  if(avg<1.5)mode='cluster';
  else if(avg>1.8)mode='spread';
  waveEntropyMode=mode;
  return{mode,avg,trend,recent:entropies};
}
function depthWave(num,draws){
  const c=CFG.loto7;
  const expectedGap=c.max/c.pick;
  const fn=(data)=>{
    let gap=data.length;
    for(let i=data.length-1;i>=0;i--){if(data[i].numbers.includes(num)){gap=data.length-1-i;break;}}
    const freq=data.filter(d=>d.numbers.includes(num)).length;
    const expectedFreq=data.length*c.pick/c.max;
    const freqRatio=freq/Math.max(1,expectedFreq);
    let gapScore;
    if(gap<=1)gapScore=5;
    else if(gap<=Math.floor(expectedGap*0.7))gapScore=3;
    else if(gap<=Math.floor(expectedGap*1.3))gapScore=10+gap*0.5;
    else if(gap<=Math.floor(expectedGap*2))gapScore=15+(gap-expectedGap)*1.2;
    else if(gap<=Math.floor(expectedGap*3))gapScore=20;
    else gapScore=10;
    if(freqRatio>1.1)gapScore+=5;
    else if(freqRatio<0.8)gapScore-=3;
    return gapScore;
  };
  return(fn(draws)*WL+fn(draws.slice(-100))*WM+fn(draws.slice(-20))*WS)*learnedParams.depthMult;
}
function vertWave(num,draws){
  const n=draws.length;if(n<3)return 0;
  const t1=draws[n-1]?.numbers||[],t2=draws[n-2]?.numbers||[],t3=draws[n-3]?.numbers||[];
  let ss=0;if(t2.includes(num))ss+=20;if(t3.includes(num))ss+=15;
  if(t1.includes(num)){
    const f=draws.slice(-10).filter(d=>d.numbers.includes(num)).length;
    if(waveEntropyMode==='cluster'){if(f>=3)ss+=12;else if(f>=2)ss+=8;else ss+=2;}
    else{if(f>=3)ss+=8;else if(f>=2)ss+=5;else ss-=5;}
  }
  let ms=0;const md=draws.slice(-50);
  for(let g=10;g<=Math.min(50,md.length);g++){
    const i=md.length-g;if(i>=0&&md[i].numbers.includes(num))ms+=Math.max(0,12-(g-10)*.3);
  }
  ms=Math.min(ms,15);
  let ls=0;
  for(let g=100;g<=Math.min(200,draws.length);g+=10){
    const i=draws.length-g;if(i>=0&&draws[i].numbers.includes(num))ls+=5;
  }
  ls=Math.min(ls,15);
  return(ss*WS+ms*WM+ls*WL)*learnedParams.vertMult;
}
function horzWave(num,draws){
  const z=zone(num);const[lo,hi]=CFG.loto7.zones[z];
  const pr=draws.map(d=>{let c=0;d.numbers.forEach(n=>{if(n>=lo&&n<=hi)c++;});return c;});
  const macd=(d,s,l)=>{
    if(d.length<l)return 0;
    return d.slice(-s).reduce((a,b)=>a+b,0)/s-d.slice(-l).reduce((a,b)=>a+b,0)/l;
  };
  const sm=macd(pr,20,50),mm=macd(pr,50,100),lm=pr.length>200?macd(pr,100,200):mm;
  let ss=sm>.2?10:sm<-.2?-5:0,ms=mm>.2?8:mm<-.2?-3:0,ls=lm>.1?5:lm<-.1?-2:0;
  let bonus=sm<-.2&&lm>.1?5:0;
  return(ss*WS+ms*WM+ls*WL+bonus)*learnedParams.horzMult;
}
function buildMatrix(draws){
  const mx=CFG.loto7.max;
  const m=Array.from({length:mx+1},()=>new Float32Array(mx+1));
  draws.forEach(d=>{
    for(let i=0;i<d.numbers.length;i++)
      for(let j=i+1;j<d.numbers.length;j++){
        m[d.numbers[i]][d.numbers[j]]++;m[d.numbers[j]][d.numbers[i]]++;
      }
  });
  const mv=Math.max(1,...m.flatMap(r=>[...r]));
  for(let i=1;i<=mx;i++)for(let j=1;j<=mx;j++)m[i][j]/=mv;
  return m;
}
function crossWave(num,tops,mat){
  let s=0;tops.forEach(t=>{if(t!==num&&mat[t]&&mat[t][num]>=.3)s+=mat[t][num]*10;});
  if(mat[num]){
    const p=num>1?mat[num][num-1]:0,nx=num<CFG.loto7.max?mat[num][num+1]:0;
    if(p>.5||nx>.5)s-=20;
  }
  const raw=Math.max(s,-10)*learnedParams.crossMult;
  return Math.min(raw,30);
}
function coBias(num,draws){
  const hi=draws.filter(d=>d.co>=5e8),no=draws.filter(d=>d.co<5e8);
  if(hi.length<5||no.length<5)return 0;
  return(hi.filter(d=>d.numbers.includes(num)).length/hi.length-no.filter(d=>d.numbers.includes(num)).length/no.length)*5*learnedParams.coMult;
}
// ===== FFT (Cooley-Tukey radix-2) =====
function fft(re,im){
  const N=re.length;
  for(let i=1,j=0;i<N;i++){
    let bit=N>>1;
    for(;j&bit;bit>>=1)j^=bit;
    j^=bit;
    if(i<j){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t;}
  }
  for(let len=2;len<=N;len<<=1){
    const ang=-2*Math.PI/len,wr=Math.cos(ang),wi=Math.sin(ang);
    for(let i=0;i<N;i+=len){
      let cr=1,ci=0;
      for(let j=0;j<len>>1;j++){
        const ur=re[i+j],ui=im[i+j];
        const vr=re[i+j+(len>>1)]*cr-im[i+j+(len>>1)]*ci;
        const vi=re[i+j+(len>>1)]*ci+im[i+j+(len>>1)]*cr;
        re[i+j]=ur+vr;im[i+j]=ui+vi;
        re[i+j+(len>>1)]=ur-vr;im[i+j+(len>>1)]=ui-vi;
        const ncr=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=ncr;
      }
    }
  }
}
function fourierWave(num,draws){
  const winSize=Math.min(draws.length,256);
  if(winSize<16)return 0;
  let N=16;while(N<winSize)N<<=1;
  const re=new Float64Array(N),im=new Float64Array(N);
  const startIdx=draws.length-winSize;
  for(let i=0;i<winSize;i++)re[i]=draws[startIdx+i].numbers.includes(num)?1:0;
  fft(re,im);
  const N2=N>>1;
  const power=[];
  for(let k=1;k<N2;k++)power.push({k,p:re[k]*re[k]+im[k]*im[k],ph:Math.atan2(im[k],re[k])});
  power.sort((a,b)=>b.p-a.p);
  const top3=power.slice(0,3);
  const maxP=top3.length?top3[0].p:1;
  let score=0;
  const drawCount=draws.length;
  for(const{k,p,ph} of top3){
    if(p<1e-9)continue;
    const curPhase=(drawCount*2*Math.PI*k/N)%(2*Math.PI);
    const alignment=Math.cos(curPhase-ph);
    const relPower=Math.sqrt(p)/Math.max(1e-9,Math.sqrt(maxP));
    score+=alignment*relPower*5;
  }
  return Math.max(-10,Math.min(15,score))*(learnedParams.fourierMult||1);
}
function calcTrend(draws){
  const c=CFG.loto7,n=draws.length;if(n<3)return{oddT:4,sumT:c.mean};
  const ma3=draws.slice(-3).reduce((s,d)=>s+d.odd,0)/3;
  const ma20=draws.slice(-20).reduce((s,d)=>s+d.odd,0)/Math.min(20,n);
  const maA=draws.reduce((s,d)=>s+d.odd,0)/n;
  const wma=ma3*WS+ma20*WM+maA*WL;
  let oddT=wma>=4?5:wma<=3?3:4;
  const ls=draws[n-1].sum;
  const a20=draws.slice(-20).reduce((s,d)=>s+d.sum,0)/Math.min(20,n);
  const aL=draws.reduce((s,d)=>s+d.sum,0)/n;
  const wa=a20*.3+aL*.7;
  let sumT=Math.round(ls<wa-20?wa+10:ls>wa+20?wa-10:wa);
  return{oddT,sumT,wma,ls,wa};
}
function killCheck(nums,mode){
  const c=CFG.loto7,sorted=[...nums].sort((a,b)=>a-b),reasons=[];
  let mx=1,st=1;
  for(let i=1;i<sorted.length;i++){if(sorted[i]-sorted[i-1]===1){st++;mx=Math.max(mx,st);}else st=1;}
  if(mx>=c.renKill)reasons.push(`${mx}renban`);
  if(mx>=c.conFilt)reasons.push(`${mx}consec`);
  const sum=sorted.reduce((a,b)=>a+b,0);
  if(sum<c.sumR[0]||sum>c.sumR[1])reasons.push(`sum=${sum}`);
  const zoneLimit=mode==='cluster'?6:5;
  const zc=zoneCnt(sorted);if(Object.values(zc).some(v=>v>=zoneLimit))reasons.push('zone5+');
  const od=sorted.filter(n=>n%2===1).length;if(od===0||od===sorted.length)reasons.push('all-odd/even');
  let skipCnt=1;
  for(let i=1;i<sorted.length;i++){
    if(sorted[i]-sorted[i-1]===2){skipCnt++;}else{if(skipCnt>=3)break;skipCnt=1;}
  }
  if(skipCnt>=3)reasons.push(`skip1x${skipCnt}`);
  return reasons;
}
function killCheckRelaxed(nums){
  const c=CFG.loto7,sorted=[...nums].sort((a,b)=>a-b),reasons=[];
  let mx=1,st=1;
  for(let i=1;i<sorted.length;i++){if(sorted[i]-sorted[i-1]===1){st++;mx=Math.max(mx,st);}else st=1;}
  if(mx>=c.renKill+1)reasons.push(mx+'renban');
  const sum=sorted.reduce((a,b)=>a+b,0);
  if(sum<c.sumR[0]-20||sum>c.sumR[1]+20)reasons.push('sum='+sum);
  const zc=zoneCnt(sorted);if(Object.values(zc).some(v=>v>3))reasons.push('zone4+');
  const od=sorted.filter(n=>n%2===1).length;if(od===0||od===sorted.length)reasons.push('all-odd/even');
  return reasons;
}
function gaFitness(ind,scoreMap,trend,eInfo,lastDraw){
  const kr=killCheck(ind,eInfo?eInfo.mode:undefined);if(kr.length>0)return 0;
  let ws=0;ind.forEach(n=>{ws+=(scoreMap[n]||0);});
  const sum=ind.reduce((a,b)=>a+b,0);
  const sp=-Math.abs(sum-trend.sumT)*0.5;
  const odd=ind.filter(n=>n%2===1).length;
  const oe=-Math.abs(odd-trend.oddT)*3;
  let ea=0;const H=zoneEntropy(ind);
  if(eInfo.mode==='cluster')ea=(H<1.5)?5:(H>1.8)?-5:0;
  else if(eInfo.mode==='spread')ea=(H>1.8)?6:(H<1.3)?-6:0;
  else ea=(H>1.5&&H<1.9)?2:0;
  let carryPen=0;
  if(lastDraw&&lastDraw.length>0){
    const carry=ind.filter(n=>lastDraw.includes(n)).length;
    if(carry>=3)carryPen=-carry*15;
    else if(carry===2)carryPen=-12;
    else if(carry===1)carryPen=3;
    else carryPen=1;
  }
  const zc=zoneCnt(ind);
  const zonesUsed=Object.values(zc).filter(v=>v>0).length;
  const zoneSpr=(zonesUsed>=3)?zonesUsed*2:-(3-zonesUsed)*3;
  const sorted=[...ind].sort((a,b)=>a-b);
  let maxCon=1,curCon=1;
  for(let i=1;i<sorted.length;i++){if(sorted[i]-sorted[i-1]===1){curCon++;maxCon=Math.max(maxCon,curCon);}else curCon=1;}
  const conPen=maxCon>=3?-(maxCon-2)*5:0;
  return Math.max(0.001,ws+sp+oe+ea+carryPen+zoneSpr+conPen);
}
function tournamentSelect(pop,fit,tSize){
  let bIdx=-1,bFit=-Infinity;
  for(let i=0;i<tSize;i++){const idx=Math.floor(Math.random()*pop.length);if(fit[idx]>bFit){bFit=fit[idx];bIdx=idx;}}
  return pop[bIdx];
}
function uniformCrossover(p1,p2,maxNum){
  const child=[],used=new Set();
  for(let i=0;i<p1.length;i++){const g=Math.random()<0.5?p1[i]:p2[i];if(!used.has(g)){child.push(g);used.add(g);}}
  for(const g of [...p1,...p2]){if(child.length>=p1.length)break;if(!used.has(g)){child.push(g);used.add(g);}}
  while(child.length<p1.length){const r=Math.floor(Math.random()*CFG.loto7.max)+1;if(!used.has(r)){child.push(r);used.add(r);}}
  return child.sort((a,b)=>a-b);
}
function mutate(ind,maxNum,rate){
  if(Math.random()>rate)return ind;
  const idx=Math.floor(Math.random()*ind.length),used=new Set(ind);
  let nv;do{nv=Math.floor(Math.random()*maxNum)+1;}while(used.has(nv));
  ind[idx]=nv;return ind.sort((a,b)=>a-b);
}
function selectTop18(scores){
  const sel=[];
  ['A','B','C','D'].forEach(z=>{const b=scores.find(s=>zone(s.num)===z&&!sel.includes(s));if(b)sel.push(b);});
  scores.forEach(s=>{if(sel.length<18&&!sel.find(x=>x.num===s.num))sel.push(s);});
  return sel;
}
function genPrediction(top18,trend,scores,entropyInfo,draws){
  const c=CFG.loto7,pk=c.pick,mx=c.max;
  if(!entropyInfo)entropyInfo={mode:'neutral',avg:1.5,trend:0,recent:[]};
  const scoreMap={};(scores||[]).forEach(s=>{scoreMap[s.num]=s.total;});
  const lastDraw=draws&&draws.length>0?draws[draws.length-1].numbers:[];
  const pool=top18.map(s=>s.num);
  let pop=[];
  for(let i=0;i<GA_CFG.popSize;i++){
    const sh=[...pool].sort(()=>Math.random()-0.5);
    pop.push(sh.slice(0,pk).sort((a,b)=>a-b));
  }
  let bestEver=null,bestFitEver=-Infinity;
  for(let gen=0;gen<GA_CFG.generations;gen++){
    const fit=pop.map(ind=>gaFitness(ind,scoreMap,trend,entropyInfo,lastDraw));
    fit.forEach((f,i)=>{if(f>bestFitEver){bestFitEver=f;bestEver=[...pop[i]];}});
    const idx=fit.map((f,i)=>({f,i})).sort((a,b)=>b.f-a.f);
    const np=[];
    for(let e=0;e<GA_CFG.eliteCount;e++)np.push([...pop[idx[e].i]]);
    while(np.length<GA_CFG.popSize){
      const p1=tournamentSelect(pop,fit,GA_CFG.tournamentSize);
      const p2=tournamentSelect(pop,fit,GA_CFG.tournamentSize);
      let ch=uniformCrossover(p1,p2,mx);
      ch=mutate(ch,mx,GA_CFG.mutationRate);
      np.push(ch);
    }
    pop=np;
  }
  const finalFit=pop.map(ind=>gaFitness(ind,scoreMap,trend,entropyInfo,lastDraw));
  let bIdx=0;finalFit.forEach((f,i)=>{if(f>finalFit[bIdx])bIdx=i;});
  let best=pop[bIdx];
  if(bestEver&&bestFitEver>finalFit[bIdx])best=bestEver;
  best.sort((a,b)=>a-b);
  const kr=killCheck(best);
  return{numbers:best,score:bestFitEver,sum:best.reduce((a,b)=>a+b,0),oe:[best.filter(n=>n%2===1).length,best.filter(n=>n%2===0).length],zones:zoneCnt(best),kr,pass:kr.length===0};
}
function genAntiTheoryShot(scores,trend,entropyInfo,mainPred){
  const c=CFG.loto7,pk=c.pick,mx=c.max;
  const scoreMap={};scores.forEach(s=>{scoreMap[s.num]=s.total;});
  let pop=[];
  for(let i=0;i<GA_CFG.popSize;i++){
    const ind=[],used=new Set();
    while(ind.length<pk){const n=Math.floor(Math.random()*mx)+1;if(!used.has(n)){ind.push(n);used.add(n);}}
    pop.push(ind.sort((a,b)=>a-b));
  }
  let bestEver=null,bestFitEver=-Infinity;
  for(let gen=0;gen<GA_CFG.generations;gen++){
    const fit=pop.map(ind=>{
      const kr=killCheckRelaxed(ind);if(kr.length>0)return 0;
      const overlap=ind.filter(n=>mainPred.includes(n)).length;
      if(overlap>3)return 0.001;
      let ws=0;ind.forEach(n=>{ws+=(scoreMap[n]||0);});
      const sum=ind.reduce((a,b)=>a+b,0);
      const sp=-Math.abs(sum-trend.sumT)*0.3;
      const odd=ind.filter(n=>n%2===1).length;
      const oe=-Math.abs(odd-trend.oddT)*2;
      let ea=0;const H=zoneEntropy(ind);
      if(entropyInfo.mode==='cluster')ea=(H<1.3)?3:0;
      else if(entropyInfo.mode==='spread')ea=(H>1.9)?3:0;
      const div=(pk-overlap)*3.0;
      const overlapPen=overlap>=3?-(overlap-2)*5:0;
      return Math.max(0.001,ws+sp+oe+ea+div+overlapPen);
    });
    fit.forEach((f,i)=>{if(f>bestFitEver){bestFitEver=f;bestEver=[...pop[i]];}});
    const idx=fit.map((f,i)=>({f,i})).sort((a,b)=>b.f-a.f);
    const np=[];
    for(let e=0;e<GA_CFG.eliteCount;e++)np.push([...pop[idx[e].i]]);
    while(np.length<GA_CFG.popSize){
      const p1=tournamentSelect(pop,fit,GA_CFG.tournamentSize);
      const p2=tournamentSelect(pop,fit,GA_CFG.tournamentSize);
      let ch=uniformCrossover(p1,p2,mx);
      ch=mutate(ch,mx,GA_CFG.mutationRate*1.5);
      np.push(ch);
    }
    pop=np;
  }
  const finalFit=pop.map(ind=>{
    const kr=killCheckRelaxed(ind);if(kr.length>0)return 0;
    const overlap=ind.filter(n=>mainPred.includes(n)).length;if(overlap>3)return 0.001;
    let ws=0;ind.forEach(n=>{ws+=(scoreMap[n]||0);});return ws;
  });
  let bIdx=0;finalFit.forEach((f,i)=>{if(f>finalFit[bIdx])bIdx=i;});
  let best=pop[bIdx];
  if(bestEver&&bestFitEver>finalFit[bIdx])best=bestEver;
  best.sort((a,b)=>a-b);
  const kr=killCheckRelaxed(best);
  const overlap=best.filter(n=>mainPred.includes(n)).length;
  return{numbers:best,score:bestFitEver,sum:best.reduce((a,b)=>a+b,0),kr,overlap,recommended:entropyInfo.mode==='cluster'};
}
function deterministicPick(pool,pick,scoreMap,trend,eInfo,lastDraw){
  const sorted=[...pool].sort((a,b)=>(scoreMap[b]||0)-(scoreMap[a]||0));
  let bestCombo=null,bestFit=-Infinity;
  function tryGreedy(candidates){
    const combo=[];const zones={A:0,B:0,C:0,D:0};let carryCount=0;
    for(const n of candidates){
      if(combo.length>=pick)break;
      const z=zone(n);
      if(zones[z]>=3)continue;
      if(lastDraw&&lastDraw.includes(n)){if(carryCount>=2)continue;carryCount++;}
      combo.push(n);zones[z]++;
    }
    for(const n of candidates){if(combo.length>=pick)break;if(!combo.includes(n))combo.push(n);}
    return combo.slice(0,pick).sort((a,b)=>a-b);
  }
  const c1=tryGreedy(sorted);const f1=gaFitness(c1,scoreMap,trend,eInfo,lastDraw);
  if(f1>bestFit){bestFit=f1;bestCombo=c1;}
  const c2=tryGreedy(sorted);const f2=gaFitness(c2,scoreMap,trend,eInfo,lastDraw);
  if(f2>bestFit){bestFit=f2;bestCombo=c2;}
  for(let r=0;r<8;r++){
    const shuffled=[...sorted];
    for(let i=0;i<shuffled.length-1;i+=2){if(Math.random()<0.4){const t=shuffled[i];shuffled[i]=shuffled[i+1];shuffled[i+1]=t;}}
    const cr=tryGreedy(shuffled);const fr=gaFitness(cr,scoreMap,trend,eInfo,lastDraw);
    if(fr>bestFit){bestFit=fr;bestCombo=cr;}
  }
  return bestCombo||sorted.slice(0,pick).sort((a,b)=>a-b);
}

// Init data
const draws=(typeof LOTO7_DATA!=='undefined'?LOTO7_DATA:[]).map(r=>({
  round:r[0],date:r[1],
  numbers:[...r[2]].sort((a,b)=>a-b),
  bonuses:Array.isArray(r[3])?r[3]:[r[3]],
  co:r[4]
}));
draws.forEach(d=>{
  d.sum=d.numbers.reduce((a,b)=>a+b,0);
  d.odd=d.numbers.filter(n=>n%2===1).length;
  d.even=d.numbers.length-d.odd;
});

console.log(`Total draws loaded: ${draws.length}`);
console.log(`Last draw: R${draws[draws.length-1].round} (${draws[draws.length-1].date})`);

// Run prediction for round 669
const mx=CFG.loto7.max;

// Entropy
const entropyInfo=entropyTrend(draws);
console.log(`\nEntropy mode: ${entropyInfo.mode} (avg=${entropyInfo.avg.toFixed(3)})`);

// Wave scores
const mat=buildMatrix(draws);
const pre=[];
for(let i=1;i<=mx;i++){
  const d=depthWave(i,draws),v=vertWave(i,draws),h=horzWave(i,draws);
  pre.push({num:i,score:d+v+h});
}
pre.sort((a,b)=>b.score-a.score);
const tops=pre.slice(0,10).map(s=>s.num);

const scores=[];
for(let i=1;i<=mx;i++){
  const d=depthWave(i,draws),v=vertWave(i,draws),h=horzWave(i,draws),cr=crossWave(i,tops,mat),co=coBias(i,draws),fo=fourierWave(i,draws);
  scores.push({num:i,total:d+v+h+cr+co+fo,depth:d,vertical:v,horizontal:h,cross:cr,co,fourier:fo});
}
scores.sort((a,b)=>b.total-a.total);

const top18=selectTop18(scores);
const trend=calcTrend(draws);
console.log(`Trend: sumT=${trend.sumT}, oddT=${trend.oddT}`);
console.log(`Top18: ${top18.map(s=>s.num).join(',')}`);

// ONE SHOT
console.log('\nRunning GA for ONE SHOT...');
const pred=genPrediction(top18,trend,scores,entropyInfo,draws);
console.log(`ONE SHOT: [${pred.numbers.join(',')}]`);
console.log(`  Sum=${pred.sum}, O/E=${pred.oe.join('/')}, Zones=${JSON.stringify(pred.zones)}`);
console.log(`  KillCheck: ${pred.kr.length===0?'PASS':pred.kr.join(',')}`);

// ANTI-THEORY SHOT
console.log('\nRunning GA for ANTI-THEORY SHOT...');
const anti=genAntiTheoryShot(scores,trend,entropyInfo,pred.numbers);
console.log(`ANTI-THEORY SHOT: [${anti.numbers.join(',')}]`);
console.log(`  Sum=${anti.sum}, Overlap with ONE SHOT=${anti.overlap}`);
console.log(`  Recommended: ${anti.recommended}`);

// BACKTEST
console.log('\nRunning backtest (last 20 draws)...');
const testRange=Math.min(20,draws.length-30);
const btResults=[];
for(let t=1;t<=testRange;t++){
  const idx=draws.length-t;
  const actual=draws[idx];
  const trainData=draws.slice(0,idx);
  if(trainData.length<20)continue;
  const bMat=buildMatrix(trainData);
  const bPre=[];
  for(let i=1;i<=mx;i++){
    const d=depthWave(i,trainData),v=vertWave(i,trainData),h=horzWave(i,trainData);
    bPre.push({num:i,score:d+v+h});
  }
  bPre.sort((a,b)=>b.score-a.score);
  const bTops=bPre.slice(0,10).map(s=>s.num);
  const bScores=[];
  for(let i=1;i<=mx;i++){
    const d=depthWave(i,trainData),v=vertWave(i,trainData),h=horzWave(i,trainData),cr=crossWave(i,bTops,bMat),co=coBias(i,trainData),fo=fourierWave(i,trainData);
    bScores.push({num:i,total:d+v+h+cr+co+fo});
  }
  bScores.sort((a,b)=>b.total-a.total);
  const bTrend=calcTrend(trainData);
  const bEInfo=entropyTrend(trainData);
  const lastDraw=trainData[trainData.length-1].numbers;
  const scoreMap={};bScores.forEach(s=>{scoreMap[s.num]=s.total;});
  const pool=bScores.slice(0,24).map(s=>s.num);
  const predicted=deterministicPick(pool,CFG.loto7.pick,scoreMap,bTrend,bEInfo,lastDraw);
  const hits=predicted.filter(n=>actual.numbers.includes(n));
  btResults.push({round:actual.round,hits:hits.length});
  process.stdout.write(`  R${actual.round}: predicted=[${predicted.join(',')}], actual=[${actual.numbers.join(',')}], hits=${hits.length}\n`);
}
const totalHits=btResults.reduce((s,r)=>s+r.hits,0);
const totalPoss=btResults.length*CFG.loto7.pick;
const avgHit=(totalHits/btResults.length).toFixed(2);
const maxHit=Math.max(...btResults.map(r=>r.hits));
const hitRate=(totalHits/totalPoss*100).toFixed(1);
const hit3plus=btResults.filter(r=>r.hits>=3).length;
const hit3plusRate=(hit3plus/btResults.length*100).toFixed(1);

console.log(`\n===== BACKTEST RESULTS =====`);
console.log(`Tests: ${btResults.length}`);
console.log(`Avg Hits: ${avgHit}`);
console.log(`Max Hits: ${maxHit}`);
console.log(`Hit Rate: ${hitRate}%`);
console.log(`3+ Hit Rate: ${hit3plusRate}% (${hit3plus}/${btResults.length})`);

console.log(`\n===== PREDICTION SUMMARY =====`);
console.log(`Target: Round 669 (2026/3/20)`);
console.log(`ONE SHOT: [${pred.numbers.join(',')}]`);
console.log(`ANTI-THEORY SHOT: [${anti.numbers.join(',')}]`);
console.log(`Entropy Mode: ${entropyInfo.mode}`);
console.log(`JSONL_ENTRY:${JSON.stringify({
  timestamp:new Date().toISOString(),
  version:'v6.3.1-data668',
  game:'loto7',
  target_round:669,
  one_shot:pred.numbers,
  anti_theory_shot:anti.numbers,
  backtest:{avg_hits:parseFloat(avgHit),max_hits:maxHit,hit_rate:parseFloat(hitRate),hit3plus_rate:parseFloat(hit3plusRate),tests:btResults.length},
  score_breakdown:{entropy_mode:entropyInfo.mode,entropy_avg:parseFloat(entropyInfo.avg.toFixed(3)),crossWave_cap:30,carry_max:1,overlap_max:3,anti_overlap:anti.overlap},
  notes:'第669回予測。data.js 668回まで更新後の再計算。'
})}`);
