import numpy as np, soundfile as sf
SR=48000; DUR=37.5; N=int(SR*DUR); t=np.arange(N)/SR
L=np.zeros(N); R=np.zeros(N)
BPM=92; beat=60/BPM; bar=4*beat
def mtof(m): return 440*2**((m-69)/12)
# progression (midi roots + chord tones): Fmaj9, Am7, Dm9, Bbmaj7(#11) ... loop
prog=[[41,57,60,64,67],[45,57,60,64,67],[38,57,60,62,65],[46,58,62,65,69]]
def env_adsr(n,a,r):
    e=np.ones(n); na=min(int(a*SR),n//2); nr=min(int(r*SR),n//2)
    e[:na]=np.linspace(0,1,na); e[-nr:]*=np.linspace(1,0,nr); return e
rng=np.random.default_rng(7)
# pad: detuned sines with slow tremolo, per bar
nb=int(np.ceil(DUR/bar))
for b in range(nb):
    ch=prog[b%4]; s0=int(b*bar*SR); n=min(int((bar+1.2)*SR), N-s0)
    if n<=0: break
    tt=np.arange(n)/SR; e=env_adsr(n,0.9,1.3)
    for k,m in enumerate(ch[1:]):
        for det,pan in ((-0.07,0.25),(0.07,0.75)):
            f=mtof(m+det); x=np.sin(2*np.pi*f*tt+rng.random()*6)+0.18*np.sin(2*np.pi*2*f*tt)
            x*=e*0.045*(1+0.15*np.sin(2*np.pi*0.25*tt+k))
            L[s0:s0+n]+=x*(1-pan); R[s0:s0+n]+=x*pan
    # bass
    f=mtof(ch[0]); x=(np.sin(2*np.pi*f*tt)+0.3*np.sin(2*np.pi*2*f*tt))*env_adsr(n,0.05,1.0)*0.16
    L[s0:s0+n]+=x; R[s0:s0+n]+=x
# pluck arpeggio (8th notes) from 4.6s
def pluck(f,n):
    tt=np.arange(n)/SR; return (np.sin(2*np.pi*f*tt)+0.35*np.sin(2*np.pi*2*f*tt)+0.12*np.sin(2*np.pi*3*f*tt))*np.exp(-tt*5.5)
step=beat/2; k=0; tt0=4.6
pat=[0,2,1,3,2,1,3,2]
while tt0<DUR-0.5:
    b=int(tt0//bar); ch=prog[b%4]; m=ch[1+pat[k%8]]+12; s0=int(tt0*SR); n=min(int(1.2*SR),N-s0)
    g=0.07 if tt0<29.3 else 0.05
    x=pluck(mtof(m),n)*g; pan=0.3+0.4*((k%4)/3)
    L[s0:s0+n]+=x*(1-pan); R[s0:s0+n]+=x*pan; k+=1; tt0+=step
# soft kick + shaker from 4.6 to 29.2
tb=4.6
while tb<29.2:
    s0=int(tb*SR); n=int(0.35*SR); tt=np.arange(n)/SR
    f=50+90*np.exp(-tt*30); kick=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt*9)*0.22
    L[s0:s0+n]+=kick; R[s0:s0+n]+=kick
    s1=int((tb+beat/2)*SR); n2=int(0.08*SR)
    if s1+n2<N:
        sh=rng.standard_normal(n2)*np.exp(-np.arange(n2)/SR*60)*0.02
        sh=np.diff(sh,prepend=0)
        L[s1:s1+n2]+=sh*0.8; R[s1:s1+n2]+=sh
    tb+=beat
# whooshes
def whoosh(tc,d=0.9,g=0.12):
    s0=int((tc-d*0.7)*SR); n=int(d*SR); tt=np.arange(n)/SR
    no=rng.standard_normal(n); out=np.zeros(n); y=0
    fc=300+3500*np.sin(np.pi*tt/d)**2
    a=1-np.exp(-2*np.pi*fc/SR)
    for i in range(n): y+=a[i]*(no[i]-y); out[i]=y
    out*=np.sin(np.pi*tt/d)**2*g*3
    L[s0:s0+n]+=out*np.linspace(1,0.3,n); R[s0:s0+n]+=out*np.linspace(0.3,1,n)
for tc in (12.5,18.2,25.1,29.45): whoosh(tc)
# chime on logo
for j,m in enumerate([81,88,93]):
    s0=int((29.85+j*0.09)*SR); n=int(3*SR); tt=np.arange(n)/SR
    x=(np.sin(2*np.pi*mtof(m)*tt)+0.3*np.sin(2*np.pi*mtof(m)*2.01*tt))*np.exp(-tt*1.6)*0.05
    L[s0:s0+n]+=x; R[s0:s0+n]+=x
# simple reverb-ish: feedback delays
def verb(x):
    y=x.copy()
    for d,g in ((0.031,0.35),(0.047,0.3),(0.071,0.25),(0.113,0.2),(0.17,0.15)):
        k=int(d*SR); y[k:]+=x[:-k]*g
    return y
L=verb(L); R=verb(R)
# fades
fi=int(0.8*SR); fo=int(1.6*SR)
for ch in (L,R): ch[:fi]*=np.linspace(0,1,fi); ch[-fo:]*=np.linspace(1,0,fo)
m=np.stack([L,R],1); m/=np.abs(m).max()*1.12
sf.write('audio/musica.wav', m.astype(np.float32), SR)
print('ok')
