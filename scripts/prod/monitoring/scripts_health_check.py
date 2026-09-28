#!/usr/bin/env python3
import shutil,subprocess,urllib.request,datetime,os,socket
D="/root/backups"
ts=datetime.datetime.now().isoformat()
def al(n,m):open(D+"/ALERT-health-"+n,"w").write(ts+" "+m+chr(10))
def cl(n):
 p=D+"/ALERT-health-"+n
 if os.path.exists(p):os.remove(p)
def hc(u):
 try:return urllib.request.urlopen(u,timeout=12).getcode()
 except Exception:return 0
def sa(s):return subprocess.run(["systemctl","is-active","--quiet",s]).returncode==0
def tcp(h,po):
 try:s=socket.create_connection((h,po),timeout=5);s.close();return True
 except Exception:return False
c=hc("http://127.0.0.1:8200/up")
cl("app") if c==200 else al("app","/up HTTP "+str(c))
h=hc("http://127.0.0.1:8200/")
cl("home") if h==200 else al("home","home HTTP "+str(h))
du=shutil.disk_usage("/")
k=int(du.used*100/du.total)
cl("disk") if k<90 else al("disk","disk "+str(k)+" pct")
for n,s in[("queue","ragil-queue.service"),("fpm","php8.3-fpm"),("wa","baileys-bot.service")]:
 cl(n) if sa(s) else al(n,s+" down")
cl("db") if tcp("127.0.0.1",3306) else al("db","mysql 3306 down")
cl("redis") if tcp("127.0.0.1",6379) else al("redis","redis 6379 down")
print("health-ok")